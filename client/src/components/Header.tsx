import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { ArrowUpRight, Menu, Vote, X } from 'lucide-react'
import { eventDateLabel } from '../data/event'
import { useVotes } from '../context/VotesContext'
import { Logo } from './Logo'

const publicNavItems = [
  { to: '/nominations', label: 'Номинации' },
  { to: '/my-votes', label: 'Мой голос' },
  { to: '/questions', label: 'Вопросы' },
]

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const location = useLocation()
  const { auth, voting, votingReady } = useVotes()
  const role = auth.user?.role
  const navItems = role === 'SUPERADMIN' || role === 'MANAGER'
    ? [...publicNavItems, { to: '/admin', label: 'Админка' }]
    : publicNavItems
  const votingOpen = voting.open
  const deadline = eventDateLabel(voting.endsAt)
  const menuRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 12)
    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!menuOpen) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeButtonRef.current?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false)
        return
      }

      if (event.key !== 'Tab') return

      const focusable = menuRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled])',
      )
      if (!focusable || focusable.length === 0) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [menuOpen])

  return (
    <>
      <div className="status-bar">
        <div className="container status-bar__inner">
          <span className="status-bar__main">
            {votingOpen && <span className="status-dot" aria-hidden="true" />}
            {votingReady ? (votingOpen ? 'Голосование открыто' : 'Голосование сейчас закрыто') : 'ITD Awards 2026'}
          </span>
          <span className="status-bar__details">
            {votingOpen && deadline && <span className="status-bar__date">до {deadline}</span>}
            <Link to="/questions" className="status-bar__link">
              Вопросы
              <ArrowUpRight size={12} aria-hidden="true" />
            </Link>
          </span>
        </div>
      </div>

      <header className={`site-header ${scrolled ? 'is-scrolled' : ''}`}>
        <div className="container header__inner">
          <Logo compact />

          <nav className="header__nav" aria-label="Основная навигация">
            {navItems.map((item) => item.to === '/admin' ? (
              <a key={item.to} href={item.to}>{item.label}</a>
            ) : (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => (isActive ? 'is-active' : undefined)}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="header__actions">
            <Link to="/nominations" className="button button--gold button--sm header__cta">
              <Vote size={16} aria-hidden="true" />
              Голосовать
            </Link>

            <button
              type="button"
              className="menu-toggle"
              onClick={() => setMenuOpen(true)}
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
              aria-label="Открыть меню"
            >
              <Menu size={22} aria-hidden="true" />
            </button>
          </div>
        </div>

        {menuOpen && (
          <>
            <div
              className="menu-backdrop"
              onClick={() => setMenuOpen(false)}
              aria-hidden="true"
            />
            <div
              className="mobile-menu"
              id="mobile-menu"
              role="dialog"
              aria-modal="true"
              aria-labelledby="mobile-menu-title"
              ref={menuRef}
            >
              <div className="mobile-menu__head">
                <Logo
                  onClick={() => setMenuOpen(false)}
                />
                <button
                  ref={closeButtonRef}
                  type="button"
                  className="mobile-menu__close"
                  onClick={() => setMenuOpen(false)}
                  aria-label="Закрыть меню"
                >
                  <X size={24} aria-hidden="true" />
                </button>
              </div>
              <h2 className="sr-only" id="mobile-menu-title">
                Навигация по сайту
              </h2>
              <nav className="mobile-menu__nav" aria-label="Мобильная навигация">
                {navItems.map((item, index) => item.to === '/admin' ? (
                  <a key={item.to} href={item.to} className="mobile-menu__link" onClick={() => setMenuOpen(false)}>
                    <span>{item.label}</span>
                    <ArrowUpRight size={20} aria-hidden="true" />
                  </a>
                ) : (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      `mobile-menu__link ${isActive ? 'is-active' : ''}`
                    }
                    onClick={() => setMenuOpen(false)}
                  >
                    <span className="mobile-menu__index" aria-hidden="true">
                      0{index + 1}
                    </span>
                    <span>{item.label}</span>
                    <ArrowUpRight size={20} aria-hidden="true" />
                  </NavLink>
                ))}
              </nav>
              <div className="mobile-menu__foot">
                <Link
                  to="/nominations"
                  className="button button--gold mobile-menu__cta"
                  onClick={() => setMenuOpen(false)}
                >
                  Выбрать победителей
                  <ArrowUpRight size={17} aria-hidden="true" />
                </Link>
                {votingOpen && deadline && <p className="mobile-menu__deadline">Голосование до {deadline}</p>}
              </div>
            </div>
          </>
        )}
      </header>
    </>
  )
}
