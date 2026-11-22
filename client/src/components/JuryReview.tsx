import { useState } from 'react'
import type { FormEvent } from 'react'
import { request } from '../lib/awardsApi'
import { useVotes } from '../context/VotesContext'

type JuryReviewProps = {
  categoryId: number
  categoryTitle: string
}

export function JuryReview({ categoryId, categoryTitle }: JuryReviewProps) {
  const { auth } = useVotes()
  const [content, setContent] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  if (auth.user?.role !== 'JURY') return null

  async function submitReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = content.trim()
    if (!trimmed) {
      setError('Введите текст отзыва.')
      setSent(false)
      return
    }
    if ([...trimmed].length > 256) {
      setError('Отзыв не должен превышать 256 символов.')
      setSent(false)
      return
    }

    setPending(true)
    setError('')
    setSent(false)
    try {
      await request('/jury/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nomination_id: categoryId, content: trimmed }),
      })
      setContent('')
      setSent(true)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Не удалось отправить отзыв.')
    } finally {
      setPending(false)
    }
  }

  return (
    <section className="jury-review" aria-labelledby="jury-review-title">
      <h2 id="jury-review-title">Предложение жюри</h2>
      <p>Что добавить, изменить или убрать в номинации «{categoryTitle}»?</p>
      <form className="jury-review__form" onSubmit={submitReview}>
        <label htmlFor="jury-review-content">Отзыв</label>
        <textarea
          id="jury-review-content"
          value={content}
          onChange={(event) => setContent(event.target.value)}
          maxLength={256}
          rows={4}
          disabled={pending}
          placeholder="Ваше предложение"
        />
        <div className="jury-review__footer">
          <span aria-live="polite">{[...content].length}/256</span>
          <button type="submit" className="button button--gold" disabled={pending}>
            {pending ? 'Отправляем…' : 'Отправить отзыв'}
          </button>
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        {sent && <p className="jury-review__success" role="status">Отзыв отправлен.</p>}
      </form>
    </section>
  )
}
