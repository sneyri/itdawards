import { useEffect, useMemo } from 'react'
import type { CSSProperties } from 'react'

type EmojiBurstProps = {
  emojis: string[]
  origin: { x: number; y: number }
  onDone: () => void
}

type Particle = {
  emoji: string
  dx: number
  dy: number
  rotate: number
}

export function EmojiBurst({ emojis, origin, onDone }: EmojiBurstProps) {
  const particles = useMemo<Particle[]>(() => emojis.map((emoji) => {
    const angle = Math.random() * Math.PI * 2
    const distance = 90 + Math.random() * 150
    return {
      emoji,
      dx: Math.round(Math.cos(angle) * distance),
      dy: Math.round(Math.sin(angle) * distance) - 60,
      rotate: Math.round(Math.random() * 90 - 45),
    }
  }), [emojis])

  useEffect(() => {
    const timer = window.setTimeout(onDone, 1600)
    return () => window.clearTimeout(timer)
  }, [onDone])

  return (
    <div className="emoji-burst" aria-hidden="true">
      {particles.map((particle, index) => (
        <span
          key={index}
          className="emoji-burst__item"
          style={{
            left: origin.x,
            top: origin.y,
            '--dx': `${particle.dx}px`,
            '--dy': `${particle.dy}px`,
            '--rotate': `${particle.rotate}deg`,
          } as CSSProperties}
        >
          {particle.emoji}
        </span>
      ))}
    </div>
  )
}
