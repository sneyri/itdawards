import { Link } from 'react-router-dom'

type LogoProps = {
  compact?: boolean
  onClick?: () => void
}

export function Logo({ compact = false, onClick }: LogoProps) {
  return (
    <Link
      to="/"
      className={compact ? 'brand brand--compact' : 'brand'}
      aria-label="ITD AWARDS 2026 — на главную"
      onClick={onClick}
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
