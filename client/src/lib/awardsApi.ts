import { getPresentation } from '../data/categories'
import type { Category, CategoryStatus } from '../data/categories'

type CatalogueNominee = {
  id: number
  name: string
  handle: string | null
  description: string
  song: string | null
  image_url: string | null
  image_alt: string | null
  link_url: string | null
  audio_url: string | null
}

type CatalogueEntry = {
  id: number
  title: string
  description: string
  status: CategoryStatus
  image_url: string | null
  can_vote: boolean
  results_available: boolean
  voted_nominee_id: number | null
  voted_nominee_name: string | null
  nominees: CatalogueNominee[]
}

export type ResultEntry = {
  id: number
  name: string
  vote_count: number
  user_votes: number
  jury_votes: number
  weighted_score: number
}

export type MyVote = {
  nomination_id: number
  nominee_id: number
  nomination_title: string
  nominee_name: string
}

export type AuthState = {
  user: { id: string; displayName: string; role: 'USER' | 'JURY' | 'MANAGER' | 'SUPERADMIN' } | null
  botUrl: string | null
}

type VotingState = {
  allowVoteChanges: boolean
  startsAt: string | null
  endsAt: string | null
  resultsPublished: boolean
  open: boolean
}

export class ApiError extends Error {
  readonly code: string | undefined
  readonly status: number

  constructor(message: string, code: string | undefined, status: number) {
    super(message)
    this.code = code
    this.status = status
  }
}

async function fetchEnvelope<T>(path: string, options?: RequestInit): Promise<{ data: T; auth?: AuthState; voting?: VotingState }> {
  const response = await fetch(`/api${path}`, options).catch((error) => {
    if (options?.signal?.aborted) throw error
    throw new ApiError('Не удалось связаться с сервером. Проверьте подключение.', 'network_error', 0)
  })
  const body = await response.json().catch(() => null)
  if (!response.ok) {
    throw new ApiError(body?.error?.message ?? 'Не удалось выполнить запрос. Попробуйте ещё раз.', body?.error?.code, response.status)
  }
  if (!body || !Object.hasOwn(body, 'data')) {
    throw new ApiError('Сервер вернул неожиданный ответ.', 'unexpected_response', response.status)
  }
  return body
}

export async function request<T>(path: string, options?: RequestInit): Promise<T> {
  return (await fetchEnvelope<T>(path, options)).data
}

function safeMediaUrl(value: string | null): string | null {
  if (!value) return null
  try {
    if (/^\/(?:assets|images|audio)\//.test(value) && !value.includes('\\')) return value
    if (/^\/api\/media\/[a-f0-9]{64}$/.test(value)) return value
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null
  } catch {
    return null
  }
}

export async function fetchCatalogue(signal?: AbortSignal) {
  const { data: rows, auth, voting } = await fetchEnvelope<CatalogueEntry[]>('/nominations?include=nominees', { signal })
  if (!auth || !voting) throw new Error('Сервер не вернул статус входа или голосования.')
  const votes: Record<string, string> = {}
  const voteNames: Record<string, string> = {}
  const usedSlugs = new Set<string>()
  const categories: Category[] = rows.map((row) => {
    const [slug, group] = getPresentation(row.title) ?? [String(row.id), 'community']
    const id = usedSlugs.has(slug) ? String(row.id) : slug
    usedSlugs.add(id)
    if (row.voted_nominee_id != null) votes[id] = String(row.voted_nominee_id)
    if (row.voted_nominee_name) voteNames[id] = row.voted_nominee_name
    return {
      id,
      apiId: row.id,
      title: row.title,
      description: row.description,
      group,
      status: row.status,
      imageUrl: safeMediaUrl(row.image_url),
      canVote: row.can_vote,
      resultsAvailable: row.results_available,
      nominees: row.nominees.map((nominee) => {
        const linkUrl = safeMediaUrl(nominee.link_url)
        const legacyTrackUrl = id === 'track-goda' && linkUrl && /\.(?:mp3|wav|ogg|m4a|aac|flac)(?:[?#]|$)/i.test(linkUrl)
          ? linkUrl
          : null
        return {
          id: String(nominee.id),
          name: nominee.name,
          handle: nominee.handle ?? null,
          tagline: nominee.description,
          song: nominee.song ?? null,
          photo: safeMediaUrl(nominee.image_url),
          photoAlt: nominee.image_alt ?? null,
          linkUrl,
          audio: safeMediaUrl(nominee.audio_url) ?? legacyTrackUrl,
        }
      }),
    }
  })
  return { categories, votes, voteNames, auth, voting }
}

function post<T>(path: string, body: object) {
  return request<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export function signIn(code: string) {
  return post<AuthState>('/auth/login', { code })
}

export function signOut() {
  return post<AuthState>('/auth/logout', {})
}

export function submitVote(categoryId: number, nomineeId: string) {
  const data = { nomination_id: categoryId, nominee_id: Number(nomineeId) }
  return post<typeof data>('/votes', data)
}

export function fetchResults(categoryId: number, signal: AbortSignal) {
  return request<ResultEntry[]>(`/nominations/${categoryId}/results`, { signal })
}

export function fetchMyVotes(signal: AbortSignal) {
  return request<MyVote[]>('/votes/me', { signal })
}
