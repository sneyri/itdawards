export function formatNumber(value: number): string {
  return new Intl.NumberFormat('ru-RU').format(value)
}

export function pluralize(value: number, one: string, few: string, many: string): string {
  const mod100 = Math.abs(value) % 100
  const mod10 = mod100 % 10
  if (mod100 >= 11 && mod100 <= 14) return many
  if (mod10 === 1) return one
  if (mod10 >= 2 && mod10 <= 4) return few
  return many
}

export function makeInitials(name: string): string {
  const cleaned = name.replace(/[«»"'#@]/g, '').trim()
  const words = cleaned.split(/\s+/).filter(Boolean)
  const [first = '•', next = ''] = Array.from(words[0] ?? '')
  const second = words[1] ? Array.from(words[1])[0] : next
  return `${first}${second}`.toUpperCase()
}

export function makeTone(seed: string): number {
  let hash = 0
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) % 360
  }
  return 58 + (hash % 78)
}
