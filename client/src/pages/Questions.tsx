import { Link } from 'react-router-dom'
import { ArrowUpRight, Plus, Send } from 'lucide-react'
import { PageHero } from '../components/PageHero'
import { Reveal } from '../components/Reveal'
import { useVotes } from '../context/VotesContext'
import { EVENT, eventDateLabel } from '../data/event'
import { getFaq } from '../data/faq'
import { telegramChannels, telegramContacts } from '../data/contacts'
import { usePageTitle } from '../hooks/usePageTitle'

export function Questions() {
  usePageTitle('Вопросы')
  const { categories, voting } = useVotes()
  const faq = getFaq(voting.allowVoteChanges, eventDateLabel(EVENT.ceremonyAt))

  return (
    <div className="questions-page">
      <PageHero
        eyebrow="Вопросы"
        title={
          <>
            Номинанты собраны.
            <br />
            <em>Вопросы?</em>
          </>
        }
        description="Всё о голосовании, сохранении выбора и датах сезона — коротко и по делу."
        ghost="FAQ"
        aside={
          <div className="about-facts">
            <div>
              <strong>{categories.length}</strong>
              <span>номинаций</span>
            </div>
            <div>
              <strong>01</strong>
              <span>голос в каждой</span>
            </div>
          </div>
        }
      />

      <section className="section about-faq" id="faq" aria-labelledby="faq-title">
        <div className="container about-faq__grid">
          <Reveal>
            <p className="eyebrow">Коротко о главном</p>
            <h2 className="display" id="faq-title">
              Частые <em>вопросы</em>
            </h2>
            <p className="about-faq__note">
              Не нашли ответ — напишите в Telegram. Отвечаем на всё, даже на сообщения
              в три часа ночи.
            </p>
            <a href="#contacts" className="link-inline">
              Написать нам
              <ArrowUpRight size={15} aria-hidden="true" />
            </a>
          </Reveal>
          <Reveal delay={80}>
            <div className="faq">
              {faq.map((item) => (
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
                Остались вопросы?
              </h2>
              <p>
                Пишите в Telegram. Канал ИТД ИТП — новости премии, @sneyr — прямой
                контакт для вопросов и предложений.
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
