import type { ReactNode } from 'react'

const icons: Record<string, ReactNode> = {
  'king-itd': (
    <>
      <path d="M5 23h22" />
      <path d="M5.2 22.5 4 10.8l6.4 4.1L16 7l5.6 7.9 6.4-4.1-1.2 11.7" />
      <path d="M11.5 18h9" opacity=".45" />
      <circle cx="4" cy="10.2" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="16" cy="6.3" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="28" cy="10.2" r="1.1" fill="currentColor" stroke="none" />
    </>
  ),
  'queen-itd': (
    <>
      <path d="M5 23h22" />
      <path d="M6.2 21.5 7.5 10.5l5 3.8L16 7l3.5 7.3 5-3.8 1.3 11" />
      <path d="M16 14.8c-1.1-1.9-3.7-1.2-3.7.7 0 1.5 2.4 3 3.7 3.9 1.3-.9 3.7-2.4 3.7-3.9 0-1.9-2.6-2.6-3.7-.7Z" fill="currentColor" opacity=".2" />
      <circle cx="7.5" cy="9.7" r="1" fill="currentColor" stroke="none" />
      <circle cx="24.5" cy="9.7" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  'ship-goda': (
    <>
      <circle cx="12.5" cy="18" r="6.5" />
      <circle cx="19.5" cy="18" r="6.5" />
      <path d="M16 8v3M14.5 9.5h3" />
      <path d="M16 20c-1.7 0-3-1.2-3-2.7 0-1.3 1.7-2 3-.8 1.3-1.2 3-.5 3 .8 0 1.5-1.3 2.7-3 2.7Z" fill="currentColor" opacity=".2" />
    </>
  ),
  'artist-goda': (
    <>
      <path d="M16 5.5c6 0 10.5 4.4 10.5 9.8 0 3.2-2.3 5.2-5 5.2h-1.4c-1.5 0-2.6 1-2.6 2.3 0 .7.3 1.2.3 2 0 1.9-1.5 3.7-4 3.7-5.5 0-9.8-4.6-9.8-10.4C4 10.1 9.4 5.5 16 5.5Z" />
      <circle cx="11" cy="12" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="16" cy="9.5" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="21" cy="12" r="1.3" fill="currentColor" stroke="none" />
      <path d="M25.5 4.5v3M24 6h3" opacity=".6" />
    </>
  ),
  'meme-goda': (
    <>
      <circle cx="16" cy="16.5" r="10" />
      <path d="M11.5 13.8c.7-1 2-1 2.8 0M17.7 13.8c.7-1 2-1 2.8 0" />
      <path d="M10.8 18.8c1.1 3.2 3.1 5 5.2 5s4.1-1.8 5.2-5c-3.5 1.1-6.9 1.1-10.4 0Z" fill="currentColor" opacity=".18" />
      <path d="m26 4 .7 1.6 1.6.7-1.6.7L26 8.6l-.7-1.6-1.6-.7 1.6-.7L26 4Z" fill="currentColor" stroke="none" />
    </>
  ),
  'news-goda': (
    <>
      <path d="M7 8.5h15.5v17H9.5A2.5 2.5 0 0 1 7 23V8.5Z" />
      <path d="M22.5 11.5h2a2 2 0 0 1 2 2v9.5a2.5 2.5 0 0 1-2.5 2.5H9.5" />
      <path d="M10.5 13h8M10.5 16.5h8M10.5 20h4.5" />
      <path d="M22.5 15h2M22.5 18.5h2" opacity=".5" />
    </>
  ),
  'streamer-goda': (
    <>
      <rect x="4" y="7" width="24" height="16" rx="3" />
      <path d="m13.5 11.2 7 4.8-7 4.8v-9.6Z" fill="currentColor" opacity=".2" />
      <path d="M16 23v3M11.5 27h9" />
      <circle cx="24.5" cy="10.5" r="1.2" fill="currentColor" stroke="none" />
    </>
  ),
  'cosplay-goda': (
    <>
      <path d="M5.5 12.5c3.4-1.8 7-1.8 10.5 0 3.5-1.8 7.1-1.8 10.5 0 .7 6.2-2.5 10.4-6.4 12.3-1.4.7-2.8.7-4.2 0-3.9-1.9-7.1-6.1-6.4-12.3Z" />
      <path d="M10.5 15.2c1.2-1.7 3.2-1.7 4.3 0-.6 1.9-3.7 1.9-4.3 0Z" fill="currentColor" opacity=".2" />
      <path d="M17.2 15.2c1.1-1.7 3.1-1.7 4.3 0-.6 1.9-3.7 1.9-4.3 0Z" fill="currentColor" opacity=".2" />
      <path d="M14 21c1.3.8 2.7.8 4 0" />
      <path d="M24 8.2c1.9-2.2 3.9-2.6 3.9-2.6s-.1 2.2-1.7 3.6" opacity=".55" />
    </>
  ),
  'zavoz-goda': (
    <>
      <rect x="6" y="11" width="20" height="14" rx="1.5" />
      <path d="M6 16h20M16 11v14" />
      <path d="M10 8h12l-2-3.5H12L10 8Z" />
      <path d="M15 18.5h2v2h-2z" fill="currentColor" opacity=".25" stroke="none" />
      <path d="m25 4.5.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6.6-1.4Z" fill="currentColor" stroke="none" opacity=".65" />
    </>
  ),
  'event-goda': (
    <>
      <rect x="4.5" y="8" width="23" height="18" rx="2.5" />
      <path d="M4.5 13h23M10.5 5v5.5M21.5 5v5.5" />
      <path d="m16 16.5.8 1.7 1.9.3-1.4 1.4.3 1.9-1.6-.9-1.6.9.3-1.9-1.4-1.4 1.9-.3.8-1.7Z" fill="currentColor" opacity=".22" />
    </>
  ),
  'project-goda': (
    <>
      <path d="M16 4.5c3.8 2 5.8 5.8 5.8 10.1L18.5 20h-5l-3.3-5.4C10.2 10.3 12.2 6.5 16 4.5Z" />
      <circle cx="16" cy="11.8" r="2.1" />
      <path d="m11.8 15.5-3.5 2 2.1 4 3.2-1.7M20.2 15.5l3.5 2-2.1 4-3.2-1.7" />
      <path d="m14.3 23.4 1.7 4 1.7-4" />
    </>
  ),
  'track-goda': (
    <>
      <circle cx="15" cy="17" r="9.5" />
      <circle cx="15" cy="17" r="3.2" />
      <circle cx="15" cy="17" r=".9" fill="currentColor" stroke="none" />
      <path d="M25.5 4.5v7.2a2.4 2.4 0 1 1-1.7-2.3" />
      <path d="M25.5 4.5c1.3.4 2.2 1.2 2.5 2.4" opacity=".55" />
    </>
  ),
  'dobryak-goda': (
    <>
      <path d="M16 22c-4.3 0-7.2-2.7-7.2-6.1 0-2.9 3.5-4.4 5.8-1.9L16 15.4l1.4-1.4c2.3-2.5 5.8-1 5.8 1.9 0 3.4-2.9 6.1-7.2 6.1Z" />
      <path d="M16 4.5v3.2M8.4 7.5l1.9 2.5M23.6 7.5l-1.9 2.5M5.5 15h2.6M23.9 15h2.6" opacity=".6" />
      <path d="M9.5 25.5c1.8 1.5 4 2.3 6.5 2.3s4.7-.8 6.5-2.3" opacity=".45" />
    </>
  ),
  'interactive-goda': (
    <>
      <path d="M9 11h14c2.8 0 4.5 2.1 5.2 5l1 4.3c.6 2.4-2.2 4.1-4 2.4l-2.5-2.4H9.3l-2.5 2.4c-1.8 1.7-4.6 0-4-2.4l1-4.3C4.5 13.1 6.2 11 9 11Z" />
      <path d="M10.5 15v3M9 16.5h3" />
      <circle cx="21" cy="15.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="23" cy="18" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  'interview-goda': (
    <>
      <rect x="12" y="4.5" width="8" height="13" rx="4" />
      <path d="M8.5 14.5a7.5 7.5 0 0 0 15 0M16 22v5M12 27h8" />
      <path d="M14.5 9h3M14.5 11.5h3" opacity=".5" />
    </>
  ),
  'photographer-goda': (
    <>
      <path d="M4.5 11.5h5l2-3h9l2 3h5A1.5 1.5 0 0 1 29 13v11a1.5 1.5 0 0 1-1.5 1.5h-23A1.5 1.5 0 0 1 3 24V13a1.5 1.5 0 0 1 1.5-1.5Z" />
      <circle cx="16" cy="18" r="4.5" />
      <circle cx="25" cy="14" r="1" fill="currentColor" stroke="none" />
      <path d="M16 15.5a2.5 2.5 0 0 0-2.5 2.5" opacity=".5" />
    </>
  ),
  'shitposter-goda': (
    <>
      <path d="M16 4.5 26 8v7c0 6-4.2 10.5-10 12.5C10.2 25.5 6 21 6 15V8l10-3.5Z" />
      <path d="m17.5 9.5-6 8h4l-1 5.5 6-8h-4l1-5.5Z" fill="currentColor" opacity=".22" />
      <path d="M11 20.5h10" opacity=".4" />
    </>
  ),
}

type CategoryIconProps = {
  id: string
  size?: number
  className?: string
}

export function CategoryIcon({ id, size = 24, className }: CategoryIconProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {icons[id] ?? icons['event-goda']}
    </svg>
  )
}
