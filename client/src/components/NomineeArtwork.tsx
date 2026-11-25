import { memo, useId, useState } from 'react'
import type { Nominee } from '../data/categories'
import { makeInitials } from '../lib/format'
import { useImageSource } from '../lib/imageSource'
import { getNomineeVisual } from '../lib/nomineeVisual'

type Palette = {
  from: string
  to: string
  glow: string
  skin: string
  hair: string
  cloth: string
  accent: string
}

const palettes: Palette[] = [
  {
    from: '#1d3026',
    to: '#070c09',
    glow: '#b7d0b2',
    skin: '#e2c1a0',
    hair: '#241d18',
    cloth: '#42563b',
    accent: '#ecd9a7',
  },
  {
    from: '#30243d',
    to: '#0c0912',
    glow: '#d8b3dc',
    skin: '#c9956f',
    hair: '#171310',
    cloth: '#51405f',
    accent: '#e7c9a3',
  },
  {
    from: '#1b2a3d',
    to: '#070b12',
    glow: '#9fc2d8',
    skin: '#8f5f43',
    hair: '#100d0b',
    cloth: '#34475c',
    accent: '#dfc28e',
  },
  {
    from: '#3a2324',
    to: '#120a0a',
    glow: '#dc9f91',
    skin: '#d9ad88',
    hair: '#5a2c21',
    cloth: '#60403a',
    accent: '#f0d4a4',
  },
  {
    from: '#25282a',
    to: '#0a0b0c',
    glow: '#b6c0ba',
    skin: '#a96f4e',
    hair: '#181411',
    cloth: '#3f4643',
    accent: '#e3c58e',
  },
  {
    from: '#28331f',
    to: '#0a0e07',
    glow: '#c3d29d',
    skin: '#e7c5a2',
    hair: '#a67c3e',
    cloth: '#4e5c3b',
    accent: '#edd9a4',
  },
  {
    from: '#162b31',
    to: '#060c0e',
    glow: '#9fcac5',
    skin: '#a66c48',
    hair: '#101312',
    cloth: '#2d4a4b',
    accent: '#d9c08a',
  },
  {
    from: '#332a20',
    to: '#100c08',
    glow: '#d2b68b',
    skin: '#d7ab86',
    hair: '#b8b3a7',
    cloth: '#504435',
    accent: '#f0d9a8',
  },
  {
    from: '#211e38',
    to: '#090812',
    glow: '#aba4dd',
    skin: '#6f4632',
    hair: '#13100e',
    cloth: '#3b3758',
    accent: '#e8cd97',
  },
  {
    from: '#1d2b2d',
    to: '#070b0b',
    glow: '#a5c4bb',
    skin: '#e0b894',
    hair: '#7a3f2b',
    cloth: '#3d4f4e',
    accent: '#ecd4a1',
  },
]

function makeHash(seed: string): number {
  let hash = 2166136261
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

type NomineeArtworkProps = {
  nominee: Nominee
  categoryId: string
  className?: string
  eager?: boolean
  fullSize?: boolean
}

export const NomineeArtwork = memo(function NomineeArtwork({
  nominee, categoryId, className, eager = false, fullSize = false,
}: NomineeArtworkProps) {
  const { source, fail } = useImageSource(nominee.photo, nominee.thumbnailUrl, fullSize)
  const [fallbackFailed, setFallbackFailed] = useState<string>()
  const visual = source ? 'photo' : getNomineeVisual(categoryId, nominee, nominee.photo)
  const fallbackImage = categoryId === 'king-itd'
    ? '/fallback/king.png'
    : categoryId === 'queen-itd'
      ? '/fallback/queen.png'
      : null
  const classes = ['nominee-art', `nominee-art--${visual}`, className].filter(Boolean).join(' ')

  if (source) {
    return (
      <picture className="nominee-art-picture">
        <img
          className={classes}
          src={source}
          alt={nominee.photoAlt ?? nominee.name}
          loading={eager ? 'eager' : 'lazy'}
          fetchPriority={eager ? 'high' : undefined}
          decoding="async"
          draggable={false}
          referrerPolicy="no-referrer"
          onError={fail}
        />
      </picture>
    )
  }

  if (visual === 'track') {
    return <TrackArt nominee={nominee} className={classes} />
  }

  if (visual === 'portrait') {
    if ((nominee.photo || nominee.thumbnailUrl) && fallbackImage && fallbackFailed !== nominee.id) {
      return (
        <img
          className={classes}
          src={fallbackImage}
          alt={nominee.photoAlt ?? nominee.name}
          loading={eager ? 'eager' : 'lazy'}
          draggable={false}
          onError={() => setFallbackFailed(nominee.id)}
        />
      )
    }
    return <Portrait nominee={nominee} className={classes} />
  }

  return <Emblem nominee={nominee} className={classes} />
})

function Portrait({ nominee, className }: { nominee: Nominee; className: string }) {
  const uid = useId().replace(/:/g, '')
  const hash = makeHash(nominee.id)
  const palette = palettes[hash % palettes.length]
  const hairStyle = (hash >>> 4) % 5
  const accessory = (hash >>> 9) % 5
  const mood = (hash >>> 14) % 3

  const face = (
    <>
      <ellipse cx="39" cy="55" rx="4.2" ry="6" fill={palette.skin} />
      <ellipse cx="81" cy="55" rx="4.2" ry="6" fill={palette.skin} />
      <ellipse cx="60" cy="52" rx="21" ry="25" fill={palette.skin} />
      <path
        d={mood === 2 ? 'M46 46q5 -3 9 0M65 45q5 -2 9 1' : 'M46 46q5 -2 9 0M65 46q5 -2 9 0'}
        stroke={palette.hair}
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
        opacity="0.72"
      />
      {mood === 1 ? (
        <path d="M48 54h6M66 54h6" stroke="#241b14" strokeWidth="1.5" strokeLinecap="round" />
      ) : (
        <>
          <circle cx="51" cy="54" r="1.6" fill="#1e1712" />
          <circle cx="69" cy="54" r="1.6" fill="#1e1712" />
        </>
      )}
      <path
        d="M60 55v6l3 2"
        stroke={palette.hair}
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        opacity="0.55"
      />
      <path
        d={mood === 2 ? 'M54 67q7 5 13 0' : 'M54 66q6 4 12 0'}
        stroke="#5b382d"
        strokeWidth="1.7"
        strokeLinecap="round"
        fill="none"
      />
      <ellipse cx="45" cy="61" rx="4" ry="2" fill="#c67f6c" opacity="0.24" />
      <ellipse cx="75" cy="61" rx="4" ry="2" fill="#c67f6c" opacity="0.24" />
    </>
  )

  return (
    <svg className={className} viewBox="0 0 120 120" aria-hidden="true">
      <defs>
        <linearGradient id={`bg-${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor={palette.from} />
          <stop offset="1" stopColor={palette.to} />
        </linearGradient>
        <radialGradient id={`glow-${uid}`} cx="0.5" cy="0.42" r="0.55">
          <stop stopColor={palette.glow} stopOpacity="0.36" />
          <stop offset="1" stopColor={palette.glow} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="120" height="120" fill={`url(#bg-${uid})`} />
      <circle cx="60" cy="52" r="47" fill={`url(#glow-${uid})`} />
      <path
        d="M14 98c8-38 30-66 70-78M108 24c-2 14-8 24-20 30"
        stroke={palette.accent}
        strokeOpacity="0.2"
        strokeWidth="1"
        fill="none"
      />
      <circle cx="101" cy="22" r="2" fill={palette.accent} opacity="0.5" />
      <circle cx="20" cy="34" r="1.3" fill={palette.accent} opacity="0.35" />

      {hairStyle === 1 && (
        <path
          d="M34 79c-4-15-3-34 2-44 5-10 14-15 24-15s19 5 24 15c5 10 6 29 2 44-3-1-5-7-6-16-5 3-12 4-20 4s-15-1-20-4c-1 9-3 15-6 16Z"
          fill={palette.hair}
        />
      )}
      {hairStyle === 2 && (
        <path
          d="M35 86c-7-20-5-49 5-60 5-6 12-9 20-9s15 3 20 9c10 11 12 40 5 60-2-2-4-16-4-32-4 2-10 3-21 3s-17-1-21-3c0 16-2 30-4 32Z"
          fill={palette.hair}
        />
      )}
      {hairStyle === 4 && (
        <g fill={palette.hair}>
          <circle cx="41" cy="36" r="12" />
          <circle cx="50" cy="26" r="12" />
          <circle cx="63" cy="23" r="12" />
          <circle cx="75" cy="29" r="11" />
          <circle cx="82" cy="42" r="10" />
          <circle cx="38" cy="49" r="9" />
        </g>
      )}

      <path d="M14 120c3-19 20-33 46-33s43 14 46 33Z" fill={palette.cloth} />
      <path
        d="M48 89l12 14 12-14"
        fill="none"
        stroke={palette.accent}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.45"
      />
      <path d="M53 72h14v15H53z" fill={palette.skin} opacity="0.9" />

      {face}

      {hairStyle === 0 && (
        <path
          d="M38 51c0-17 9-27 22-27s22 10 22 27c-3-9-11-13-22-13s-19 4-22 13Z"
          fill={palette.hair}
        />
      )}
      {hairStyle === 1 && (
        <path
          d="M38 45c4-11 12-17 22-17s18 6 22 17c-7-4-14-6-22-6s-15 2-22 6Z"
          fill={palette.hair}
        />
      )}
      {hairStyle === 2 && (
        <path
          d="M38 44c3-10 11-16 22-16s19 6 22 16c-6-3-13-5-22-5s-16 2-22 5Z"
          fill={palette.hair}
        />
      )}
      {hairStyle === 3 && (
        <>
          <circle cx="60" cy="19" r="10" fill={palette.hair} />
          <path
            d="M38 51c0-16 9-26 22-26s22 10 22 26c-3-8-11-12-22-12s-19 4-22 12Z"
            fill={palette.hair}
          />
        </>
      )}
      {hairStyle === 4 && (
        <path
          d="M39 51c0-15 8-24 21-24s21 9 21 24c-4-7-10-11-21-11s-17 4-21 11Z"
          fill={palette.hair}
        />
      )}

      {accessory === 1 && (
        <g fill="none" stroke={palette.accent} strokeWidth="1.7">
          <rect x="42" y="47" width="15" height="13" rx="6" />
          <rect x="63" y="47" width="15" height="13" rx="6" />
          <path d="M57 53h6M42 52l-5-2M78 52l5-2" strokeLinecap="round" />
        </g>
      )}
      {accessory === 2 && (
        <>
          <circle cx="82" cy="63" r="2.2" fill={palette.accent} />
          <path d="M82 61v-4" stroke={palette.accent} strokeWidth="1.2" />
        </>
      )}
      {accessory === 3 && (
        <g fill="none" stroke={palette.accent} strokeWidth="2">
          <path d="M37 52c0-27 46-27 46 0" strokeLinecap="round" />
          <rect x="33" y="48" width="8" height="15" rx="4" fill={palette.accent} stroke="none" />
          <rect x="79" y="48" width="8" height="15" rx="4" fill={palette.accent} stroke="none" />
        </g>
      )}
      {accessory === 4 && (
        <path
          d="M52 83q8 8 16 0"
          fill="none"
          stroke={palette.accent}
          strokeWidth="1.4"
          strokeLinecap="round"
          opacity="0.8"
        />
      )}
    </svg>
  )
}

function Emblem({ nominee, className }: { nominee: Nominee; className: string }) {
  const uid = useId().replace(/:/g, '')
  const hash = makeHash(nominee.id)
  const rotation = hash % 24
  const initials = makeInitials(nominee.name)
  const palette = palettes[hash % palettes.length]
  const accent = palette.accent

  return (
    <svg className={className} viewBox="0 0 120 120" aria-hidden="true">
      <defs>
        <linearGradient id={`bg-${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor={palette.from} />
          <stop offset="1" stopColor={palette.to} />
        </linearGradient>
        <radialGradient id={`glow-${uid}`} cx="0.5" cy="0.5" r="0.5">
          <stop stopColor={accent} stopOpacity="0.28" />
          <stop offset="1" stopColor={accent} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="120" height="120" fill={`url(#bg-${uid})`} />
      <circle cx="60" cy="58" r="48" fill={`url(#glow-${uid})`} />
      <g transform={`rotate(${rotation} 60 60)`}>
        <circle cx="60" cy="58" r="39" fill="none" stroke={accent} strokeOpacity="0.28" />
        <circle cx="60" cy="58" r="32" fill="none" stroke={accent} strokeOpacity="0.18" strokeDasharray="2 5" />
        <path
          d="M60 11l3.2 8.4L72 22l-8.8 2.6L60 33l-3.2-8.4L48 22l8.8-2.6z"
          fill={accent}
          opacity="0.5"
        />
      </g>
      <path d="M15 100h90" stroke={accent} strokeOpacity="0.22" />
      <text
        x="60"
        y="69"
        textAnchor="middle"
        fill="#f2ead9"
        fontFamily="'Cormorant Garamond', Georgia, serif"
        fontSize="31"
        fontWeight="600"
        letterSpacing="1"
      >
        {initials}
      </text>
      <g fill={accent} opacity="0.7">
        <circle cx="24" cy="24" r="1.6" />
        <circle cx="96" cy="92" r="2" />
        <circle cx="28" cy="94" r="1.2" />
        <circle cx="94" cy="28" r="1.2" />
      </g>
    </svg>
  )
}

function TrackArt({ nominee, className }: { nominee: Nominee; className: string }) {
  const uid = useId().replace(/:/g, '')
  const hash = makeHash(nominee.id)
  const palette = palettes[hash % palettes.length]
  const initials = makeInitials(nominee.name)

  return (
    <svg className={className} viewBox="0 0 120 120" aria-hidden="true">
      <defs>
        <linearGradient id={`bg-${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor={palette.from} />
          <stop offset="1" stopColor={palette.to} />
        </linearGradient>
        <radialGradient id={`label-${uid}`} cx="0.35" cy="0.3" r="0.8">
          <stop stopColor="#f4e2b2" />
          <stop offset="1" stopColor={palette.accent} />
        </radialGradient>
      </defs>
      <rect width="120" height="120" fill={`url(#bg-${uid})`} />
      <circle cx="61" cy="61" r="47" fill="#080806" stroke="#3d392e" strokeWidth="1" />
      <g fill="none" stroke="#4c483a" strokeOpacity="0.5">
        <circle cx="60" cy="60" r="43" />
        <circle cx="60" cy="60" r="36" />
        <circle cx="60" cy="60" r="30" />
        <circle cx="60" cy="60" r="24" />
        <circle cx="60" cy="60" r="19" />
      </g>
      <path
        d="M25 47a42 42 0 0 1 26-25"
        fill="none"
        stroke="#f4e2b2"
        strokeOpacity="0.24"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <circle cx="60" cy="60" r="16" fill={`url(#label-${uid})`} />
      <text
        x="60"
        y="63.5"
        textAnchor="middle"
        fill="#1c160d"
        fontFamily="'Cormorant Garamond', Georgia, serif"
        fontSize="10"
        fontWeight="700"
        letterSpacing="0.6"
      >
        {initials}
      </text>
      <circle cx="60" cy="60" r="2.2" fill="#16130d" />
      <circle cx="60" cy="60" r="46" fill="none" stroke={palette.accent} strokeOpacity="0.28" />
    </svg>
  )
}
