import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { Category } from '../data/categories'
import { ApiError, fetchCatalogue, submitVote } from '../lib/awardsApi'

type AwardsState = Awaited<ReturnType<typeof fetchCatalogue>>
type VotesContextValue = AwardsState & {
  votedCount: number
  isPreview: boolean
  saveVote: (category: Category, nomineeId: string) => Promise<void>
}

const VotesContext = createContext<VotesContextValue | null>(null)

export function VotesProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AwardsState>()
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    fetchCatalogue(controller.signal).then(setData, () => {
      if (!controller.signal.aborted) setFailed(true)
    })
    return () => controller.abort()
  }, [attempt])

  async function saveVote(category: Category, nomineeId: string) {
    try {
      const saved = await submitVote(category.apiId, nomineeId)
      setData((current) => current && ({
        ...current,
        votes: { ...current.votes, [category.id]: String(saved.nominee_id) },
      }))
    } catch (error) {
      if (error instanceof ApiError && ['already_voted', 'voting_unavailable', 'nominee_not_found', 'nominee_mismatch', 'login_required', 'auth_unavailable'].includes(error.code ?? '')) {
        // The status or ballot can change while the page is open.
        try {
          setData(await fetchCatalogue())
        } catch {
          // Keep the original vote error if the catalogue is also unavailable.
        }
      }
      throw error
    }
  }

  if (!data) {
    return (
      <main className="container section">
        <div className="empty-state" role={failed ? 'alert' : 'status'}>
          <h1>{failed ? 'Не удалось загрузить номинации' : 'Загружаем номинации…'}</h1>
          {failed && (
            <button type="button" className="button button--gold" onClick={() => {
              setFailed(false)
              setAttempt(attempt + 1)
            }}>
              Повторить
            </button>
          )}
        </div>
      </main>
    )
  }

  return (
    <VotesContext.Provider value={{
      ...data,
      votedCount: Object.keys(data.votes).length,
      isPreview: data.categories.some((category) => category.suggestionsPreview),
      saveVote,
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
