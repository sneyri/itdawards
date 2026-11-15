import { useCountdown } from '../hooks/useCountdown'
import { pluralize } from '../lib/format'

const cells = [
  { key: 'days', label: 'дней' },
  { key: 'hours', label: 'часов' },
  { key: 'minutes', label: 'минут' },
  { key: 'seconds', label: 'секунд' },
] as const

export function Countdown({ target }: { target: string }) {
  const timeLeft = useCountdown(target)

  const accessibleLabel = timeLeft.isOver
    ? 'Голосование завершено'
    : `До конца голосования ${timeLeft.days} ${pluralize(timeLeft.days, 'день', 'дня', 'дней')}, ${timeLeft.hours} ${pluralize(timeLeft.hours, 'час', 'часа', 'часов')} и ${timeLeft.minutes} ${pluralize(timeLeft.minutes, 'минута', 'минуты', 'минут')}`

  return (
    <div className="countdown" role="timer" aria-label={accessibleLabel}>
      {cells.map((cell, index) => (
        <div className="countdown__group" key={cell.key}>
          {index > 0 && (
            <span className="countdown__separator" aria-hidden="true">
              :
            </span>
          )}
          <span className="countdown__cell">
            <span className="countdown__value">
              {String(timeLeft[cell.key]).padStart(2, '0')}
            </span>
            <span className="countdown__unit">{cell.label}</span>
          </span>
        </div>
      ))}
    </div>
  )
}
