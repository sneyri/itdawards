import { Link } from 'react-router-dom'
import { ArrowUp, Send } from 'lucide-react'
import { EVENT } from '../data/event'
import { telegramChannels, telegramContacts } from '../data/contacts'
import { Logo } from './Logo'

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer__grid">
          <div className="footer__brand">
            <Logo />
            <p className="footer__tagline">
              Первая премия сообщества ITD. Голосуем за тех, кто сделал этот год громче.
            </p>
            <p className="footer__edition">
              {EVENT.edition} · {EVENT.year}
            </p>
          </div>

          <nav className="footer__col" aria-label="Навигация в подвале">
            <h2>Навигация</h2>
            <Link to="/nominations">Номинации</Link>
            <Link to="/my-votes">Мой голос</Link>
          </nav>

          <nav className="footer__col" aria-label="Помощь">
            <h2>Помощь</h2>
            <Link to="/questions">Вопросы</Link>
            <Link to="/questions#faq">Частые вопросы</Link>
            <Link to="/questions#contacts">Контакты</Link>
          </nav>

          <div className="footer__col">
            <h2>Связь</h2>
            {telegramChannels.map((channel) => (
              <a key={channel.href} href={channel.href} target="_blank" rel="noreferrer">
                <Send size={14} aria-hidden="true" />
                {channel.shortLabel}
              </a>
            ))}
            {telegramContacts.map((contact) => (
              <a key={contact.href} href={contact.href} target="_blank" rel="noreferrer">
                <Send size={14} aria-hidden="true" />
                {contact.label}
              </a>
            ))}
          </div>
        </div>

        <div className="footer__bottom">
          <span>© 2026 ITD AWARDS. Сделано сообществом для сообщества.</span>
          <a href="#top" className="footer__up">
            Наверх
            <ArrowUp size={14} aria-hidden="true" />
          </a>
        </div>
      </div>
      <div className="footer__ghost" aria-hidden="true">
        ITD AWARDS
      </div>
    </footer>
  )
}
