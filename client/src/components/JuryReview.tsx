import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Check, Pencil, RotateCcw } from 'lucide-react'
import { request } from '../lib/awardsApi'
import { useVotes } from '../context/VotesContext'

type JuryVote = {
  nomination_id: number
  nominee_id: number
  nominee_name?: string
  justification: string
  updated_at: string
}

type JuryReviewProps = {
  categoryId: number
  nominees: Array<{ id: string; name: string }>
  nomineeId: string
  onNomineeChange: (id: string) => void
}

export function JuryReview({ categoryId, nominees, nomineeId, onNomineeChange }: JuryReviewProps) {
  const { auth } = useVotes()
  const [vote, setVote] = useState<JuryVote | null>(null)
  const [justification, setJustification] = useState('')
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)

  useEffect(() => {
    if (auth.user?.role !== 'JURY') return
    const controller = new AbortController()
    request<JuryVote | null>(`/jury/votes/${categoryId}`, { signal: controller.signal })
      .then((savedVote) => {
        setVote(savedVote)
        onNomineeChange(savedVote ? String(savedVote.nominee_id) : '')
        setJustification(savedVote?.justification ?? '')
      })
      .catch((reason) => {
        if (controller.signal.aborted) return
        setLoadError(reason instanceof Error ? reason.message : 'Не удалось загрузить голос жюри.')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [auth.user?.role, categoryId, reload, onNomineeChange])

  if (auth.user?.role !== 'JURY') return null

  const selectedNominee = nominees.find((nominee) => nominee.id === nomineeId)
  const savedNomineeName = vote?.nominee_name ?? selectedNominee?.name ?? 'Номинант'

  async function submitVote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = justification.trim()
    if (!nomineeId) {
      setError('Выберите номинанта.')
      return
    }
    if (!trimmed || [...trimmed].length > 256) {
      setError('Обоснование должно содержать от 1 до 256 символов.')
      return
    }

    setPending(true)
    setError('')
    try {
      const savedVote = await request<JuryVote>('/jury/votes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nomination_id: categoryId,
          nominee_id: Number(nomineeId),
          justification: trimmed,
        }),
      })
      setVote({ ...savedVote, nominee_name: nominees.find((nominee) => nominee.id === nomineeId)?.name })
      onNomineeChange(String(savedVote.nominee_id))
      setJustification(savedVote.justification)
      setEditing(false)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Не удалось сохранить голос жюри.')
    } finally {
      setPending(false)
    }
  }

  function beginEdit() {
    onNomineeChange(vote ? String(vote.nominee_id) : '')
    setJustification(vote?.justification ?? '')
    setError('')
    setEditing(true)
  }

  function cancelEdit() {
    onNomineeChange(vote ? String(vote.nominee_id) : '')
    setJustification(vote?.justification ?? '')
    setError('')
    setEditing(false)
  }

  return (
    <aside className="vote-panel jury-vote" aria-labelledby="jury-vote-title">
      <div className="vote-panel__intro">
        <div className="vote-panel__head">
          <p className="eyebrow">Анонимное голосование</p>
        </div>
        <h2 id="jury-vote-title">Голос жюри</h2>
      </div>

      {loading && <p className="jury-vote__message" role="status">Загружаем ваш голос…</p>}
      {!loading && loadError && (
        <div className="jury-vote__message">
          <p className="form-error" role="alert">{loadError}</p>
          <button type="button" className="button button--ghost jury-vote__button" onClick={() => {
            setLoading(true)
            setLoadError('')
            setReload((value) => value + 1)
          }}>
            Повторить
            <RotateCcw size={15} aria-hidden="true" />
          </button>
        </div>
      )}
      {!loading && !loadError && vote && !editing && (
        <>
          <ul className="picked-list">
            <li>
              <span className="picked-list__check" aria-hidden="true">
                <Check size={12} strokeWidth={3} />
              </span>
              <span className="picked-list__name">{savedNomineeName}</span>
            </li>
          </ul>
          <div className="jury-vote__justification">
            <strong>Обоснование выбора</strong>
            <p>{vote.justification}</p>
          </div>
          <p className="jury-vote__success" role="status">Ваш голос жюри учтён.</p>
          <button type="button" className="button button--ghost jury-vote__button" onClick={beginEdit}>
            Изменить голос
            <Pencil size={15} aria-hidden="true" />
          </button>
        </>
      )}
      {!loading && !loadError && (!vote || editing) && (
        <form className="jury-vote__form jury-vote__form--centered" onSubmit={submitVote}>
          <div className="jury-vote__choice">
            <span className="jury-vote__choice-label">Номинант</span>
            <strong>{selectedNominee?.name ?? 'Выберите номинанта на карточке выше'}</strong>
          </div>
          <label className="jury-vote__field" htmlFor={`jury-justification-${categoryId}`}>
            Обоснование выбора
            <textarea
              id={`jury-justification-${categoryId}`}
              value={justification}
              onChange={(event) => setJustification(event.target.value)}
              maxLength={256}
              rows={4}
              disabled={pending}
              placeholder="Почему этот номинант достоин победы?"
              required
            />
          </label>
          <div className="jury-vote__footer">
            <span aria-live="polite">{[...justification].length}/256</span>
            <button type="submit" className="button button--gold" disabled={pending || !nominees.length}>
              {pending ? 'Отправляем…' : 'Отправить голос'}
              <Check size={16} aria-hidden="true" />
            </button>
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
          {vote && (
            <button type="button" className="button button--ghost jury-vote__button" onClick={cancelEdit} disabled={pending}>
              Отменить изменения
            </button>
          )}
        </form>
      )}
    </aside>
  )
}
