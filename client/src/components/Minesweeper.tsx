import { useEffect, useState } from 'react'
import type { MouseEvent as ReactMouseEvent } from 'react'
import { RotateCcw, X } from 'lucide-react'

type Cell = {
  mine: boolean
  revealed: boolean
  flagged: boolean
  adjacent: number
}

type Status = 'playing' | 'won' | 'lost'

const SIZE = 8
const MINES = 8
const CELLS = SIZE * SIZE

function neighbors(index: number): number[] {
  const row = Math.floor(index / SIZE)
  const column = index % SIZE
  const result: number[] = []
  for (let dr = -1; dr <= 1; dr += 1) {
    for (let dc = -1; dc <= 1; dc += 1) {
      if (dr === 0 && dc === 0) continue
      const nextRow = row + dr
      const nextColumn = column + dc
      if (nextRow < 0 || nextRow >= SIZE || nextColumn < 0 || nextColumn >= SIZE) continue
      result.push(nextRow * SIZE + nextColumn)
    }
  }
  return result
}

function makeBoard(): Cell[] {
  const board: Cell[] = Array.from({ length: CELLS }, () => ({
    mine: false,
    revealed: false,
    flagged: false,
    adjacent: 0,
  }))
  const placed = new Set<number>()
  while (placed.size < MINES) {
    const index = Math.floor(Math.random() * CELLS)
    if (index === 0) continue
    placed.add(index)
    board[index].mine = true
  }
  for (let index = 0; index < CELLS; index += 1) {
    board[index].adjacent = neighbors(index).filter((item) => board[item].mine).length
  }
  return board
}

export function Minesweeper({ onClose }: { onClose: () => void }) {
  const [board, setBoard] = useState<Cell[]>(makeBoard)
  const [status, setStatus] = useState<Status>('playing')
  const [flags, setFlags] = useState(0)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function restart() {
    setBoard(makeBoard())
    setStatus('playing')
    setFlags(0)
  }

  function reveal(index: number) {
    if (status !== 'playing' || board[index].flagged || board[index].revealed) return
    const next = board.map((cell) => ({ ...cell }))
    if (next[index].mine) {
      for (const cell of next) if (cell.mine) cell.revealed = true
      setBoard(next)
      setStatus('lost')
      return
    }
    const queue = [index]
    while (queue.length) {
      const current = queue.pop() as number
      const cell = next[current]
      if (cell.revealed || cell.flagged || cell.mine) continue
      cell.revealed = true
      if (cell.adjacent === 0) {
        for (const item of neighbors(current)) {
          if (!next[item].revealed && !next[item].flagged) queue.push(item)
        }
      }
    }
    setBoard(next)
    if (next.every((cell) => cell.mine || cell.revealed)) setStatus('won')
  }

  function toggleFlag(index: number, event: ReactMouseEvent<HTMLButtonElement>) {
    event.preventDefault()
    if (status !== 'playing' || board[index].revealed) return
    const next = board.map((cell) => ({ ...cell }))
    next[index].flagged = !next[index].flagged
    setBoard(next)
    setFlags((value) => value + (next[index].flagged ? 1 : -1))
  }

  return (
    <div className="secret-overlay" role="dialog" aria-modal="true" aria-label="Сапёр">
      <div className="secret-card secret-card--mines">
        <div className="secret-card__head">
          <h2>Сапёр · лёгкий уровень</h2>
          <button type="button" className="secret-card__close" onClick={onClose} aria-label="Закрыть сапёр">
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="minesweeper__meta">
          <span>Мины: {MINES - flags}</span>
          <span>{status === 'won' ? 'Победа!' : status === 'lost' ? 'Бум!' : 'Играем'}</span>
        </div>
        <div className="minesweeper__grid" style={{ gridTemplateColumns: `repeat(${SIZE}, 1fr)` }}>
          {board.map((cell, index) => (
            <button
              type="button"
              key={index}
              className={`minesweeper__cell ${cell.revealed ? 'is-revealed' : ''} ${cell.flagged ? 'is-flagged' : ''} ${cell.revealed && cell.mine ? 'is-mine' : ''}`}
              onClick={() => reveal(index)}
              onContextMenu={(event) => toggleFlag(index, event)}
              aria-label={`Клетка ${index + 1}`}
            >
              {cell.flagged ? '🚩' : cell.revealed && cell.mine ? '💣' : cell.revealed && cell.adjacent > 0 ? cell.adjacent : ''}
            </button>
          ))}
        </div>
        <div className="secret-card__foot">
          <span className="secret-card__muted">ЛКМ — открыть, ПКМ — флаг</span>
          <button type="button" className="button button--gold button--sm" onClick={restart}>
            <RotateCcw size={14} aria-hidden="true" />
            Заново
          </button>
        </div>
      </div>
    </div>
  )
}
