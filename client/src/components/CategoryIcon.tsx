import type { LucideIcon } from 'lucide-react'
import {
  CalendarHeart,
  Camera,
  Crown,
  Disc3,
  Gamepad2,
  Gem,
  HandHeart,
  HeartHandshake,
  Laugh,
  Mic,
  MonitorPlay,
  Newspaper,
  PackageOpen,
  Palette,
  Rocket,
  VenetianMask,
  Zap,
} from 'lucide-react'

const icons: Record<string, LucideIcon> = {
  'king-itd': Crown,
  'queen-itd': Gem,
  'ship-goda': HeartHandshake,
  'artist-goda': Palette,
  'meme-goda': Laugh,
  'news-goda': Newspaper,
  'streamer-goda': MonitorPlay,
  'cosplay-goda': VenetianMask,
  'zavoz-goda': PackageOpen,
  'event-goda': CalendarHeart,
  'project-goda': Rocket,
  'track-goda': Disc3,
  'dobryak-goda': HandHeart,
  'interactive-goda': Gamepad2,
  'interview-goda': Mic,
  'photographer-goda': Camera,
  'shitposter-goda': Zap,
}

type CategoryIconProps = {
  id: string
  size?: number
  className?: string
}

export function CategoryIcon({ id, size = 24, className }: CategoryIconProps) {
  const Icon = icons[id] ?? CalendarHeart

  return (
    <Icon
      size={size}
      strokeWidth={1.55}
      className={className}
      aria-hidden="true"
      focusable="false"
    />
  )
}
