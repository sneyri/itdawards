import { useState } from 'react'
import { Download, ImageDown } from 'lucide-react'
import { useToast } from '../context/ToastContext'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { createVotesPoster } from '../lib/votesPoster'

type BallotEntry = { title: string; nomineeName?: string }

type PosterButtonProps = {
  ballot: BallotEntry[]
  disabled?: boolean
}

export function PosterButton({ ballot, disabled = false }: PosterButtonProps) {
  const { showToast } = useToast()
  const downloadOnly = useMediaQuery('(max-width: 720px)')
  const [copying, setCopying] = useState(false)

  function downloadPoster(blob: Blob) {
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'itd-awards-2026-moy-golos.png'
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  async function handleClick() {
    if (disabled || !ballot.length || copying) return
    setCopying(true)
    try {
      const blob = await createVotesPoster(ballot)
      if (downloadOnly) {
        downloadPoster(blob)
        showToast('PNG с голосами скачан — прикрепите его к посту.', 'info')
        return
      }
      const canCopyImage = typeof ClipboardItem !== 'undefined' && Boolean(navigator.clipboard?.write)
      if (canCopyImage) {
        try {
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
          showToast('Картинка с голосами скопирована. Можно вставлять в пост.')
          return
        } catch {
          downloadPoster(blob)
          showToast('PNG с голосами скачан — прикрепите его к посту.', 'info')
          return
        }
      }
      downloadPoster(blob)
      showToast('PNG с голосами скачан — прикрепите его к посту.', 'info')
    } catch {
      showToast('Не удалось собрать картинку. Попробуйте ещё раз.', 'error')
    } finally {
      setCopying(false)
    }
  }

  return (
    <button
      type="button"
      className="button button--gold button--sm"
      onClick={handleClick}
      disabled={copying || disabled}
    >
      {downloadOnly ? (
        <Download size={15} aria-hidden="true" />
      ) : (
        <ImageDown size={15} aria-hidden="true" />
      )}
      {copying
        ? 'Собираю картинку…'
        : downloadOnly
          ? 'Скачать картинку'
          : 'Скопировать картинкой'}
    </button>
  )
}
