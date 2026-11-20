import type { Nominee } from '../data/categories'

export type NomineeVisual = 'photo' | 'track' | 'portrait' | 'emblem'

const portraitCategories = new Set([
  'king-itd',
  'queen-itd',
  'artist-goda',
  'streamer-goda',
  'cosplay-goda',
  'dobryak-goda',
  'photographer-goda',
])

export function getNomineeVisual(categoryId: string, nominee: Nominee, failedPhoto?: string | null): NomineeVisual {
  if (nominee.photo && nominee.photo !== failedPhoto) return 'photo'
  if (nominee.audio) return 'track'
  if (portraitCategories.has(categoryId)) return 'portrait'
  return 'emblem'
}
