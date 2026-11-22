import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import type { RefObject } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCircle2,
  Clock3,
  Info,
  Maximize2,
  Music2,
  Pencil,
  Share2,
  X,
} from 'lucide-react'
import type { Category, Nominee } from '../data/categories'
import { categoryStatusLabel, groupLabels } from '../data/categories'
import { eventDateLabel } from '../data/event'
import { useVotes } from '../context/VotesContext'
import { useToast } from '../context/ToastContext'
import { usePageTitle } from '../hooks/usePageTitle'
import { CategoryIcon } from '../components/CategoryIcon'
import { CategoryImage } from '../components/CategoryImage'
import { NomineeArtwork } from '../components/NomineeArtwork'
import { getNomineeVisual } from '../lib/nomineeVisual'
import { NomineeLightbox } from '../components/NomineeLightbox'
import type { LightboxItem } from '../components/NomineeLightbox'
import { TrackPlayer } from '../components/TrackPlayer'
import { fetchResults } from '../lib/awardsApi'
import type { ResultEntry } from '../lib/awardsApi'
import { formatNumber, pluralize } from '../lib/format'
import { NotFound } from './NotFound'
import { JuryReview } from '../components/JuryReview'

function shuffleNominees(nominees: Nominee[]): Nominee[] {
  const result = [...nominees]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    const current = result[index]
    result[index] = result[swapIndex]
    result[swapIndex] = current
  }
  return result
}

export function CategoryDetail() {
  const { categoryId } = useParams()
  const { categories } = useVotes()
  const category = categories.find((item) => item.id === categoryId || String(item.apiId) === categoryId)
  usePageTitle(category ? category.title : 'Номинация не найдена')

  if (!category) return <NotFound />

  return <CategoryView category={category} key={category.id} />
}

function CategoryView({ category }: { category: Category }) {
  const { categories, votes, voteNames, saveVote, auth, voting } = useVotes()
  const { showToast } = useToast()
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const savedPick = votes[category.id]
  const saved = savedPick !== undefined
  const [draft, setDraft] = useState(() => {
    const pending = searchParams.get('nominee')
    return category.nominees.find((item) => item.id === pending)?.id
  })
  const [changing, setChanging] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const firstNomineeRef = useRef<HTMLButtonElement>(null)
  const [trackOrder] = useState(() => category.id === 'track-goda' ? shuffleNominees(category.nominees).map((item) => item.id) : null)
  const orderedNominees = trackOrder
    ? [...category.nominees].sort((first, second) => trackOrder.indexOf(first.id) - trackOrder.indexOf(second.id))
    : category.nominees
  const fewNomineesClass = orderedNominees.length > 0 && orderedNominees.length < 4
    ? ` nominee-list--few-${orderedNominees.length}`
    : ''
  const canVote = category.canVote && category.nominees.length > 0
  const editing = canVote && (!saved || (voting.allowVoteChanges && changing))
  const selectedId = editing ? draft : savedPick
  const selectedNominee = orderedNominees.find((item) => item.id === selectedId)
  const selectedName = selectedNominee?.name ?? (!editing && saved ? voteNames[category.id] : undefined)
  const status = categoryStatusLabel(category)
  const deadline = category.canVote ? eventDateLabel(voting.endsAt) : null
  const currentIndex = categories.findIndex((categoryItem) => categoryItem.id === category.id)
  const previousCategory = categories[(currentIndex - 1 + categories.length) % categories.length]
  const nextCategory = categories[(currentIndex + 1) % categories.length]
  const lightboxItems: LightboxItem[] = orderedNominees.map((nomineeItem) => ({
    nominee: nomineeItem,
    categoryId: category.id,
    category: category.title,
  }))
  const openLightbox = (nomineeId: string) => {
    const index = orderedNominees.findIndex((nomineeItem) => nomineeItem.id === nomineeId)
    if (index >= 0) setLightboxIndex(index)
  }

  const toggleNominee = (nomineeId: string) => {
    if (!editing || saving) return
    setError('')
    setDraft(nomineeId)
  }

  const handleSave = async () => {
    if (!editing || saving) return
    if (!selectedNominee) {
      setError('Выберите номинанта — без этого голос не сохранится.')
      firstNomineeRef.current?.focus()
      return
    }

    if (!auth.user) {
      const params = new URLSearchParams(searchParams)
      params.set('nominee', selectedNominee.id)
      const returnTo = new URLSearchParams({ return_to: `/nominations/${category.id}?${params}` })
      navigate(`/sign-in?${returnTo}`, { state: { backgroundLocation: location } })
      return
    }

    setSaving(true)
    setError('')
    try {
      await saveVote(category, selectedNominee.id)
      setChanging(false)
      if (searchParams.has('nominee')) {
        const params = new URLSearchParams(searchParams)
        params.delete('nominee')
        setSearchParams(params, { replace: true })
      }
      showToast('Голос учтён.')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Не удалось сохранить голос.')
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = () => {
    setDraft(savedPick)
    setChanging(true)
    setError('')
  }

  const handleCancelEdit = () => {
    setDraft(savedPick)
    setChanging(false)
    setError('')
  }

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      showToast('Ссылка на номинацию скопирована.', 'info')
    } catch {
      showToast('Не удалось скопировать ссылку.', 'error')
    }
  }

  return (
    <div className="category-page">
      <header className="category-head">
        <div className="container">
          <nav className="crumbs" aria-label="Хлебные крошки">
            <span className="crumbs__item">
              <Link to="/">Главная</Link>
            </span>
            <span className="crumbs__item">
              <span className="crumbs__separator" aria-hidden="true">
                /
              </span>
              <Link to="/nominations">Номинации</Link>
            </span>
            <span className="crumbs__item">
              <span className="crumbs__separator" aria-hidden="true">
                /
              </span>
              <span>{category.title}</span>
            </span>
          </nav>

          <div className="category-head__grid">
            <div className="category-head__content">
              <div className="category-head__title-row">
                <span className="category-head__icon" aria-hidden="true">
                  <CategoryImage category={category} size={30} />
                </span>
                <div>
                  <p className="eyebrow">
                    {groupLabels[category.group]} · Один выбор
                  </p>
                  <h1 className="category-title">{category.title}</h1>
                </div>
              </div>
              <p className="category-description">{category.description}</p>
              <div className="meta-pills">
                <span className="meta-pill">
                  <CheckCircle2 size={14} aria-hidden="true" />
                  Один голос
                </span>
                <span className="meta-pill">
                  <Clock3 size={14} aria-hidden="true" />
                  {deadline ? `до ${deadline}` : status}
                </span>
                <button type="button" className="meta-pill meta-pill--button" onClick={handleShare}>
                  <Share2 size={14} aria-hidden="true" />
                  Поделиться
                </button>
              </div>
            </div>

            <aside className="category-head__aside" aria-label="Информация о голосовании">
              <div className="category-note">
                <span className="category-note__icon" aria-hidden="true">
                  <Info size={18} />
                </span>
                <div>
                  <span className="category-note__label">Формат номинации</span>
                  <p>{voting.allowVoteChanges ? 'Выберите одного номинанта. Голос можно изменить до конца голосования.' : 'Выберите одного номинанта.'}</p>
                </div>
              </div>
              <div className="category-note category-note--status">
                {category.canVote && <span className="status-dot" aria-hidden="true" />}
                <div>
                  <span className="category-note__label">{status}</span>
                  {deadline && <p>До {deadline}</p>}
                  {category.resultsAvailable && <a href="#nomination-results" className="link-inline">Смотреть результаты</a>}
                </div>
              </div>
            </aside>
          </div>
        </div>
      </header>

      <section className="section category-vote-section">
        <div className="container">
          <div className="vote-layout">
            <div className="vote-layout__head">
              {saved && editing && (
                <div className="saved-strip saved-strip--editing">
                  <Pencil size={17} aria-hidden="true" />
                  <span>Режим редактирования. Сохраните новый выбор или отмените изменения.</span>
                  <button
                    type="button"
                    className="saved-strip__button"
                    onClick={handleCancelEdit}
                    disabled={saving}
                  >
                    <X size={13} aria-hidden="true" />
                    Отменить
                  </button>
                </div>
              )}

              <div className="vote-list-head">
                <h2>Номинанты</h2>
                <div className="selection-count" aria-live="polite">
                  <span>{selectedId ? 'Номинант выбран' : 'Голос не отдан'}</span>
                </div>
              </div>
            </div>

            <div className="vote-layout__cards">
              <div className={`nominee-list${fewNomineesClass}`}>
                {orderedNominees.map((nomineeItem, index) => {
                  const isSelected = selectedId === nomineeItem.id
                  return (
                    <NomineeCard
                      key={nomineeItem.id}
                      nominee={nomineeItem}
                      categoryId={category.id}
                      selected={isSelected}
                      editing={editing && !saving}
                      index={index}
                      onToggle={() => toggleNominee(nomineeItem.id)}
                      onOpenLightbox={() => openLightbox(nomineeItem.id)}
                      buttonRef={index === 0 ? firstNomineeRef : undefined}
                    />
                  )
                })}
              </div>

              {category.nominees.length === 0 && <p>Номинанты пока не добавлены.</p>}
              {editing && (
                <p className="nominee-list__note">
                  Нажмите на карточку, чтобы отметить выбор.
                </p>
              )}
            </div>

            <div className={`vote-panels${auth.user?.role === 'JURY' ? ' vote-panels--jury' : ''}`}>
              <aside className="vote-panel" aria-labelledby="vote-panel-title">
                <div className="vote-panel__intro">
                  <div className="vote-panel__head">
                    <p className="eyebrow">Ваш голос</p>
                  </div>

                  <h2 id="vote-panel-title">
                    {saved && !editing ? 'Голос учтён' : editing ? 'Сделайте выбор' : status}
                  </h2>
                </div>

                <ul className="picked-list">
                  {selectedName ? (
                    <li>
                      <span className="picked-list__check" aria-hidden="true">
                        <Check size={12} strokeWidth={3} />
                      </span>
                      <span className="picked-list__name">{selectedName}</span>
                      {editing && !saving && (
                        <button
                          type="button"
                          className="picked-list__remove"
                          onClick={() => setDraft(undefined)}
                          aria-label={`Убрать ${selectedName} из выбора`}
                        >
                          <X size={13} aria-hidden="true" />
                        </button>
                      )}
                    </li>
                  ) : (
                    <li className="picked-list__empty">
                      {editing ? 'Пока пусто — выберите номинанта.' : saved ? 'Голос сохранён.' : 'Голос не отдан.'}
                    </li>
                  )}
                </ul>

                <div className="vote-panel__action">
                  {error && (
                    <p className="form-error" role="alert">
                      {error}
                    </p>
                  )}

                  {editing && (
                    <button type="button" className="button button--gold vote-panel__button" onClick={handleSave} disabled={saving}>
                      {saving ? 'Сохраняем…' : 'Сохранить голос'}
                      <Check size={17} aria-hidden="true" />
                    </button>
                  )}
                  {canVote && saved && !editing && voting.allowVoteChanges && (
                    <button
                      type="button"
                      className="button button--ghost vote-panel__button"
                      onClick={handleEdit}
                    >
                      Изменить голос
                      <Pencil size={15} aria-hidden="true" />
                    </button>
                  )}
                </div>
              </aside>
              {auth.user?.role === 'JURY' && (
                <JuryReview
                  categoryId={category.apiId}
                  nominees={category.nominees.map(({ id, name }) => ({ id, name }))}
                />
              )}
            </div>
          </div>

          <nav className="category-pagination" aria-label="Другие номинации">
            <Link
              to={`/nominations/${previousCategory.id}`}
              className="category-pagination__link"
            >
              <span className="category-pagination__label">
                <ArrowLeft size={14} aria-hidden="true" />
                Предыдущая
              </span>
              <strong>
                <span aria-hidden="true">
                  <CategoryIcon id={previousCategory.id} size={18} />
                </span>
                {previousCategory.title}
              </strong>
            </Link>
            <Link
              to={`/nominations/${nextCategory.id}`}
              className="category-pagination__link category-pagination__link--next"
            >
              <span className="category-pagination__label">
                Следующая
                <ArrowRight size={14} aria-hidden="true" />
              </span>
              <strong>
                <span aria-hidden="true">
                  <CategoryIcon id={nextCategory.id} size={18} />
                </span>
                {nextCategory.title}
              </strong>
            </Link>
          </nav>
        </div>
      </section>

      {category.resultsAvailable && <CategoryResults category={category} savedPick={savedPick} />}

      {lightboxIndex !== null && lightboxItems[lightboxIndex] && (
        <NomineeLightbox
          items={lightboxItems}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNavigate={setLightboxIndex}
        />
      )}

    </div>
  )
}

type NomineeCardProps = {
  nominee: Nominee
  categoryId: string
  selected: boolean
  editing: boolean
  index: number
  onToggle: () => void
  onOpenLightbox: () => void
  buttonRef?: RefObject<HTMLButtonElement | null>
}

function NomineeCard({
  nominee,
  categoryId,
  selected,
  editing,
  index,
  onToggle,
  onOpenLightbox,
  buttonRef,
}: NomineeCardProps) {
  const visual = getNomineeVisual(categoryId, nominee)
  const number = String(index + 1).padStart(2, '0')
  const profileUrl = nominee.linkUrl !== nominee.audio ? nominee.linkUrl : null

  return (
    <article
      className={`nominee nominee--${visual} ${selected ? 'is-selected' : ''} ${editing ? '' : 'is-locked'
        }`}
    >
      <button
        ref={buttonRef}
        type="button"
        className="nominee__toggle"
        aria-pressed={selected}
        aria-label={selected ? `${nominee.name} — выбран` : `Выбрать ${nominee.name}`}
        disabled={!editing}
        onClick={onToggle}
      />

      <div className="nominee__media">
        {visual === 'photo' ? (
          <NomineeArtwork
            nominee={nominee}
            categoryId={categoryId}
            className="nominee__photo-img"
          />
        ) : (
          <span className="nominee__art" aria-hidden="true">
            <NomineeArtwork nominee={nominee} categoryId={categoryId} />
          </span>
        )}

        <button
          type="button"
          className="nominee__zoom"
          onClick={onOpenLightbox}
          aria-label={`Открыть изображение крупнее: ${nominee.photoAlt ?? nominee.name}`}
        >
          <Maximize2 size={13} aria-hidden="true" />
          Увеличить
        </button>

        <span className="nominee__number" aria-hidden="true">
          {number}
        </span>
        <span className="nominee__control" aria-hidden="true">
          {selected && <Check size={15} strokeWidth={3} />}
        </span>
      </div>

      <div className="nominee__body">
        <h3 className="nominee__name nominee__name--below">{nominee.name}</h3>
        {profileUrl ? (
          <a className="nominee__profile nominee__profile--below" href={profileUrl} target="_blank" rel="noreferrer">
            {nominee.handle || 'Открыть ссылку'}
            <ArrowUpRight size={10} aria-hidden="true" />
          </a>
        ) : nominee.handle && <span className="nominee__profile nominee__profile--below">{nominee.handle}</span>}
        {nominee.song && (
          <span className="nominee__song">
            <Music2 size={11} aria-hidden="true" />
            Песня: {nominee.song}
          </span>
        )}
        {nominee.audio && <TrackPlayer src={nominee.audio} title={nominee.name} />}
      </div>
    </article>
  )
}

function CategoryResults({ category, savedPick }: { category: Category; savedPick?: string }) {
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

  const totals = results?.reduce((sum, entry) => ({
    accounts: sum.accounts + entry.vote_count,
    users: sum.users + entry.user_votes,
    jury: sum.jury + entry.jury_votes,
    points: sum.points + entry.weighted_score,
  }), { accounts: 0, users: 0, jury: 0, points: 0 })

  return (
    <section className="section" id="nomination-results" aria-labelledby="nomination-results-title">
      <div className="container">
        <article className="result-card">
          <div className="result-card__head">
            <span className="result-card__icon" aria-hidden="true"><CategoryIcon id={category.id} size={22} /></span>
            <div className="result-card__title-wrap">
              <h2 id="nomination-results-title">Итоги номинации</h2>
              {totals && (
                <p>
                  {formatNumber(totals.accounts)} {pluralize(totals.accounts, 'аккаунт', 'аккаунта', 'аккаунтов')}
                  {' · Обычные голоса: '}{formatNumber(totals.users)}{' · Голоса жюри: '}{formatNumber(totals.jury)}
                </p>
              )}
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
          {results && totals && (totals.points > 0 ? (
            <ol className="result-list">
              {results.map((entry, index) => {
                const picked = String(entry.id) === savedPick
                return (
                  <li key={entry.id} className={`result-row ${picked ? 'is-picked' : ''}`}>
                    <span className="result-row__rank" aria-hidden="true">{index + 1}</span>
                    <div className="result-row__main">
                      <div className="result-row__label">
                        <span className="result-row__name">
                          {entry.name}
                          {picked && <span className="result-row__pick"><Check size={11} aria-hidden="true" /> ваш голос</span>}
                        </span>
                        <span className="result-row__percent">
                          {formatNumber(entry.weighted_score)} {pluralize(entry.weighted_score, 'балл', 'балла', 'баллов')}
                        </span>
                      </div>
                      <div className="result-bar" aria-hidden="true">
                        <span style={{ width: `${Math.round(entry.weighted_score / totals.points * 100)}%` }} />
                      </div>
                    </div>
                  </li>
                )
              })}
            </ol>
          ) : <p>Голосов в этой номинации нет.</p>)}
        </article>
      </div>
    </section>
  )
}
