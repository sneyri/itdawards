import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useVotes } from '../context/VotesContext'
import { useToast } from '../context/ToastContext'

export function AuthAction({ className }: { className: string }) {
  const { auth } = useVotes()
  const { showToast } = useToast()
  const { pathname, search, hash } = useLocation()
  const [busy, setBusy] = useState(false)
  if (auth.mode !== 'account') return null

  async function signOut() {
    setBusy(true)
    try {
      const response = await fetch('/auth/logout', { method: 'POST' })
      if (!response.ok) throw new Error('Logout failed')
      window.location.reload()
    } catch {
      setBusy(false)
      showToast('Не удалось выйти. Попробуйте ещё раз.', 'error')
    }
  }

  if (auth.signedIn) {
    return <button type="button" className={className} disabled={busy} onClick={signOut}>Выйти</button>
  }

  const returnTo = new URLSearchParams({ return_to: pathname + search + hash })
  return <a className={className} href={`/auth/login?${returnTo}`}>Войти</a>
}
