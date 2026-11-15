import type { ReactNode } from 'react'

type ProgressRingProps = {
  value: number
  total: number
  size?: number
  stroke?: number
  children?: ReactNode
  label?: string
}

const RADIUS = 54
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export function ProgressRing({
  value,
  total,
  size = 92,
  stroke = 4,
  children,
  label,
}: ProgressRingProps) {
  const safeTotal = Math.max(total, 1)
  const ratio = Math.min(Math.max(value / safeTotal, 0), 1)
  const accessibleLabel = label ?? `Заполнено ${value} из ${total}`

  return (
    <span
      className="progress-ring"
      style={{ width: size, height: size }}
      role="img"
      aria-label={accessibleLabel}
    >
      <svg viewBox="0 0 120 120" aria-hidden="true" focusable="false">
        <circle className="progress-ring__track" cx="60" cy="60" r={RADIUS} strokeWidth={stroke} />
        <circle
          className="progress-ring__value-circle"
          cx="60"
          cy="60"
          r={RADIUS}
          strokeWidth={stroke}
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - ratio)}
        />
      </svg>
      {children && (
        <span className="progress-ring__label" aria-hidden="true">
          {children}
        </span>
      )}
    </span>
  )
}
