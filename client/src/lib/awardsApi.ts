import { getPresentation } from '../data/categories'
import type { Category, CategoryStatus } from '../data/categories'
import type { Challenge } from 'altcha-lib/types'

type CatalogueEntry = {
  id: number
  title: string
  description: string
  status: CategoryStatus
  suggestions_preview: boolean
  voted_nominee_id: number | null
  nominees: { id: number; name: string; description: string; image_url: string | null }[]
}

export type VoteMap = Record<string, string>
export type ResultEntry = { id: number; name: string; vote_count: number }
export type AuthState = { mode: 'anonymous' | 'demo' | 'account' | 'unavailable'; signedIn: boolean; available: boolean }

export class ApiError extends Error {
  readonly code: string | undefined

  constructor(message: string, code: string | undefined) {
    super(message)
    this.code = code
  }
}

async function fetchEnvelope<T>(path: string, options?: RequestInit): Promise<{ data: T; auth?: AuthState }> {
  const response = await fetch(`/api${path}`, options)
  const body = await response.json().catch(() => null)
  if (!response.ok) {
    throw new ApiError(body?.error?.message ?? 'Не удалось выполнить запрос.', body?.error?.code)
  }
  if (!body || !Object.hasOwn(body, 'data')) throw new Error('Сервер вернул неожиданный ответ.')
  return body
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  return (await fetchEnvelope<T>(path, options)).data
}

export async function fetchCatalogue(signal?: AbortSignal) {
  const { data: rows, auth } = await fetchEnvelope<CatalogueEntry[]>('/nominations?include=nominees', { signal })
  if (!auth) throw new Error('Сервер не вернул статус входа.')
  const votes: VoteMap = {}
  const usedSlugs = new Set<string>()
  const categories: Category[] = rows.map((row) => {
    const [slug, group] = getPresentation(row.title) ?? [String(row.id), 'community']
    const id = usedSlugs.has(slug) ? String(row.id) : slug
    usedSlugs.add(id)
    if (row.voted_nominee_id !== null) votes[id] = String(row.voted_nominee_id)
    return {
      id,
      apiId: row.id,
      title: row.title,
      description: row.description,
      group,
      status: row.status,
      suggestionsPreview: row.suggestions_preview,
      nominees: row.nominees.map((nominee) => ({
        id: String(nominee.id),
        name: nominee.name,
        tagline: nominee.description,
        imageUrl: nominee.image_url?.startsWith('/assets/') ? nominee.image_url : null,
      })),
    }
  })
  return { categories, votes, auth }
}

function post<T>(path: string, body: object) {
  return request<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

let voterCheck: Promise<unknown> | undefined

async function verifyBrowser() {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Проверка браузера доступна только по HTTPS или на localhost.')
  }
  const [challenge, { solveChallenge }, { deriveKey }] = await Promise.all([
    request<Challenge>('/voter/challenge'),
    import('altcha-lib'),
    import('altcha-lib/algorithms/web/pbkdf2'),
  ])
  const solution = await solveChallenge({ challenge, deriveKey, timeout: 20_000 })
  if (!solution) throw new Error('Не удалось завершить проверку браузера. Попробуйте ещё раз.')
  await post('/voter/verify', { challenge, solution })
}

export async function submitVote(categoryId: number, nomineeId: string) {
  const data = { nomination_id: categoryId, nominee_id: Number(nomineeId) }
  const vote = () => post<typeof data>('/votes', data)
  try {
    return await vote()
  } catch (error) {
    if (!(error instanceof ApiError) || error.code !== 'voter_verification_required') throw error
  }
  voterCheck ??= verifyBrowser().finally(() => { voterCheck = undefined })
  await voterCheck
  return vote()
}

export function fetchResults(categoryId: number, signal: AbortSignal) {
  return request<ResultEntry[]>(`/nominations/${categoryId}/results`, { signal })
}
