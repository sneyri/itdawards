import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { usePageTitle } from '../hooks/usePageTitle'
import './signIn.css'

async function authRequest(path: string, payload: Record<string, string>) {
  const response = await fetch(`/auth/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const body = await response.json().catch(() => null)
  if (!response.ok || !body?.data) {
    const message = body?.error?.message ?? 'Вход в ITD Awards сейчас недоступен. Попробуйте позже.'
    throw new Error(message)
  }
}

function safeReturnPath(value: string | null) {
  if (!value || !/^\/(?![/\\])[^\\\r\n]*$/.test(value)) return '/nominations'
  const url = new URL(value, window.location.origin)
  return /^\/(?:nominations(?:\/[a-z0-9-]+)?\/?|my-votes\/?|results\/?|about\/?|ceremony\/?)?$/.test(url.pathname)
    ? url.pathname + url.search + url.hash
    : '/nominations'
}

export function SignIn() {
  usePageTitle('Вход в ITD Awards')
  const [params] = useSearchParams()
  const [legacy, setLegacy] = useState(false)
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [code, setCode] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  function resetCode() {
    setSent(false)
    setCode('')
    setError('')
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    setError('')
    setBusy(true)
    try {
      if (!legacy && !sent) {
        await authRequest('email/request', { email })
        setSent(true)
      } else {
        if (legacy) await authRequest('sign-in', { username, password })
        else await authRequest('email/verify', { email, code })
        window.location.assign(safeReturnPath(params.get('return_to')))
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Что-то пошло не так. Попробуйте ещё раз.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="sign-in container section">
      <h1 className="display">Вход в ITD Awards</h1>
      <div className="sign-in__panel">
        <form className="sign-in__form" onSubmit={submit}>
          {legacy ? <>
            <label>Ник
              <input name="username" autoComplete="username" autoCapitalize="none" spellCheck={false}
                maxLength={33} required value={username} onChange={(event) => setUsername(event.target.value)} disabled={busy} />
            </label>
            <label>Пароль
              <input type="password" name="password" autoComplete="current-password" maxLength={256}
                required value={password} onChange={(event) => setPassword(event.target.value)} disabled={busy} />
            </label>
          </> : sent ? <>
            <p role="status">Отправили письмо на <strong>{email}</strong>.</p>
            <label>Код из письма
              <input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{8}"
                maxLength={8} required value={code} onChange={(event) => setCode(event.target.value)} disabled={busy} />
            </label>
          </> : <label>Email
            <input type="email" name="email" autoComplete="email" autoCapitalize="none" spellCheck={false}
              maxLength={254} required value={email} onChange={(event) => setEmail(event.target.value)} disabled={busy} />
          </label>}
          {error && <p className="sign-in__error" role="alert">{error}</p>}
          <button className="button button--gold" type="submit" disabled={busy}>
            {busy ? 'Подождите…' : legacy || sent ? 'Войти' : 'Получить код'}
          </button>
          {sent && <button type="button" className="text-button" disabled={busy} onClick={resetCode}>
            Запросить новый код или изменить email
          </button>}
          <button type="button" className="text-button" disabled={busy} onClick={() => {
            setLegacy(!legacy)
            setPassword('')
            resetCode()
          }}>{legacy ? 'Войти по email' : 'У меня уже есть ник и пароль'}</button>
        </form>
      </div>
      <Link to="/nominations" className="link-inline">К номинациям</Link>
    </section>
  )
}
