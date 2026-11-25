import { lazy, Suspense, useEffect, useState } from 'react'

const FlappyGame = lazy(() => import('./FlappyGame').then(({ FlappyGame }) => ({ default: FlappyGame })))
const Minesweeper = lazy(() => import('./Minesweeper').then(({ Minesweeper }) => ({ default: Minesweeper })))

type Game = 'flappy' | 'mines' | null

export function SecretGames() {
  const [game, setGame] = useState<Game>(null)

  useEffect(() => {
    const openFlappy = () => setGame('flappy')
    const openMines = () => setGame('mines')
    window.addEventListener('itd:flappy', openFlappy)
    window.addEventListener('itd:mines', openMines)
    return () => {
      window.removeEventListener('itd:flappy', openFlappy)
      window.removeEventListener('itd:mines', openMines)
    }
  }, [])

  if (!game) return null
  const close = () => setGame(null)
  return (
    <Suspense fallback={null}>
      {game === 'flappy' ? <FlappyGame onClose={close} /> : <Minesweeper onClose={close} />}
    </Suspense>
  )
}
