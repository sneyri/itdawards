import { useEffect, useState } from 'react'

export function LiveVoters() {
  const [target, setTarget] = useState(42)
  const [display, setDisplay] = useState(42)

  useEffect(() => {
    const timer = window.setInterval(() => {
      const wave = Math.sin(Date.now() / 11000) * 11
      setTarget(Math.max(18, Math.round(45 + wave + Math.random() * 6)))
    }, 3500)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setDisplay((current) => {
        if (current === target) return current
        return current + Math.sign(target - current)
      })
    }, 45)
    return () => window.clearInterval(timer)
  }, [target])

  return (
    <div className="live-voters" aria-live="polite">
      <span className="live-voters__dot" aria-hidden="true" />
      <span>Сейчас голосуют</span>
      <strong>{display}</strong>
      <span>человек</span>
    </div>
  )
}
