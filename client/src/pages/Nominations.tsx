import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, SearchX } from 'lucide-react'
import { PageHero } from '../components/PageHero'
import { SearchField } from '../components/SearchField'
import { CategoryRow } from '../components/CategoryRow'
import { useVotes } from '../context/VotesContext'
import { usePageTitle } from '../hooks/usePageTitle'

type Filter = 'all' | 'voted' | 'unvoted'

const filterLabels: Record<Filter, string> = {
  all: 'Все',
  voted: 'Мой голос',
  unvoted: 'Без голоса',
}

export function Nominations() {
  usePageTitle('Номинации')
  const { categories, votedCategories, voting } = useVotes()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')

  const filterCounts = useMemo(() => {
    const voted = categories.filter((categoryItem) => votedCategories[categoryItem.id]).length
    return {
      all: categories.length,
      voted,
      unvoted: categories.length - voted,
    }
  }, [categories, votedCategories])

  const filteredCategories = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('ru')

    return categories.filter((categoryItem) => {
      const hasVote = Boolean(votedCategories[categoryItem.id])
      const matchesFilter =
        filter === 'all' ||
        (filter === 'voted' && hasVote) ||
        (filter === 'unvoted' && !hasVote)

      if (!matchesFilter) return false
      if (!normalizedQuery) return true

      const searchable = [
        categoryItem.title,
        categoryItem.description,
        ...categoryItem.nominees.flatMap((nomineeItem) => [
          nomineeItem.name,
          nomineeItem.handle,
          nomineeItem.tagline,
        ]),
      ]
        .join(' ')
        .toLocaleLowerCase('ru')

      return searchable.includes(normalizedQuery)
    })
  }, [categories, filter, query, votedCategories])

  const hasActiveFilters = filter !== 'all' || query.trim().length > 0

  const resetFilters = () => {
    setFilter('all')
    setQuery('')
  }

  return (
    <div className="nominations-page">
      <PageHero
        eyebrow="Первый сезон · 2026"
        title={
          <>
            {categories.length} номинаций.
            <br />
            <em>Выбери своих.</em>
          </>
        }
        description={`Голосуй за людей, проекты и мемы, которые сделали этот год. В каждой номинации — один голос.${voting.allowVoteChanges ? ' Выбор можно изменить до конца голосования.' : ''}`}
        ghost={String(categories.length)}
      />

      <section className="section nominations-section">
        <div className="container">
          <div className="nominations-toolbar">
            <SearchField value={query} onChange={setQuery} label="Найти номинацию" />
            <div className="filter-group" role="group" aria-label="Фильтр номинаций">
              {(Object.keys(filterLabels) as Filter[]).map((filterKey) => (
                <button
                  type="button"
                  className={`chip ${filter === filterKey ? 'is-active' : ''}`}
                  key={filterKey}
                  aria-pressed={filter === filterKey}
                  onClick={() => setFilter(filterKey)}
                >
                  {filterLabels[filterKey]}
                  <span className="chip__count">{filterCounts[filterKey]}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="results-meta" aria-live="polite">
            <p>
              {filteredCategories.length === 1
                ? 'Найдена 1 номинация'
                : `Найдено ${filteredCategories.length} номинаций`}
              {query.trim() && <span> по запросу «{query.trim()}»</span>}
            </p>
            {hasActiveFilters && (
              <button type="button" className="text-button" onClick={resetFilters}>
                Сбросить фильтры
              </button>
            )}
          </div>

          {filteredCategories.length > 0 ? (
            <div className="category-list">
              {filteredCategories.map((categoryItem) => (
                <CategoryRow category={categoryItem} key={categoryItem.id} />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <span className="empty-state__icon" aria-hidden="true">
                <SearchX size={26} />
              </span>
              <h2>{categories.length ? 'Здесь пока пусто' : 'Номинации пока не добавлены'}</h2>
              {hasActiveFilters && (
                <>
                  <p>Попробуйте другой запрос или сбросьте фильтры — все номинации на месте.</p>
                  <button type="button" className="button button--cream" onClick={resetFilters}>
                    Показать все номинации
                  </button>
                </>
              )}
            </div>
          )}

          <div className="nominations-help">
            <div>
              <span className="nominations-help__icon" aria-hidden="true">
                ?
              </span>
              <div>
                <h2>Не знаете, с чего начать?</h2>
                <p>
                  Откройте номинацию, прочитайте карточки номинантов и выберите того,
                  кто отозвался. Голос можно менять до конца голосования.
                </p>
              </div>
            </div>
            <Link to="/questions" className="link-inline">
              Как это работает
              <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
