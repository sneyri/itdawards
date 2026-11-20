export const EVENT = {
  ceremonyAt: import.meta.env.VITE_CEREMONY_AT as string | undefined,
  edition: 'VOL. 01',
  year: 2026,
}

const dateTime = new Intl.DateTimeFormat('ru-RU', {
  timeZone: 'Europe/Moscow',
  day: 'numeric',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
})

export function eventDateLabel(value: string | null | undefined): string | null {
  const date = value ? new Date(value) : null
  return date && Number.isFinite(date.valueOf()) ? `${dateTime.format(date)} МСК` : null
}
