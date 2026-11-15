import { Link } from 'react-router-dom'
import { ArrowUpRight, Sparkles, Trophy } from 'lucide-react'
import { PageHero } from '../components/PageHero'
import { Reveal } from '../components/Reveal'
import { CategoryIcon } from '../components/CategoryIcon'
import { groupLabels } from '../data/categories'
import { useVotes } from '../context/VotesContext'
import { EVENT } from '../data/event'
import { usePageTitle } from '../hooks/usePageTitle'
import { pluralize } from '../lib/format'

export function Ceremony() {
  const { categories } = useVotes()
  usePageTitle('Церемония')

  return (
    <div className="ceremony-page">
      <PageHero
        eyebrow="Церемония"
        title={
          <>
            Первый сезон.
            <br />
            <em>Первые имена.</em>
          </>
        }
        description={`${EVENT.ceremonyLabel} подведём итоги первого сезона ITD AWARDS.`}
        ghost="2026"
        aside={
          <div className="ceremony-year">
            <span className="ceremony-year__label">Церемония</span>
            <strong>27.12</strong>
            <span>19:00 MSK · первый сезон</span>
          </div>
        }
      />

      <section className="section ceremony-highlight">
        <div className="container">
          <Reveal>
            <div className="ceremony-banner">
              <div className="ceremony-banner__copy">
                <p className="eyebrow eyebrow--dark">27 декабря 2026 · 19:00 MSK</p>
                <h2>
                  Вечер, когда сообщество
                  <br />
                  <em>назовёт своих.</em>
                </h2>
                <p>
                  На церемонии объявим победителей в каждой номинации.
                </p>
              </div>
              <div className="ceremony-banner__badge" aria-hidden="true">
                <Trophy size={32} strokeWidth={1.4} />
                <span>{categories.length}</span>
                <small>номинаций</small>
              </div>
              <Sparkles className="ceremony-banner__spark" size={24} aria-hidden="true" />
            </div>
          </Reveal>

          <div className="winners-grid">
            {categories.map((categoryItem, index) => (
              <Reveal key={categoryItem.id} delay={index * 35}>
                <Link
                  to={`/nominations/${categoryItem.id}`}
                  className="winner-card ceremony-card"
                >
                  <span className="winner-card__icon-tile" aria-hidden="true">
                    <CategoryIcon id={categoryItem.id} size={23} />
                  </span>
                  <span className="winner-card__body">
                    <span className="winner-card__category">
                      {groupLabels[categoryItem.group]}
                    </span>
                    <h2>{categoryItem.title}</h2>
                    <span className="winner-card__handle">
                      {categoryItem.nominees.length}{' '}
                      {pluralize(
                        categoryItem.nominees.length,
                        'номинант',
                        'номинанта',
                        'номинантов',
                      )}
                    </span>
                  </span>
                  <span className="winner-card__icon" aria-hidden="true">
                    <ArrowUpRight size={17} />
                  </span>
                </Link>
              </Reveal>
            ))}
          </div>

          <p className="ceremony-note">
            Победители первого сезона будут объявлены на церемонии 27 декабря 2026 года.
          </p>
        </div>
      </section>

      <section className="section ceremony-chronicle">
        <div className="container">
          <div className="ceremony-cta">
            <div>
              <p className="eyebrow">Не пропустите</p>
              <h2>Ваш голос решает, кто выйдет на сцену первым.</h2>
            </div>
            <Link to="/nominations" className="button button--gold">
              Выбрать победителей
              <ArrowUpRight size={17} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
