export type CategoryGroup = 'people' | 'content' | 'community'
export type CategoryStatus = 'draft' | 'open' | 'closed'

export type Nominee = {
  id: string
  name: string
  handle: string | null
  tagline: string
  song: string | null
  photo: string | null
  photoAlt: string | null
  linkUrl: string | null
  audio: string | null
}

export type Category = {
  id: string
  apiId: number
  title: string
  group: CategoryGroup
  description: string
  status: CategoryStatus
  imageUrl: string | null
  canVote: boolean
  resultsAvailable: boolean
  nominees: Nominee[]
}

export const groupLabels: Record<CategoryGroup, string> = {
  people: 'Люди',
  content: 'Контент',
  community: 'Сообщество',
}

export const statusLabels: Record<CategoryStatus, string> = {
  draft: 'Скоро откроется',
  open: 'Голосование открыто',
  closed: 'Голосование завершено',
}

export function categoryStatusLabel(category: Category): string {
  if (category.status === 'open' && !category.canVote) return 'Голосование сейчас закрыто'
  return statusLabels[category.status]
}

// Keep the design's routes, artwork, and groups when the matching nomination exists in the API.
const presentation: Record<string, [string, CategoryGroup]> = {
  'KING ИТД': ['king-itd', 'people'],
  'KING ITD': ['king-itd', 'people'],
  'QUEEN ИТД': ['queen-itd', 'people'],
  'QUEEN ITD': ['queen-itd', 'people'],
  'Шип года': ['ship-goda', 'community'],
  'Художник года': ['artist-goda', 'people'],
  'Мем года': ['meme-goda', 'content'],
  'Новостной паблик года': ['news-goda', 'content'],
  'СМИ года': ['news-goda', 'content'],
  'Стример года': ['streamer-goda', 'people'],
  'Косплей года': ['cosplay-goda', 'content'],
  'Завоз года': ['zavoz-goda', 'community'],
  'Событие года': ['event-goda', 'community'],
  'Проект года': ['project-goda', 'community'],
  'Трек года': ['track-goda', 'content'],
  'Добряк года': ['dobryak-goda', 'people'],
  'Интерактив года': ['interactive-goda', 'community'],
  'Интервьюер': ['interview-goda', 'community'],
  'Интервьюер года': ['interview-goda', 'community'],
  'Фотограф года': ['photographer-goda', 'people'],
  'Шитпостер года': ['shitposter-goda', 'content'],
  'Щитпостер года': ['shitposter-goda', 'content'],
}

export function getPresentation(title: string): [string, CategoryGroup] | undefined {
  return Object.hasOwn(presentation, title) ? presentation[title] : undefined
}
