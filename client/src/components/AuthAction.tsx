import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useVotes } from '../context/VotesContext'
import { useToast } from '../context/ToastContext'
import { signOut } from '../lib/awardsApi'

export function AuthAction({ className, label = 'Войти' }: { className: string; label?: string }) {
  const { auth } = useVotes()
  const { showToast } = useToast()
  const location = useLocation()
  const [busy, setBusy] = useState(false)
  async function logOut() {
    setBusy(true)
    try {
      await signOut()
      window.location.reload()
    } catch {
      setBusy(false)
      showToast('Не удалось выйти. Попробуйте ещё раз.', 'error')
    }
  }

  if (auth.user) {
    return <button type="button" className={className} disabled={busy} onClick={logOut}>Выйти</button>
  }

  const returnTo = new URLSearchParams({ return_to: location.pathname + location.search + location.hash })
  return <Link className={className} to={`/sign-in?${returnTo}`} state={{ backgroundLocation: location }}>{label}</Link>
}
