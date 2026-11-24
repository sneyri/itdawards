import { useEffect, useState } from 'react'
import { FlappyGame } from './FlappyGame'
import { Minesweeper } from './Minesweeper'

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
  return game === 'flappy' ? <FlappyGame onClose={close} /> : <Minesweeper onClose={close} />
}
