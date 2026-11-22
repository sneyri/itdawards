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
  const [playing, setPlaying] = useState(false)
  const [current, setCurrent] = useState(0)
  const [duration, setDuration] = useState(0)
  const [failed, setFailed] = useState(false)
  const [volume, setVolume] = useState(1)
  const [muted, setMuted] = useState(false)

  const syncMeta = () => {
    const audio = audioRef.current
    if (!audio) return
    setDuration(Number.isFinite(audio.duration) ? audio.duration : 0)
    setCurrent(audio.currentTime)
  }

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const onTime = () => setCurrent(audio.currentTime)
    const onMetadata = syncMeta
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

  useEffect(() => {
    const audio = audioRef.current
    if (audio) audio.volume = volume
  }, [volume])

  useEffect(() => {
    const audio = audioRef.current
    if (audio) audio.muted = muted
  }, [muted])

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

  const changeVolume = (event: ChangeEvent<HTMLInputElement>) => {
    setVolume(Number(event.target.value))
    setMuted(false)
  }

  const progress = duration > 0 ? Math.min(100, (current / duration) * 100) : 0
  const volumeLevel = muted ? 0 : volume

  return (
    <div className={`track-player ${failed ? 'has-error' : ''}`} role="group" aria-label={`Аудиофрагмент: ${title}`}>
      <audio ref={audioRef} src={src} preload="none" onLoadedMetadata={syncMeta} />
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
        <div className={`track-player__volume ${playing ? '' : 'is-idle'}`}>
          <button
            type="button"
            className="track-player__mute"
            onClick={() => setMuted((value) => !value)}
            aria-label={muted ? `Включить звук: ${title}` : `Выключить звук: ${title}`}
          >
            {muted ? <VolumeX size={13} aria-hidden="true" /> : <Volume2 size={13} aria-hidden="true" />}
          </button>
          <input
            type="range"
            className="track-player__volume-range"
            min={0}
            max={1}
            step={0.05}
            value={volumeLevel}
            onChange={changeVolume}
            aria-label={`Громкость: ${title}`}
            style={{ '--track-progress': `${volumeLevel * 100}%` } as CSSProperties}
          />
        </div>
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
