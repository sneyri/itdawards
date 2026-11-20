import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, CSSProperties } from 'react'
import { Pause, Play } from 'lucide-react'

type TrackPlayerProps = {
  src: string
  title: string
}

function makeBars(seed: string): number[] {
  let hash = 2166136261
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return Array.from({ length: 40 }, (_, index) => {
    const value = Math.abs(Math.sin((hash + index * 47) * 0.013))
    return 24 + Math.round(value * 68)
  })
}

function formatTime(value: number): string {
  if (!Number.isFinite(value) || value < 1) return '0:00'
  const minutes = Math.floor(value / 60)
  const seconds = Math.floor(value % 60)
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

export function TrackPlayer({ src, title }: TrackPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [current, setCurrent] = useState(0)
  const [duration, setDuration] = useState(0)
  const [failed, setFailed] = useState(false)
  const bars = makeBars(title)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const onTime = () => setCurrent(audio.currentTime)
    const onMetadata = () => setDuration(Number.isFinite(audio.duration) ? audio.duration : 0)
    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    const onEnded = () => {
      setPlaying(false)
      setCurrent(0)
      audio.currentTime = 0
    }
    const onError = () => {
      setFailed(true)
      setPlaying(false)
    }

    audio.addEventListener('timeupdate', onTime)
    audio.addEventListener('loadedmetadata', onMetadata)
    audio.addEventListener('durationchange', onMetadata)
    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)
    audio.addEventListener('ended', onEnded)
    audio.addEventListener('error', onError)

    return () => {
      audio.removeEventListener('timeupdate', onTime)
      audio.removeEventListener('loadedmetadata', onMetadata)
      audio.removeEventListener('durationchange', onMetadata)
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('error', onError)
    }
  }, [])

  useEffect(() => {
    const pauseOther = (event: Event) => {
      const active = (event as CustomEvent<HTMLAudioElement>).detail
      if (active !== audioRef.current) audioRef.current?.pause()
    }
    window.addEventListener('itd:audio-play', pauseOther)
    return () => window.removeEventListener('itd:audio-play', pauseOther)
  }, [])

  const toggle = async () => {
    const audio = audioRef.current
    if (!audio || failed) return
    if (audio.paused) {
      window.dispatchEvent(new CustomEvent('itd:audio-play', { detail: audio }))
      try {
        await audio.play()
      } catch {
        setFailed(true)
        setPlaying(false)
      }
    } else {
      audio.pause()
    }
  }

  const seek = (event: ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current
    const next = Number(event.target.value)
    if (!audio) return
    audio.currentTime = next
    setCurrent(next)
  }

  const progress = duration > 0 ? Math.min(100, (current / duration) * 100) : 0
  const playedBars = Math.round((progress / 100) * bars.length)

  return (
    <div className={`track-player ${failed ? 'has-error' : ''}`} role="group" aria-label={`Аудиофрагмент: ${title}`}>
      <audio ref={audioRef} src={src} preload="metadata" />
      <button
        type="button"
        className="track-player__play"
        onClick={toggle}
        aria-label={playing ? `Пауза: ${title}` : `Слушать: ${title}`}
        disabled={failed}
      >
        {playing ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
      </button>
      <div className="track-player__main">
        <span className="track-player__wave" aria-hidden="true">
          {bars.map((height, index) => (
            <span
              key={index}
              className={index < playedBars ? 'is-played' : ''}
              style={{ height: `${height}%` }}
            />
          ))}
        </span>
        <input
          type="range"
          className="track-player__range"
          min={0}
          max={duration || 1}
          step={0.1}
          value={Math.min(current, duration || 1)}
          onChange={seek}
          aria-label={`Перемотка: ${title}`}
          disabled={failed || duration === 0}
          style={{ '--track-progress': `${progress}%` } as CSSProperties}
        />
        <span className="track-player__meta">
          <span>{formatTime(current)}</span>
          <span>{failed ? 'аудио недоступно' : formatTime(duration)}</span>
        </span>
      </div>
    </div>
  )
}
