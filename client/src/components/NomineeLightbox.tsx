import { useEffect, useRef } from 'react'
import { ArrowLeft, ArrowRight, X } from 'lucide-react'
import { NomineeArtwork } from './NomineeArtwork'
import type { Nominee } from '../data/categories'

export type LightboxItem = {
  nominee: Nominee
  categoryId: string
  category: string
}

type NomineeLightboxProps = {
  items: LightboxItem[]
  index: number
  onClose: () => void
  onNavigate: (index: number) => void
}

export function NomineeLightbox({ items, index, onClose, onNavigate }: NomineeLightboxProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const previousFocus = useRef<HTMLElement | null>(null)
  const item = items[index]

  useEffect(() => {
    previousFocus.current = document.activeElement as HTMLElement | null
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
    closeRef.current?.focus()
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
      if (dialog?.open) dialog.close()
      previousFocus.current?.focus()
    }
  }, [])

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (items.length < 2) return
      if (event.key === 'ArrowRight') {
        event.preventDefault()
        onNavigate((index + 1) % items.length)
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        onNavigate((index - 1 + items.length) % items.length)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [index, items.length, onNavigate])

  if (!item) return null

  const previous = items[(index - 1 + items.length) % items.length]
  const next = items[(index + 1) % items.length]

  return (
    <dialog
      ref={dialogRef}
      className="lightbox"
      aria-labelledby="lightbox-title"
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="lightbox__panel">
        <div className="lightbox__bar">
          <div>
            <p className="eyebrow">{item.category}</p>
            <h2 id="lightbox-title">{item.nominee.name}</h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="lightbox__close"
            onClick={onClose}
            aria-label="Закрыть изображение"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <div className="lightbox__viewport">
          {items.length > 1 && (
            <button
              type="button"
              className="lightbox__nav lightbox__nav--prev"
              onClick={() => onNavigate((index - 1 + items.length) % items.length)}
              aria-label={`Предыдущее изображение: ${previous.nominee.name}`}
            >
              <ArrowLeft size={20} aria-hidden="true" />
            </button>
          )}
          <div className="lightbox__stage">
            <NomineeArtwork
              key={item.nominee.id}
              nominee={item.nominee}
              categoryId={item.categoryId}
              className="lightbox__art"
              eager
              fullSize
            />
          </div>
          {items.length > 1 && (
            <button
              type="button"
              className="lightbox__nav lightbox__nav--next"
              onClick={() => onNavigate((index + 1) % items.length)}
              aria-label={`Следующее изображение: ${next.nominee.name}`}
            >
              <ArrowRight size={20} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </dialog>
  )
}
