export function webpSource(src: string | null | undefined): string | null {
  if (!src || !/\.png(?:[?#]|$)/i.test(src)) return null
  return src.replace(/\.png(?=[?#]|$)/i, '.webp')
}
