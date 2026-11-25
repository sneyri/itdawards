import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { matchPath, useLocation } from 'react-router-dom'
import type { Location } from 'react-router-dom'
import type { Category } from '../data/categories'
import { primeRequest, useRequest } from '../hooks/useRequest'
import { ApiError, fetchAuth, fetchCatalogue, fetchMyVotes, fetchNomination, fetchNominationIndex, submitVote } from '../lib/awardsApi'
import type { AuthState, MyVote, VotingState } from '../lib/awardsApi'

const emptyAuth: AuthState = { user: null, botUrl: null }
const emptyVoting: VotingState = { allowVoteChanges: false, startsAt: null, endsAt: null, resultsPublished: false, open: false }
const emptyCategories: Category[] = []
const nominationLoaders = new Map<number, () => ReturnType<typeof fetchNomination>>()
const emptyDetail = () => Promise.reject(new Error('Номинация не найдена.'))

function nominationLoader(id: number) {
  const existing = nominationLoaders.get(id)
  if (existing) return existing
  const load = () => fetchNomination(id)
  nominationLoaders.set(id, load)
  return load
}

function findNomination(categories: Category[], id?: string) {
  return categories.find((category) => category.id === id || String(category.apiId) === id)
}

function numericId(id?: string) {
  return id && /^[1-9]\d{0,9}$/.test(id) ? Number(id) : undefined
}

export function primeAwards(path: string) {
  if (matchPath('/nominations', path)) {
    void primeRequest(fetchCatalogue)
    return
  }
  const slug = matchPath('/nominations/:categoryId', path)?.params.categoryId
  if (slug) {
    const index = primeRequest(fetchNominationIndex)
    const id = numericId(slug)
    if (id) void primeRequest(nominationLoader(id))
    else void index.then(({ categories }) => {
      const category = findNomination(categories, slug)
      if (category) void primeRequest(nominationLoader(category.apiId))
    }, () => {})
    return
  }
  if (['/', '/my-votes', '/questions', '/about'].some((route) => matchPath(route, path))) {
    void primeRequest(fetchNominationIndex)
  }
  void primeRequest(fetchAuth)
}

type CatalogueStatus = { data?: unknown; error?: Error; reload: () => Promise<void> }
type VotesContextValue = {
  auth: AuthState
  authReady: boolean
  authError?: Error
  retryAuth: () => Promise<void>
  categories: Category[]
  voting: VotingState
  votingReady: boolean
  votes: Record<string, string>
  voteNames: Record<string, string>
  votedCount: number
  index: CatalogueStatus
  catalogue: CatalogueStatus
  detail: CatalogueStatus & { category?: Category }
  history: CatalogueStatus & { data?: MyVote[] }
  saveVote: (category: Category, nomineeId: string) => Promise<void>
}
const VotesContext = createContext<VotesContextValue | null>(null)

export function VotesProvider({ children }: { children: ReactNode }) {
  const location = useLocation()
  const background = location.pathname === '/sign-in'
    ? (location.state as { backgroundLocation?: Location } | null)?.backgroundLocation
    : undefined
  const path = background?.pathname ?? location.pathname
  const home = Boolean(matchPath('/', path))
  const list = Boolean(matchPath('/nominations', path))
  const myVotes = Boolean(matchPath('/my-votes', path))
  const categoryId = matchPath('/nominations/:categoryId', path)?.params.categoryId
  const questions = Boolean(matchPath('/questions', path))

  const catalogue = useRequest(fetchCatalogue, list)
  const index = useRequest(fetchNominationIndex, !catalogue.data && (home || myVotes || questions || Boolean(categoryId)))
  const categories = catalogue.data?.categories ?? index.data?.categories ?? emptyCategories
  const matching = findNomination(categories, categoryId)
  const apiId = matching?.apiId ?? numericId(categoryId)
  const loadDetail = apiId ? nominationLoader(apiId) : emptyDetail
  const catalogueCategory = catalogue.data && matching
  const detail = useRequest(loadDetail, Boolean(apiId && !catalogueCategory))
  const detailData = detail.data
  const fromCatalogue = list || Boolean(catalogueCategory)
  const awaitingDetail = Boolean(categoryId && !catalogueCategory && !detail.error
    && (apiId || (!index.data && !index.error && !catalogue.data)))
  const hasEmbeddedAuth = (fromCatalogue && !catalogue.error) || awaitingDetail
  const authRequest = useRequest(fetchAuth, !hasEmbeddedAuth && (!catalogue.data || Boolean(catalogue.error || detail.error)))
  const auth = (fromCatalogue ? catalogue.data?.auth : detailData?.auth)
    ?? authRequest.data ?? catalogue.data?.auth
  const accountId = auth?.user?.id
  const loadHistory = useCallback(() => accountId ? fetchMyVotes() : Promise.resolve([]), [accountId])
  const history = useRequest(loadHistory, Boolean(accountId && (home || myVotes)))
  const [localVote, setLocalVote] = useState<{ accountId: string; records: MyVote[] }>()

  // History can appear as soon as its endpoint responds. Load artwork only when there are records.
  const loadArtwork = myVotes && Boolean(history.data?.length)
  const ensureCatalogue = catalogue.ensure
  useEffect(() => { if (loadArtwork) ensureCatalogue() }, [loadArtwork, ensureCatalogue])
  const effectiveDetail = useMemo(() => detailData
    ? { ...detailData.category, id: matching?.id ?? detailData.category.id }
    : catalogueCategory, [detailData, matching?.id, catalogueCategory])
  const detailError = detail.error ?? ((!apiId && !catalogue.data) ? index.error : undefined)
  const localRecords = localVote?.accountId === accountId ? localVote?.records ?? [] : []
  const historyRecords = history.data?.map((record) => localRecords.find((item) => item.nomination_id === record.nomination_id) ?? record)
  if (historyRecords) {
    for (const record of localRecords) {
      if (!historyRecords.some((item) => item.nomination_id === record.nomination_id)) historyRecords.push(record)
    }
  }

  const votes = { ...(catalogue.data?.auth.user?.id === accountId ? catalogue.data?.votes : {}) }
  const voteNames = { ...(catalogue.data?.auth.user?.id === accountId ? catalogue.data?.voteNames : {}) }
  if (effectiveDetail && detailData?.auth.user?.id === accountId && detailData?.nomineeId != null) {
    votes[effectiveDetail.id] = String(detailData.nomineeId)
    if (detailData.nomineeName) voteNames[effectiveDetail.id] = detailData.nomineeName
  }
  const byId = new Map(categories.map((category) => [category.apiId, category.id]))
  for (const record of [...(historyRecords ?? []), ...localRecords]) {
    const id = byId.get(record.nomination_id) ?? String(record.nomination_id)
    votes[id] = String(record.nominee_id)
    voteNames[id] = record.nominee_name
  }

  async function saveVote(category: Category, nomineeId: string) {
    try {
      const saved = await submitVote(category.apiId, nomineeId)
      if (!accountId) return
      const record = { nomination_id: category.apiId, nominee_id: saved.nominee_id, nomination_title: category.title,
        nominee_name: category.nominees.find((nominee) => nominee.id === nomineeId)?.name ?? '' }
      setLocalVote((current) => ({
        accountId,
        records: [...(current?.accountId === accountId
          ? current.records.filter((item) => item.nomination_id !== category.apiId) : []), record],
      }))
    } catch (error) {
      if (error instanceof ApiError && [401, 403, 404, 409].includes(error.status)) {
        setLocalVote(undefined)
        if (catalogueCategory) await catalogue.reload()
        else await detail.reload()
      }
      throw error
    }
  }

  const voting = detailData?.voting ?? catalogue.data?.voting ?? index.data?.voting
  return (
    <VotesContext.Provider value={{
      auth: auth ?? emptyAuth, authReady: Boolean(auth), authError: authRequest.error, retryAuth: authRequest.reload,
      categories, voting: voting ?? emptyVoting, votingReady: Boolean(voting),
      votes, voteNames, votedCount: categories.filter((category) => votes[category.id]).length, index, catalogue,
      detail: { data: effectiveDetail ?? (!apiId ? index.data ?? catalogue.data : undefined),
        category: effectiveDetail, error: detailError, reload: apiId ? detail.reload : index.reload },
      history: { ...history, data: historyRecords }, saveVote,
    }}>
      {children}
    </VotesContext.Provider>
  )
}

export function useVotes(): VotesContextValue {
  const context = useContext(VotesContext)
  if (!context) throw new Error('useVotes must be used inside VotesProvider')
  return context
}
