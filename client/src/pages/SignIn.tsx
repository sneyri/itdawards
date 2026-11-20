import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowUpRight, Check, Send, X } from 'lucide-react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useVotes } from '../context/VotesContext'
import { signIn } from '../lib/awardsApi'

function safeReturnPath(value: string | null) {
  if (!value || !/^\/(?![/\\])[^\\\r\n]*$/.test(value)) return '/nominations'
  const url = new URL(value, window.location.origin)
  return /^\/(?:nominations(?:\/[a-z0-9-]+)?\/?|my-votes\/?|about\/?|questions\/?|admin\/?)?$/.test(url.pathname)
    ? url.pathname + url.search + url.hash
    : '/nominations'
}

export function SignIn({ modal = false }: { modal?: boolean }) {
  const { auth } = useVotes()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const returnPath = safeReturnPath(params.get('return_to'))
  const dialogRef = useRef<HTMLDialogElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!modal) {
      document.title = 'Вход · ITD AWARDS 2026'
      return
    }
    const dialog = dialogRef.current
    dialog?.showModal()
    inputRef.current?.focus({ preventScroll: true })
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      dialog?.close()
      document.body.style.overflow = previousOverflow
    }
  }, [modal])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    setError('')
    setBusy(true)
    try {
      await signIn(code.trim())
      window.location.replace(returnPath)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Не удалось войти. Попробуйте ещё раз.')
      setBusy(false)
    }
  }

  function close() {
    if (!busy) navigate(-1)
  }

  const form = (
    <div className="ticket-modal__dialog">
      {modal && (
        <button type="button" className="ticket-modal__close" aria-label="Закрыть окно входа"
          onClick={close} disabled={busy}>
          <X size={17} aria-hidden="true" />
        </button>
      )}
      <p className="eyebrow">Вход в ITD Awards</p>
      <h2 id="ticket-title">Билет участника</h2>
      {auth.user ? (
        <>
          <p className="ticket-modal__lead">Вы вошли как <strong>{auth.user.displayName || 'участник'}</strong>.</p>
          {returnPath.startsWith('/admin') ? (
            <a className="button button--gold ticket-modal__submit" href={returnPath}>Продолжить</a>
          ) : (
            <Link className="button button--gold ticket-modal__submit" to={returnPath} replace>Продолжить</Link>
          )}
        </>
      ) : (
        <>
          <p className="ticket-modal__lead">Получите одноразовый код у бота и введите его, чтобы войти.</p>
          <div className="ticket-modal__ticket" aria-hidden="true">
            <span className="ticket-modal__ticket-top">ITD AWARDS · 2026</span>
            <strong className="ticket-modal__ticket-number">Код участника</strong>
            <span className="ticket-modal__ticket-bottom"><span>Один голос</span><span>Сезон 2026</span></span>
          </div>
          {auth.botUrl && (
            <a className="ticket-modal__bot" href={auth.botUrl} target="_blank" rel="noreferrer">
              <span className="ticket-modal__bot-icon" aria-hidden="true"><Send size={17} /></span>
              <span className="ticket-modal__bot-text">
                <strong>Открыть Telegram-бота</strong>
                <small>Нажмите «Запустить» или отправьте /login</small>
              </span>
              <ArrowUpRight size={16} aria-hidden="true" />
            </a>
          )}
          <form className="ticket-modal__form" onSubmit={submit}>
            <label htmlFor="telegram-code">Код из Telegram</label>
            <input id="telegram-code" name="code" ref={inputRef} className="ticket-modal__input"
              value={code} onChange={(event) => { setCode(event.target.value); setError('') }}
              autoComplete="one-time-code" autoCapitalize="characters" spellCheck={false}
              placeholder="XXXX-XXXX-XXXX" aria-invalid={Boolean(error)}
              aria-describedby={error ? 'ticket-error' : undefined} required disabled={busy} maxLength={40} />
            {error && <p id="ticket-error" className="ticket-modal__error" role="alert">{error}</p>}
            <button type="submit" className="button button--gold ticket-modal__submit" disabled={busy || !code.trim()}>
              {busy ? 'Проверяем код…' : 'Войти'}
              <Check size={16} aria-hidden="true" />
            </button>
          </form>
          <p className="ticket-modal__note">Код действует пять минут. Если он истёк, запросите новый через /newcode.</p>
          <p className="ticket-modal__note">
            <a className="link-inline" href={returnPath.startsWith('/admin') ? '/account?return_to=%2Fadmin' : '/account#invite'}>
              Вход по приглашению или с паролем
            </a>
          </p>
        </>
      )}
    </div>
  )

  return modal ? (
    <dialog ref={dialogRef} className="telegram-dialog" aria-labelledby="ticket-title" onCancel={(event) => {
      event.preventDefault()
      close()
    }}>
      <div className="ticket-modal" onClick={(event) => { if (event.target === event.currentTarget) close() }}>
        {form}
      </div>
    </dialog>
  ) : (
    <section className="section container telegram-login" aria-labelledby="ticket-title">{form}</section>
  )
}
