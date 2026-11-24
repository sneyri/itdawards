import { useEffect } from 'react'
import type { CSSProperties } from 'react'

type EmojiBurstProps = {
  emojis: string[]
  onDone: () => void
}

export function EmojiBurst({ emojis, onDone }: EmojiBurstProps) {
  useEffect(() => {
    const timer = window.setTimeout(onDone, 1500)
    return () => window.clearTimeout(timer)
  }, [onDone])

  return (
    <div className="emoji-burst" aria-hidden="true">
      {emojis.map((emoji, index) => (
        <span
          key={index}
          className="emoji-burst__item"
          style={{ '--index': index, '--count': emojis.length } as CSSProperties}
        >
          {emoji}
        </span>
      ))}
    </div>
  )
}
