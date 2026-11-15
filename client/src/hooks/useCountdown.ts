import { useEffect, useState } from 'react'

export type TimeLeft = {
  days: number
  hours: number
  minutes: number
  seconds: number
  isOver: boolean
}

function calculate(target: string): TimeLeft {
  const difference = new Date(target).getTime() - Date.now()
  if (difference <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, isOver: true }
  }

  return {
    days: Math.floor(difference / 86_400_000),
    hours: Math.floor((difference / 3_600_000) % 24),
    minutes: Math.floor((difference / 60_000) % 60),
    seconds: Math.floor((difference / 1000) % 60),
    isOver: false,
  }
}

export function useCountdown(target: string): TimeLeft {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>(() => calculate(target))

  useEffect(() => {
    setTimeLeft(calculate(target))
    const interval = window.setInterval(() => {
      setTimeLeft(calculate(target))
    }, 1000)

    return () => window.clearInterval(interval)
  }, [target])

  return timeLeft
}
