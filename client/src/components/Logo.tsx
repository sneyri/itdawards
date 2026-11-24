import { useRef } from 'react'
import type { MouseEvent as ReactMouseEvent } from 'react'
import { Link } from 'react-router-dom'

type LogoProps = {
  compact?: boolean
  onClick?: () => void
}

export function Logo({ compact = false, onClick }: LogoProps) {
  const clicks = useRef(0)

  function handleClick(event: ReactMouseEvent<HTMLAnchorElement>) {
    onClick?.()
    clicks.current += 1
    if (clicks.current >= 5) {
      clicks.current = 0
      event.preventDefault()
      window.dispatchEvent(new Event('itd:flappy'))
    }
  }

  return (
    <Link
      to="/"
      className={compact ? 'brand brand--compact' : 'brand'}
      aria-label="ITD AWARDS 2026 — на главную"
      onClick={handleClick}
    >
      <span className="brand__mark" aria-hidden="true">
        ITD
      </span>
      <span className="brand__text" aria-hidden="true">
        <span className="brand__name">AWARDS</span>
        <span className="brand__year">2026</span>
      </span>
    </Link>
  )
}
