import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Download,
  ImageDown,
  Pencil,
  Vote,
} from 'lucide-react'
import { PageHero } from '../components/PageHero'
import { CategoryIcon } from '../components/CategoryIcon'
import { NomineeArtwork } from '../components/NomineeArtwork'
import { groupLabels } from '../data/categories'
import { useVotes } from '../context/VotesContext'
import { useToast } from '../context/ToastContext'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { usePageTitle } from '../hooks/usePageTitle'
import { createVotesPoster } from '../lib/votesPoster'
import { AuthAction } from '../components/AuthAction'
import { fetchMyVotes } from '../lib/awardsApi'
import type { MyVote } from '../lib/awardsApi'

export function MyVotes() {
  usePageTitle('Мой голос')
  const { categories, auth, voting } = useVotes()
  const { showToast } = useToast()
  const downloadOnly = useMediaQuery('(max-width: 720px)')
  const [copying, setCopying] = useState(false)
  const [response, setResponse] = useState<{ accountId: string; records: MyVote[] }>()
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const accountId = auth.user?.id
  const records = response?.accountId === accountId ? response?.records : undefined
  const categoryById = new Map(categories.map((category) => [category.apiId, category]))

  useEffect(() => {
    if (!accountId) return
    const controller = new AbortController()
    fetchMyVotes(controller.signal).then(
      (records) => setResponse({ accountId, records }),
      (reason: unknown) => {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Не удалось загрузить голоса.')
      },
    )
    return () => controller.abort()
  }, [accountId, attempt])

  const downloadPoster = (blob: Blob) => {
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'itd-awards-2026-moy-golos.png'
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const handlePoster = async (mode: 'copy' | 'download') => {
    if (!records?.length || copying) return
    setCopying(true)

    try {
      const namesByCategory = new Map(records.map((record) => [record.nomination_id, record.nominee_name]))
      const ballot = categories.map((category) => ({
        title: category.title,
        nomineeName: namesByCategory.get(category.apiId),
      }))
      for (const record of records) {
        if (!categoryById.has(record.nomination_id)) {
          ballot.push({ title: record.nomination_title, nomineeName: record.nominee_name })
        }
      }
      const blob = await createVotesPoster(ballot)

      if (mode === 'download' || downloadOnly) {
        downloadPoster(blob)
        showToast('PNG с голосами скачан — прикрепите его к посту.', 'info')
        return
      }

      const canCopyImage =
        typeof ClipboardItem !== 'undefined' &&
        Boolean(navigator.clipboard?.write)

      if (canCopyImage) {
        try {
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
          showToast('Картинка с голосами скопирована. Можно вставлять в пост.')
        } catch {
          downloadPoster(blob)
          showToast('PNG с голосами скачан — прикрепите его к посту.', 'info')
        }
      } else {
        downloadPoster(blob)
        showToast('PNG с голосами скачан — прикрепите его к посту.', 'info')
      }
    } catch {
      showToast('Не удалось собрать картинку. Попробуйте ещё раз.', 'error')
    } finally {
      setCopying(false)
    }
  }

  return (
    <div className="my-votes-page">
      <PageHero
        eyebrow="Личный прогресс"
        title={
          <>
            Мой <em>голос.</em>
          </>
        }
        description={`Здесь собрано всё, что вы уже выбрали. Голоса сохраняются в вашем аккаунте.${voting.allowVoteChanges ? ' Голос можно изменить до конца голосования.' : ''}`}
        ghost="2026"
      />

      <section className="section my-votes-section">
        <div className="container">
          {accountId && !records ? (
            <div className="empty-state" role={error ? 'alert' : 'status'}>
              <h2>{error ? 'Не удалось загрузить голоса' : 'Загружаем голоса…'}</h2>
              {error && (
                <>
                  <p>{error}</p>
                  <button type="button" className="button button--gold" onClick={() => {
                    setError('')
                    setAttempt(attempt + 1)
                  }}>Повторить</button>
                </>
              )}
            </div>
          ) : accountId && records?.length ? (
            <>
              <div className="my-votes-head">
                <div>
                  <p className="eyebrow">Ваши выборы</p>
                  <h2 className="display">Уже в списке</h2>
                </div>
                <div className="my-votes-head__side">
                  {!downloadOnly && (
                    <button
                      type="button"
                      className="button button--gold button--sm"
                      onClick={() => handlePoster('copy')}
                      disabled={copying}
                    >
                      {copying ? 'Собираю…' : 'Скопировать картинкой'}
                      <ImageDown size={15} aria-hidden="true" />
                    </button>
                  )}
                  <button
                    type="button"
                    className="button button--ghost button--sm"
                    onClick={() => handlePoster('download')}
                    disabled={copying}
                  >
                    {copying ? 'Собираю…' : 'Скачать картинку'}
                    <Download size={15} aria-hidden="true" />
                  </button>
                  <span className="my-votes-head__deadline">
                    Все {categories.length} номинаций — в одном PNG для поста
                  </span>
                </div>
              </div>

              <div className="votes-grid">
                {records.map((record) => {
                  const category = categoryById.get(record.nomination_id)
                  const href = category ? `/nominations/${category.id}` : null
                  const nominee = category?.nominees.find((item) => item.id === String(record.nominee_id))
                  const canChange = category?.canVote && voting.allowVoteChanges
                  return (
                    <article className="vote-card" key={record.nomination_id}>
                      <div className="vote-card__head">
                        <span className="vote-card__icon" aria-hidden="true">
                          <CategoryIcon id={category?.id ?? ''} size={24} />
                        </span>
                        <div className="vote-card__title">
                          <span>{category ? groupLabels[category.group] : 'Архив'}</span>
                          <h2>
                            {href ? <Link to={href}>{record.nomination_title}</Link> : record.nomination_title}
                          </h2>
                        </div>
                        <span className="vote-card__check" aria-hidden="true">
                          <Check size={17} strokeWidth={3} />
                        </span>
                      </div>

                      <ul className="vote-card__picks">
                        <li>
                          {nominee && category && (
                            <span className="vote-card__pick-art" aria-hidden="true">
                              <NomineeArtwork nominee={nominee} categoryId={category.id} />
                            </span>
                          )}
                          <span className="vote-card__pick-check" aria-hidden="true">
                            <Check size={11} strokeWidth={3} />
                          </span>
                          <span>
                            <strong>{record.nominee_name}</strong>
                            {nominee?.handle && <small>{nominee.handle}</small>}
                          </span>
                        </li>
                      </ul>

                      <div className="vote-card__foot">
                        <span>Голос учтён</span>
                        {href && (
                          <Link to={href} className="vote-card__edit">
                            {canChange ? 'Изменить' : 'К номинации'}
                            {canChange ? <Pencil size={13} aria-hidden="true" /> : <ArrowUpRight size={13} aria-hidden="true" />}
                          </Link>
                        )}
                      </div>
                    </article>
                  )
                })}
              </div>

              <div className="my-votes-actions">
                <Link to="/nominations" className="button button--ghost">
                  Продолжить голосование
                  <ArrowRight size={17} aria-hidden="true" />
                </Link>
              </div>
            </>
          ) : (
            <div className="empty-state empty-state--large">
              <span className="empty-state__icon" aria-hidden="true">
                <Vote size={30} />
              </span>
              <p className="eyebrow">Пока пусто</p>
              <h2>{accountId ? 'Голос ещё не отдан' : 'Войдите, чтобы увидеть свои голоса'}</h2>
              <p>
                {accountId
                  ? 'Выберите хотя бы одну номинацию — и здесь появится ваш личный список победителей.'
                  : 'Войдите через Telegram, чтобы открыть сохранённые выборы.'}
              </p>
              <div className="empty-state__actions">
                {accountId ? (
                  <Link to="/nominations" className="button button--gold">
                    Выбрать номинантов
                    <ArrowUpRight size={17} aria-hidden="true" />
                  </Link>
                ) : <AuthAction className="button button--gold" />}
                <Link to="/questions" className="button button--ghost">
                  Как это работает
                </Link>
              </div>
            </div>
          )}

          <div className="my-votes-note">
            <Link to="/questions#faq" className="link-inline">
              Вопросы и ответы
              <ArrowUpRight size={14} aria-hidden="true" />
            </Link>
            {accountId && <AuthAction className="button button--ghost button--sm" />}
          </div>
        </div>
      </section>
    </div>
  )
}
