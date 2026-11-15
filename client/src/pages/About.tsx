import { Link } from 'react-router-dom'
import {
  ArrowUpRight,
  CalendarDays,
  ListChecks,
  Plus,
  Lock,
  Send,
  User,
  Vote,
} from 'lucide-react'
import { PageHero } from '../components/PageHero'
import { Reveal } from '../components/Reveal'
import { useVotes } from '../context/VotesContext'
import { EVENT } from '../data/event'
import { telegramChannels, telegramContacts } from '../data/contacts'
import { usePageTitle } from '../hooks/usePageTitle'
import { pluralize } from '../lib/format'

const timeline = [
  {
    date: 'до 13 ноября',
    title: 'Этап I · Предложение номинантов',
    text: 'Сообщество предлагает номинантов и номинации в Telegram-боте премии.',
  },
  {
    date: '14 ноября — 20 декабря',
    title: 'Этап II · Голосование',
    text: 'В каждой открытой номинации можно отдать один голос.',
  },
  {
    date: '27 декабря',
    title: 'Церемония и победители',
    text: 'Объявляем первых победителей ITD AWARDS. Золото, речи и, конечно, немного мемов.',
  },
]

const rules = [
  {
    icon: Vote,
    title: 'Один голос в номинации',
    text: 'В каждой открытой номинации можно поддержать одного номинанта.',
  },
  {
    icon: ListChecks,
    title: 'Предложения сообщества',
    text: 'Список участников формируется по предложениям сообщества.',
  },
  {
    icon: Lock,
    title: 'Подтвердите свой выбор',
    text: 'После подтверждения выбор появляется в разделе «Мой голос».',
  },
]

const faq = [
  {
    question: 'Куда отправляются мои голоса?',
    answer:
      'Голоса сохраняются на сервере. Ваш выбор можно посмотреть в разделе «Мой голос».',
  },
  {
    question: 'Можно ли ещё предложить номинанта?',
    answer:
      'Предложения собирает Telegram-бот премии. На сайте можно просматривать список и голосовать в открытых номинациях.',
  },
  {
    question: 'Можно ли изменить голос после сохранения?',
    answer:
      'После подтверждения голос окончательный.',
  },
  {
    question: 'Когда объявят победителей?',
    answer: `Победителей объявим на церемонии ${EVENT.ceremonyLabel}. Результаты появятся на сайте и в сообществе ITD.`,
  },
  {
    question: 'Почему в некоторых номинациях несколько номинантов?',
    answer:
      'Количество участников может различаться. В каждой открытой номинации можно отдать один голос.',
  },
]

export function About() {
  usePageTitle('О премии')
  const { categories, isPreview, auth } = useVotes()
  const browserVoting = auth.mode === 'anonymous' || auth.mode === 'demo'
  const votingRules = [...rules, {
    icon: User,
    title: browserVoting ? 'Голосование без регистрации' : 'Аккаунт для голосования',
    text: browserVoting
      ? 'Ваш выбор сохраняется для этого браузера.'
      : 'Для входа нужен одноразовый код из письма. Ваш выбор сохраняется в аккаунте.',
  }]
  const questions = [{
    question: 'Нужна ли регистрация?',
    answer: browserVoting
      ? 'Нет. Откройте номинацию, выберите номинанта и сохраните голос в этом браузере.'
      : 'Введите email, затем код из письма. Если раньше вы создали аккаунт с паролем, войдите по нику и паролю.',
  }, ...faq]
  const totalNominees = categories.reduce((sum, category) => sum + category.nominees.length, 0)

  return (
    <div className="about-page">
      <PageHero
        eyebrow="О премии"
        title={
          <>
            Премия для тех,
            <br />
            кто делает ITD <em>живым.</em>
          </>
        }
        description="ITD AWARDS — первая премия сообщества. Мы вспоминаем лучшие проекты, людей, мемы и события 2026 года — и говорим им спасибо своим голосом."
        ghost="ITD"
        aside={
          <div className="about-facts">
            <div>
              <strong>01</strong>
              <span>первый сезон</span>
            </div>
            <div>
              <strong>{categories.length}</strong>
              <span>номинаций</span>
            </div>
            <div>
              <strong>{totalNominees}</strong>
              <span>{pluralize(totalNominees, 'номинант', 'номинанта', 'номинантов')}</span>
            </div>
          </div>
        }
      />

      <section className="section about-intro">
        <div className="container about-intro__grid">
          <Reveal>
            <p className="eyebrow">Манифест</p>
            <h2 className="display display--lg">
              Мы выбираем не
              <br />
              <em>самых громких</em>,
              <br />
              а самых своих.
            </h2>
          </Reveal>
          <Reveal delay={90}>
            <p className="about-intro__lead">
              Премии часто измеряются цифрами. Нам же важнее другое: кто придумал
              проект, который вы обсуждали неделю, кто поддержал в трудный день, чей
              кадр стал аватаркой, а чья шутка до сих пор живёт в переписке.
            </p>
            <p>
              ITD AWARDS — первая возможность признать вклад тех, кто делает
              сообщество живым. Без рейтингов подписчиков, без сложных условий и без
              ощущения, что вы голосуете «за кого-то не того».
            </p>
            <blockquote className="about-quote">
              «Золото получает не тот, кого чаще показывают, а тот, кого действительно
              помнят».
            </blockquote>
          </Reveal>
        </div>
      </section>

      <section className="section about-timeline" aria-labelledby="timeline-title">
        <div className="container">
          <div className="section-head">
            <div>
              <p className="eyebrow">Календарь</p>
              <h2 className="display" id="timeline-title">
                Как проходит сезон
              </h2>
            </div>
            <p className="section-head__note">
              Два этапа и финальная церемония — от предложений сообщества до первых имён.
            </p>
          </div>
          <div className="timeline" role="list">
            {timeline.map((item, index) => (
              <Reveal key={item.date} delay={index * 60}>
                <div className="timeline__item" role="listitem">
                  <span className="timeline__dot" aria-hidden="true" />
                  <span className="timeline__date">
                    <CalendarDays size={13} aria-hidden="true" />
                    {item.date}
                  </span>
                  <div className="timeline__body">
                    <h3>{item.title}</h3>
                    <p>{item.text}</p>
                  </div>
                  <span className="timeline__number" aria-hidden="true">
                    0{index + 1}
                  </span>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="section about-rules" id="rules" aria-labelledby="rules-title">
        <div className="container">
          <div className="section-head">
            <div>
              <p className="eyebrow">Правила</p>
              <h2 className="display" id="rules-title">
                Честно и просто
              </h2>
            </div>
            <p className="section-head__note">
              Никаких скрытых условий. Только выбор сообщества.
            </p>
          </div>
          <div className="rules-grid">
            {votingRules.map((rule, index) => {
              const Icon = rule.icon
              return (
                <Reveal key={rule.title} delay={index * 70}>
                  <article className="rule-card">
                    <span className="rule-card__number" aria-hidden="true">
                      0{index + 1}
                    </span>
                    <span className="rule-card__icon" aria-hidden="true">
                      <Icon size={20} strokeWidth={1.7} />
                    </span>
                    <h3>{rule.title}</h3>
                    <p>{rule.text}</p>
                  </article>
                </Reveal>
              )
            })}
          </div>
          {isPreview && <p className="rules-note">Сейчас на сайте идёт тестовое голосование по предложениям из Telegram-бота.</p>}
        </div>
      </section>

      <section className="section about-faq" id="faq" aria-labelledby="faq-title">
        <div className="container about-faq__grid">
          <Reveal>
            <p className="eyebrow">Вопросы</p>
            <h2 className="display" id="faq-title">
              Коротко <em>о главном</em>
            </h2>
            <p className="about-faq__note">
              Если не нашли ответ — напишите нам. Мы читаем всё, даже сообщения в три
              часа ночи.
            </p>
            <a href="#contacts" className="link-inline">
              Написать нам
              <ArrowUpRight size={15} aria-hidden="true" />
            </a>
          </Reveal>
          <Reveal delay={80}>
            <div className="faq">
              {questions.map((item) => (
                <details key={item.question}>
                  <summary>
                    <span>{item.question}</span>
                    <Plus className="faq__icon" size={18} aria-hidden="true" />
                  </summary>
                  <p className="faq__answer">{item.answer}</p>
                </details>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      <section className="section about-contacts" id="contacts" aria-labelledby="contacts-title">
        <div className="container">
          <div className="contacts-card">
            <div>
              <p className="eyebrow">На связи</p>
              <h2 className="display" id="contacts-title">
                Есть идея или вопрос?
              </h2>
              <p>
                Все вопросы, предложения и идеи — в Telegram. Пишите в каналы премии
                или лично команде.
              </p>
            </div>
            <div className="contacts-card__actions">
              <div className="contacts-card__channels">
                {telegramChannels.map((channel, index) => (
                  <a
                    key={channel.href}
                    href={channel.href}
                    target="_blank"
                    rel="noreferrer"
                    className={`button ${index === 0 ? 'button--gold' : 'button--ghost'}`}
                  >
                    <Send size={16} aria-hidden="true" />
                    {channel.label}
                  </a>
                ))}
              </div>
              <div className="contacts-card__people">
                {telegramContacts.map((contact) => (
                  <a key={contact.href} href={contact.href} target="_blank" rel="noreferrer">
                    <Send size={14} aria-hidden="true" />
                    {contact.label}
                  </a>
                ))}
              </div>
            </div>
            <span className="contacts-card__ghost" aria-hidden="true">
              ITD
            </span>
          </div>
          <div className="about-bottom">
            <p>Готовы выбрать своих?</p>
            <Link to="/nominations" className="button button--cream">
              Перейти к номинациям
              <ArrowUpRight size={17} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
