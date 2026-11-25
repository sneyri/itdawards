import { useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Clock3,
  ListChecks,
  Sparkles,
  Trophy,
  Vote,
} from 'lucide-react'
import { EVENT, eventDateLabel } from '../data/event'
import { useVotes } from '../context/VotesContext'
import { usePageTitle } from '../hooks/usePageTitle'
import { CategoryRow } from '../components/CategoryRow'
import { CatalogueStatus } from '../components/CatalogueStatus'
import { Countdown } from '../components/Countdown'
import { DeadlineDate } from '../components/DeadlineDate'
import { Reveal } from '../components/Reveal'

const featuredIds = [
  'king-itd',
  'queen-itd',
  'artist-goda',
  'meme-goda',
  'track-goda',
  'event-goda',
]

const wordmarkLines = [
  { text: 'ITD', modifier: 'itd' },
  { text: 'AWARDS', modifier: 'awards' },
  { text: '2026', modifier: 'year' },
]

export function Home() {
  usePageTitle('ITD AWARDS 2026')
  const { categories, votedCount, voting, votingReady, index, votes, voteNames } = useVotes()
  const featuredCategories = useMemo(() => categories.filter((categoryItem) =>
    featuredIds.includes(categoryItem.id),
  ), [categories])
  const tickerItems = useMemo(() => [...categories, ...categories], [categories])
  const deadline = eventDateLabel(voting.endsAt)
  const deadlineText = !votingReady ? '—' : voting.open ? deadline ?? 'Открыто' : voting.resultsPublished ? 'Итоги опубликованы' : 'Закрыто'
  const [weirdDate] = useState(() => Math.random() < 0.1)
  const ceremony = eventDateLabel(EVENT.ceremonyAt)
  const voteLabel = voting.open
    ? votedCount > 0 ? 'Продолжить голосование' : 'Отдать голос'
    : 'Смотреть номинации'
  const steps = [
    {
      icon: ListChecks,
      date: 'Номинации',
      title: 'Номинанты собраны',
      text: 'Сообщество предложило людей, проекты, мемы и события. Первый этап завершён — список сезона зафиксирован.',
      tag: 'Этап I · завершён',
    },
    {
      icon: Vote,
      date: deadline ? `До ${deadline}` : 'Голосование',
      title: 'Выбери своих',
      text: voting.allowVoteChanges
        ? 'В каждой номинации — один голос. Выбор можно изменить до конца голосования.'
        : 'В каждой номинации — один голос.',
      tag: voting.open ? 'Этап II · сейчас' : 'Этап II',
    },
    {
      icon: Trophy,
      date: ceremony ?? 'Церемония',
      title: 'Дождись золота',
      text: ceremony ? `Объявим первых победителей ${ceremony}.` : 'Объявим победителей на церемонии.',
      tag: 'Этап III · финал',
    },
  ]

  return (
    <div className="home">
      <section className="hero">
        <div className="hero__glow" aria-hidden="true" />
        <div className="hero__grid-bg" aria-hidden="true" />
        <Sparkles className="hero__spark hero__spark--one" size={22} aria-hidden="true" />
        <Sparkles className="hero__spark hero__spark--two" size={15} aria-hidden="true" />
        <Sparkles className="hero__spark hero__spark--three" size={28} aria-hidden="true" />
        <Sparkles className="hero__spark hero__spark--four" size={13} aria-hidden="true" />

        <div className="container hero__inner">
          <div className="hero__meta">
            <span>ПЕРВЫЙ СЕЗОН</span>
            <span className="hero__meta-center">ITD COMMUNITY AWARDS</span>
            <span>{EVENT.edition} / {EVENT.year}</span>
          </div>

          <div className="hero__content">
            <p className="hero__eyebrow">
              <Sparkles size={13} aria-hidden="true" />
              Первая премия сообщества · 2026
              <Sparkles size={13} aria-hidden="true" />
            </p>

            <h1 className="hero-wordmark" aria-label="ITD AWARDS 2026">
              {wordmarkLines.map((line, lineIndex) => {
                const offset = wordmarkLines
                  .slice(0, lineIndex)
                  .reduce((total, item) => total + item.text.length, 0)

                return (
                  <span
                    className={`hero-wordmark__line hero-wordmark__line--${line.modifier}`}
                    aria-hidden="true"
                    key={line.text}
                  >
                    {[...line.text].map((letter, letterIndex) => (
                      <span
                        className="hero-wordmark__letter"
                        style={{ '--letter': offset + letterIndex } as CSSProperties}
                        key={`${letter}-${letterIndex}`}
                      >
                        {letter}
                      </span>
                    ))}
                  </span>
                )
              })}
            </h1>

            <p className="hero__lead">
              Голосуй за тех, кто сделал этот год <em>громче</em>.
            </p>

            <div className="hero__actions">
              <Link to="/nominations" className="button button--gold button--lg">
                {voteLabel}
                <ArrowUpRight size={18} aria-hidden="true" />
              </Link>
              <a href="#how" className="button button--ghost button--lg">
                Как это работает
              </a>
            </div>

            <div className="hero__deadline">
              <div className="hero__deadline-label">
                <Clock3 size={18} aria-hidden="true" />
                <span>
                  {deadline && voting.open ? 'До закрытия голосования' : 'Голосование'}
                  <DeadlineDate text={deadlineText} weird={weirdDate} className="hero__deadline-date--inline" />
                </span>
              </div>
              {voting.open && voting.endsAt && deadline && <Countdown target={voting.endsAt} />}
              <DeadlineDate text={deadlineText} weird={weirdDate} className="hero__deadline-date--below" />
            </div>
          </div>

          <div className="hero__bottom">
            <span>{categories.length} номинаций</span>
            <a href="#nominations">
              Выбрать победителей
              <ArrowDown size={14} aria-hidden="true" />
            </a>
          </div>
        </div>
      </section>

      <div className="ticker" aria-hidden="true">
        <div className="ticker__track">
          {tickerItems.map((categoryItem, index) => (
            <span className="ticker__item" key={`${categoryItem.id}-${index}`}>
              {categoryItem.title}
              <Sparkles className="ticker__star" size={11} aria-hidden="true" />
            </span>
          ))}
        </div>
      </div>

      <section className="section intro">
        <div className="container intro__grid">
          <Reveal>
            <p className="eyebrow">Первый сезон</p>
            <h2 className="display display--lg">
              Не просто премия.
              <br />
              <em>Точка сборки</em> сообщества.
            </h2>
          </Reveal>
          <Reveal delay={80}>
            <p className="intro__copy">
              ITD AWARDS — первая премия сообщества. Здесь мы говорим «спасибо»
              тем, кто наполнял ленту. Побеждают не по количеству
              подписчиков, а по тому, кого действительно помнит сообщество.
            </p>
            <div className="stat-strip">
              <div className="stat">
                <strong>{categories.length}</strong>
                <span>номинаций</span>
              </div>
              <div className="stat">
                <strong>01</strong>
                <span>голос в каждой номинации</span>
              </div>
            </div>
            <Link to="/questions" className="link-inline">
              Частые вопросы
              <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </Reveal>
        </div>
      </section>

      <section className="section section--categories" id="nominations">
        <div className="container">
          <div className="section-head">
            <div>
              <p className="eyebrow">Голосование 2026</p>
              <h2 className="display">Выбери своих</h2>
            </div>
            <div className="section-head__side">
              <Link to="/nominations" className="link-inline">
                Все {categories.length} номинаций
                <ArrowUpRight size={15} aria-hidden="true" />
              </Link>
            </div>
          </div>

          <Reveal>
            <div className="category-list">
              {featuredCategories.map((categoryItem) => (
                <CategoryRow category={categoryItem} isVoted={Boolean(votes[categoryItem.id])}
                  selectedName={voteNames[categoryItem.id]} key={categoryItem.id} />
              ))}
              {!votingReady && <CatalogueStatus {...index} />}
            </div>
          </Reveal>
        </div>
      </section>

      <section className="section how" id="how">
        <div className="container">
          <div className="section-head">
            <div>
              <p className="eyebrow">Календарь сезона</p>
              <h2 className="display">Три шага до золота</h2>
            </div>
            <p className="section-head__note">
              <CalendarDays size={14} aria-hidden="true" />
              От предложений сообщества до первых имён. Без регистрации и сложных форм.
            </p>
          </div>
          <div className="steps steps--calendar">
            {steps.map((step, index) => {
              const Icon = step.icon
              return (
                <Reveal key={step.title} delay={index * 90}>
                  <article className="step">
                    <span className="step__number" aria-hidden="true">
                      0{index + 1}
                    </span>
                    <span className="step__date">
                      <CalendarDays size={12} aria-hidden="true" />
                      {step.date}
                    </span>
                    <span className="step__icon" aria-hidden="true">
                      <Icon size={22} strokeWidth={1.7} />
                    </span>
                    <h3>{step.title}</h3>
                    <p>{step.text}</p>
                    <span className="step__tag">{step.tag}</span>
                  </article>
                </Reveal>
              )
            })}
          </div>
        </div>
      </section>

      <section className="section section--stage">
        <div className="container">
          <Reveal>
            <div className="stage-banner">
              <div className="stage-banner__copy">
                <p className="eyebrow eyebrow--dark">Этап II · Голосование</p>
                <h2>
                  Номинанты собраны. <em>Вопросы?</em>
                </h2>
                <p>
                  Первый этап завершён: сообщество предложило номинантов и
                  номинации. В каждой категории — один голос за того, кто
                  запомнился больше всех.
                </p>
                <div className="stage-banner__pills">
                  <span className="stage-banner__pill">Приём заявок завершён</span>
                  {voting.open && <span className="stage-banner__pill">
                    {deadline ? `Голосование до ${deadline}` : 'Голосование открыто'}
                  </span>}
                  <span className="stage-banner__pill">Один голос в номинации</span>
                </div>
                <Link to="/nominations" className="button button--dark">
                  Выбрать победителей
                  <ArrowUpRight size={17} aria-hidden="true" />
                </Link>
              </div>
              <div className="stage-banner__badge" aria-hidden="true">
                <span>01</span>
                <small>голос</small>
                <em>в каждой номинации</em>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="section final-section">
        <div className="container">
          <div className="final-cta">
            <Sparkles className="final-cta__spark" size={26} aria-hidden="true" />
            <p className="eyebrow eyebrow--dark">Осталось только выбрать</p>
            <h2>
              Твой голос — это <em>громко</em>.
            </h2>
            <p className="final-cta__copy">
              {voting.open
                ? deadline ? `Голосование открыто до ${deadline}. Выбери победителей в каждой номинации.` : 'Выбери победителей в каждой номинации.'
                : 'Итоги появятся в карточках номинаций после публикации.'}
            </p>
            <div className="final-cta__actions">
              <Link to="/nominations" className="button button--dark button--lg">
                {voteLabel}
                <ArrowUpRight size={18} aria-hidden="true" />
              </Link>
              <Link to="/questions" className="final-cta__link">
                Вопросы и ответы
                <ArrowRight size={15} aria-hidden="true" />
              </Link>
            </div>
            <span className="final-cta__ghost" aria-hidden="true">
              2026
            </span>
          </div>
        </div>
      </section>
    </div>
  )
}
