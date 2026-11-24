import { useState } from 'react'
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent } from 'react'

type DeadlineDateProps = {
  text: string
  weird: boolean
  className?: string
}

export function DeadlineDate({ text, weird, className }: DeadlineDateProps) {
  const [round, setRound] = useState(0)
  const [active, setActive] = useState(false)
  const value = weird ? '67 декабря' : text

  function bounce() {
    setRound((current) => current + 1)
    setActive(true)
  }

  function onKeyDown(event: ReactKeyboardEvent<HTMLElement>) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      bounce()
    }
  }

  if (!weird) return <small className={className}>{value}</small>

  return (
    <small
      className={`${className ?? ''} deadline-glitch${active ? ' is-active' : ''}`}
      onClick={bounce}
      onKeyDown={onKeyDown}
      role="button"
      tabIndex={0}
      aria-label={value}
    >
      {[...value].map((letter, index) => (
        <span
          key={`${round}-${index}`}
          className="deadline-glitch__letter"
          style={{ '--i': index } as CSSProperties}
        >
          {letter === ' ' ? '\u00a0' : letter}
        </span>
      ))}
    </small>
  )
}
