import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { AlertCircle, Check, Info, X } from 'lucide-react'

type ToastTone = 'success' | 'info' | 'error'

type ToastItem = {
  id: number
  message: string
  tone: ToastTone
}

type ToastContextValue = {
  showToast: (message: string, tone?: ToastTone) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const toneIcons = {
  success: Check,
  info: Info,
  error: AlertCircle,
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastItem | null>(null)

  useEffect(() => {
    if (!toast) return
    const timeout = window.setTimeout(() => setToast(null), 4000)
    return () => window.clearTimeout(timeout)
  }, [toast])

  const showToast = useCallback((message: string, tone: ToastTone = 'success') => {
    setToast({ id: Date.now(), message, tone })
  }, [])

  const value = useMemo(() => ({ showToast }), [showToast])
  const ToastIcon = toast ? toneIcons[toast.tone] : Check

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-viewport" aria-live="polite" aria-atomic="true">
        {toast && (
          <div className={`toast toast--${toast.tone}`} key={toast.id} role="status">
            <span className="toast__icon" aria-hidden="true">
              <ToastIcon size={17} strokeWidth={2.2} />
            </span>
            <span className="toast__message">{toast.message}</span>
            <button
              type="button"
              className="toast__close"
              onClick={() => setToast(null)}
              aria-label="Закрыть уведомление"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast must be used inside ToastProvider')
  return context
}
