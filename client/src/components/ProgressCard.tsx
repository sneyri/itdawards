import { ProgressRing } from './ProgressRing'

type ProgressCardProps = {
  value: number
  total: number
  label?: string
}

export function ProgressCard({ value, total, label = 'Ваш прогресс' }: ProgressCardProps) {
  const percent = Math.round((value / Math.max(total, 1)) * 100)

  return (
    <div className="progress-card">
      <ProgressRing value={value} total={total} size={92} stroke={4}>
        <strong>{percent}%</strong>
      </ProgressRing>
      <div className="progress-card__text">
        <span className="progress-card__label">{label}</span>
        <strong className="progress-card__value">
          {value} <span>из {total}</span>
        </strong>
        <span className="progress-card__hint">номинаций закрыто</span>
      </div>
    </div>
  )
}
