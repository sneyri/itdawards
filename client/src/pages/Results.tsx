import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, Check, Trophy } from 'lucide-react'
import type { Category, CategoryGroup } from '../data/categories'
import { groupLabels } from '../data/categories'
import { PageHero } from '../components/PageHero'
import { CategoryIcon } from '../components/CategoryIcon'
import { useVotes } from '../context/VotesContext'
import { usePageTitle } from '../hooks/usePageTitle'
import { fetchResults } from '../lib/awardsApi'
import type { ResultEntry } from '../lib/awardsApi'
import { formatNumber, pluralize } from '../lib/format'

const filters = ['all', 'people', 'content', 'community'] as const

export function Results() {
  usePageTitle('Результаты')
  const { categories, isPreview, votes } = useVotes()
  const [filter, setFilter] = useState<'all' | CategoryGroup>('all')
  const closed = useMemo(() => categories.filter((category) => category.status === 'closed'), [categories])
  const visible = closed.filter((category) => filter === 'all' || category.group === filter)

  return (
    <div className="results-page">
      <PageHero
        eyebrow={isPreview ? 'Тестовое голосование · 2026' : 'ITD AWARDS · 2026'}
        title={<>Итоги <em>голосования.</em></>}
        description="Результаты каждой номинации появляются после завершения голосования в ней."
        ghost="2026"
      />
      <section className="section results-section">
        <div className="container">
          {closed.length ? (
            <>
              <div className="results-toolbar">
                <div className="filter-group" role="group" aria-label="Фильтр по группам номинаций">
                  {filters.map((key) => (
                    <button key={key} type="button" aria-pressed={filter === key}
                      className={`chip ${filter === key ? 'is-active' : ''}`} onClick={() => setFilter(key)}>
                      {key === 'all' ? 'Все' : groupLabels[key]}
                      <span className="chip__count">
                        {key === 'all' ? closed.length : closed.filter((item) => item.group === key).length}
                      </span>
                    </button>
                  ))}
                </div>
                <span className="results-toolbar__meta">
                  <Trophy size={15} aria-hidden="true" />
                  Показано {visible.length} из {closed.length}
                </span>
              </div>
              {visible.length ? (
                <div className="results-grid">
                  {visible.map((category) => (
                    <CategoryResult key={category.apiId} category={category} pick={votes[category.id]} />
                  ))}
                </div>
              ) : <p role="status">В этой группе пока нет завершённых номинаций.</p>}
            </>
          ) : (
            <div className="empty-state">
              <span className="empty-state__icon" aria-hidden="true"><Trophy size={26} /></span>
              <h2>Результаты пока недоступны</h2>
              <Link to="/nominations" className="button button--gold">
                К номинациям <ArrowUpRight size={16} aria-hidden="true" />
              </Link>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

function CategoryResult({ category, pick }: { category: Category; pick?: string }) {
  const [results, setResults] = useState<ResultEntry[]>()
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    fetchResults(category.apiId, controller.signal).then(setResults, () => {
      if (!controller.signal.aborted) setFailed(true)
    })
    return () => controller.abort()
  }, [category.apiId, attempt])
  const total = results?.reduce((sum, entry) => sum + entry.vote_count, 0) ?? 0

  return (
    <article className="result-card">
      <div className="result-card__head">
        <span className="result-card__icon" aria-hidden="true"><CategoryIcon id={category.id} size={22} /></span>
        <div className="result-card__title-wrap">
          <h2><Link to={`/nominations/${category.id}`}>{category.title}</Link></h2>
          {results && <p>{formatNumber(total)} {pluralize(total, 'голос', 'голоса', 'голосов')}</p>}
        </div>
      </div>
      {failed && (
        <p role="alert">
          Не удалось загрузить результаты.{' '}
          <button type="button" className="text-button" onClick={() => {
            setFailed(false)
            setAttempt(attempt + 1)
          }}>Повторить</button>
        </p>
      )}
      {!failed && !results && <p role="status">Загружаем результаты…</p>}
      {results && (total ? (
        <ol className="result-list">
          {results.map((entry, index) => {
            const picked = String(entry.id) === pick
            const percent = Math.round(entry.vote_count / total * 100)
            return (
              <li key={entry.id} className={`result-row ${picked ? 'is-picked' : ''}`}>
                <span className="result-row__rank" aria-hidden="true">{index + 1}</span>
                <div className="result-row__main">
                  <div className="result-row__label">
                    <span className="result-row__name">
                      {entry.name}
                      {picked && <span className="result-row__pick"><Check size={11} /> ваш голос</span>}
                    </span>
                    <span className="result-row__percent">{percent}%</span>
                  </div>
                  <div className="result-bar" aria-hidden="true"><span style={{ width: `${percent}%` }} /></div>
                </div>
              </li>
            )
          })}
        </ol>
      ) : <p>Голосов в этой номинации нет.</p>)}
    </article>
  )
}
