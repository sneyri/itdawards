import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, CSSProperties } from 'react'
import { Pause, Play, Volume2, VolumeX } from 'lucide-react'

type TrackPlayerProps = {
  src: string
  title: string
}

function formatTime(value: number): string {
  if (!Number.isFinite(value) || value < 1) return '0:00'
  const minutes = Math.floor(value / 60)
  const seconds = Math.floor(value % 60)
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

export function TrackPlayer({ src, title }: TrackPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const previousVolumeRef = useRef(1)
  const [playing, setPlaying] = useState(false)
  const [current, setCurrent] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(100)
  const [muted, setMuted] = useState(false)
  const [failed, setFailed] = useState(false)

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
    const onVolumeChange = () => {
      setVolume(Math.round(audio.volume * 100))
      setMuted(audio.muted)
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
    audio.addEventListener('volumechange', onVolumeChange)
    audio.addEventListener('error', onError)

    return () => {
      audio.removeEventListener('timeupdate', onTime)
      audio.removeEventListener('loadedmetadata', onMetadata)
      audio.removeEventListener('durationchange', onMetadata)
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('volumechange', onVolumeChange)
      audio.removeEventListener('error', onError)
    }
  }, [])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.pause()
    audio.currentTime = 0
    setCurrent(0)
    setDuration(0)
    setFailed(false)
    audio.load()
  }, [src])

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
    if (!audio || !Number.isFinite(next) || duration <= 0) return
    audio.currentTime = Math.max(0, Math.min(next, duration))
    setCurrent(audio.currentTime)
  }

  const changeVolume = (event: ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current
    const next = Number(event.target.value)
    if (!audio || !Number.isFinite(next)) return
    const normalized = Math.max(0, Math.min(100, next)) / 100
    if (normalized > 0) previousVolumeRef.current = normalized
    audio.volume = normalized
    audio.muted = normalized === 0
  }

  const toggleMute = () => {
    const audio = audioRef.current
    if (!audio) return
    if (audio.muted || audio.volume === 0) {
      audio.volume = previousVolumeRef.current || 1
      audio.muted = false
    } else {
      previousVolumeRef.current = audio.volume
      audio.muted = true
    }
  }

  const progress = duration > 0 ? Math.min(100, (current / duration) * 100) : 0

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
        <span className="track-player__volume">
          <button
            type="button"
            className="track-player__mute"
            onClick={toggleMute}
            aria-label={muted ? `Включить звук: ${title}` : `Выключить звук: ${title}`}
          >
            {muted || volume === 0 ? <VolumeX size={14} /> : <Volume2 size={14} />}
          </button>
          <input
            type="range"
            className="track-player__volume-range"
            min={0}
            max={100}
            step={1}
            value={volume}
            onChange={changeVolume}
            aria-label={`Громкость: ${title}`}
            style={{ '--volume-progress': `${volume}%` } as CSSProperties}
          />
          <span className="track-player__volume-value">{volume}%</span>
        </span>
      </div>
    </div>
  )
}
