import { useCallback, useEffect, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import { RotateCcw, X } from 'lucide-react'

type Pipe = { x: number; gapY: number; passed: boolean }

type GameState = {
  y: number
  vy: number
  pipes: Pipe[]
  score: number
  over: boolean
}

export function FlappyGame({ onClose }: { onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stateRef = useRef<GameState>({ y: 0, vy: 0, pipes: [], score: 0, over: false })
  const [score, setScore] = useState(0)
  const [over, setOver] = useState(false)
  const [round, setRound] = useState(0)

  const jump = useCallback(() => {
    const state = stateRef.current
    if (state.over) return
    state.vy = -5.4
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return

    const state = stateRef.current
    const width = canvas.width
    const height = canvas.height
    state.y = height / 2
    state.vy = 0
    state.pipes = [{ x: width + 40, gapY: height / 2, passed: false }]
    state.score = 0
    state.over = false
    setScore(0)
    setOver(false)

    let animation = 0
    const draw = () => {
      if (!state.over) {
        state.vy += 0.34
        state.y += state.vy
        if (state.y < 14) {
          state.y = 14
          state.vy = 0
        }
        if (state.y > height - 14) {
          state.y = height - 14
          state.over = true
          setOver(true)
        }
        for (const pipe of state.pipes) {
          pipe.x -= 2.7
          if (!pipe.passed && pipe.x + 40 < 80) {
            pipe.passed = true
            state.score += 1
            setScore(state.score)
          }
          if (pipe.x + 40 > 56 && pipe.x < 106) {
            if (state.y < pipe.gapY - 58 || state.y > pipe.gapY + 58) {
              state.over = true
              setOver(true)
            }
          }
        }
        while (state.pipes.length && state.pipes[0].x < -40) state.pipes.shift()
        const last = state.pipes[state.pipes.length - 1]
        if (!last || last.x < width - 180) {
          state.pipes.push({
            x: width + 30,
            gapY: 70 + Math.random() * (height - 200),
            passed: false,
          })
        }
      }

      context.fillStyle = '#14130f'
      context.fillRect(0, 0, width, height)
      context.fillStyle = '#c8a15f'
      for (const pipe of state.pipes) {
        context.fillRect(pipe.x, 0, 42, pipe.gapY - 58)
        context.fillRect(pipe.x, pipe.gapY + 58, 42, height)
      }
      context.beginPath()
      context.arc(80, state.y, 14, 0, Math.PI * 2)
      context.fillStyle = state.over ? '#9b8a66' : '#e6bf78'
      context.fill()
      context.fillStyle = '#1a150a'
      context.font = 'bold 8px sans-serif'
      context.fillText('ITD', 68, state.y + 3)
      animation = window.requestAnimationFrame(draw)
    }
    animation = window.requestAnimationFrame(draw)

    const onKey = (event: KeyboardEvent) => {
      if (event.code === 'Space' || event.code === 'ArrowUp') {
        event.preventDefault()
        jump()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.cancelAnimationFrame(animation)
      window.removeEventListener('keydown', onKey)
    }
  }, [jump, round])

  const onCanvasKeyDown = (event: ReactKeyboardEvent<HTMLCanvasElement>) => {
    if (event.key === 'Enter') jump()
  }

  return (
    <div className="secret-overlay" role="dialog" aria-modal="true" aria-label="Мини-игра Flappy Awards">
      <div className="secret-card secret-card--game">
        <div className="secret-card__head">
          <h2>Flappy Awards</h2>
          <button type="button" className="secret-card__close" onClick={onClose} aria-label="Закрыть игру">
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <p className="secret-card__hint">Клик по полю или пробел — взмах. Не задень трубы.</p>
        <canvas
          ref={canvasRef}
          width={360}
          height={420}
          className="flappy-canvas"
          onClick={jump}
          onKeyDown={onCanvasKeyDown}
          tabIndex={0}
          aria-label="Игровое поле"
        />
        <div className="secret-card__foot">
          <span>Счёт: <strong>{score}</strong></span>
          {over ? (
            <button type="button" className="button button--gold button--sm" onClick={() => setRound((value) => value + 1)}>
              <RotateCcw size={14} aria-hidden="true" />
              Ещё раз
            </button>
          ) : (
            <span className="secret-card__muted">Пробел — прыжок</span>
          )}
        </div>
      </div>
    </div>
  )
}
