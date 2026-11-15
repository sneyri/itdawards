import { Link } from 'react-router-dom'
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCircle2,
  Vote,
} from 'lucide-react'
import { PageHero } from '../components/PageHero'
import { CategoryIcon } from '../components/CategoryIcon'
import { ProgressCard } from '../components/ProgressCard'
import { groupLabels } from '../data/categories'
import { useVotes } from '../context/VotesContext'
import { usePageTitle } from '../hooks/usePageTitle'
import { AuthAction } from '../components/AuthAction'

export function MyVotes() {
  usePageTitle('Мой голос')
  const { categories, votes, votedCount, auth } = useVotes()
  const needsLogin = auth.mode === 'account' && auth.available && !auth.signedIn
  const authUnavailable = auth.mode === 'unavailable' || !auth.available
  const browserVoting = auth.mode === 'anonymous' || auth.mode === 'demo'

  const savedCategories = categories.filter((categoryItem) => votes[categoryItem.id])

  return (
    <div className="my-votes-page">
      <PageHero
        eyebrow="Личный прогресс"
        title={
          <>
            Мой <em>голос.</em>
          </>
        }
        description={browserVoting ? 'Голоса, сохранённые с этого браузера.' : 'Голоса, сохранённые в вашем аккаунте.'}
        ghost="2026"
        aside={<ProgressCard value={votedCount} total={categories.length} label="Голосование" />}
      />

      <section className="section my-votes-section">
        <div className="container">
          {savedCategories.length > 0 ? (
            <>
              <div className="my-votes-head">
                <div>
                  <p className="eyebrow">Ваши выборы</p>
                  <h2 className="display">Уже в списке</h2>
                </div>
                <div className="my-votes-head__side">
                  <span className="progress-note">
                    <CheckCircle2 size={15} aria-hidden="true" />
                    {votedCount} из {categories.length} номинаций
                  </span>
                </div>
              </div>

              <div className="votes-grid">
                {savedCategories.map((categoryItem) => {
                  const picks = categoryItem.nominees.filter((nomineeItem) =>
                    votes[categoryItem.id] === nomineeItem.id,
                  )
                  return (
                    <article className="vote-card" key={categoryItem.id}>
                      <div className="vote-card__head">
                        <span className="vote-card__icon" aria-hidden="true">
                          <CategoryIcon id={categoryItem.id} size={24} />
                        </span>
                        <div className="vote-card__title">
                          <span>{groupLabels[categoryItem.group]}</span>
                          <h2>
                            <Link to={`/nominations/${categoryItem.id}`}>
                              {categoryItem.title}
                            </Link>
                          </h2>
                        </div>
                        <span className="vote-card__check" aria-hidden="true">
                          <Check size={17} strokeWidth={3} />
                        </span>
                      </div>

                      <ul className="vote-card__picks">
                        {picks.map((nomineeItem) => (
                          <li key={nomineeItem.id}>
                            <span className="vote-card__pick-check" aria-hidden="true">
                              <Check size={11} strokeWidth={3} />
                            </span>
                            <span>
                              <strong>{nomineeItem.name}</strong>
                            </span>
                          </li>
                        ))}
                      </ul>

                      <div className="vote-card__foot">
                        <span>Голос учтён</span>
                        <Link to={`/nominations/${categoryItem.id}`} className="vote-card__edit">
                          К номинации
                          <ArrowUpRight size={13} aria-hidden="true" />
                        </Link>
                      </div>
                    </article>
                  )
                })}
              </div>

              <div className="my-votes-actions">
                <Link to="/nominations" className="button button--gold">
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
              <h2>{needsLogin ? 'Войдите, чтобы увидеть свои голоса' : authUnavailable ? 'Вход сейчас недоступен' : 'Голос ещё не отдан'}</h2>
              {needsLogin ? <AuthAction className="button button--gold" /> : !authUnavailable && <>
              <p>
                Выберите хотя бы одну номинацию — и здесь появится ваш личный список
                победителей. Начать можно с любой категории.
              </p>
              <div className="empty-state__actions">
                <Link to="/nominations" className="button button--gold">
                  Выбрать номинантов
                  <ArrowUpRight size={17} aria-hidden="true" />
                </Link>
                <Link to="/results" className="button button--ghost">
                  Смотреть результаты
                </Link>
              </div>
              </>}
            </div>
          )}

          <div className="my-votes-note">
            <p>
              {browserVoting ? 'Сервер узнаёт ваши голоса по cookie в этом браузере.' : 'Ваши голоса доступны после входа.'}
            </p>
            <Link to="/about#faq" className="link-inline">
              Вопросы и ответы
              <ArrowUpRight size={14} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
