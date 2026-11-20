import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { Category } from '../data/categories'
import { ApiError, fetchCatalogue, submitVote } from '../lib/awardsApi'

type AwardsState = Awaited<ReturnType<typeof fetchCatalogue>>
type VotesContextValue = AwardsState & {
  votedCount: number
  saveVote: (category: Category, nomineeId: string) => Promise<void>
  refreshCatalogue: () => Promise<void>
}

const VotesContext = createContext<VotesContextValue | null>(null)

export function VotesProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AwardsState>()
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    fetchCatalogue(controller.signal).then(setData, (reason: unknown) => {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Попробуйте ещё раз.')
    })
    return () => controller.abort()
  }, [attempt])

  async function refreshCatalogue() {
    try {
      setData(await fetchCatalogue())
    } catch {
      // Keep the last catalogue visible if the refresh fails.
    }
  }

  async function saveVote(category: Category, nomineeId: string) {
    try {
      const saved = await submitVote(category.apiId, nomineeId)
      setData((current) => current && ({
        ...current,
        votes: { ...current.votes, [category.id]: String(saved.nominee_id) },
        voteNames: { ...current.voteNames, [category.id]: category.nominees.find((nominee) => nominee.id === nomineeId)?.name ?? '' },
      }))
    } catch (error) {
      if (error instanceof ApiError && [401, 403, 404, 409].includes(error.status)) {
        await refreshCatalogue()
      }
      throw error
    }
  }

  if (!data) {
    return (
      <main className="container section">
        <div className="empty-state" role={error ? 'alert' : 'status'}>
          <h1>{error ? 'Не удалось загрузить номинации' : 'Загружаем номинации…'}</h1>
          {error && (
            <>
              <p>{error}</p>
              <button type="button" className="button button--gold" onClick={() => {
                setError('')
                setAttempt(attempt + 1)
              }}>
                Повторить
              </button>
            </>
          )}
        </div>
      </main>
    )
  }

  return (
    <VotesContext.Provider value={{
      ...data,
      votedCount: Object.keys(data.votes).length,
      saveVote,
      refreshCatalogue,
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
