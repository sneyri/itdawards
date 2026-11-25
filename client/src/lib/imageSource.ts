import { useState } from 'react'

export function useImageSource(original: string | null, thumbnail: string | null, fullSize = false) {
  const [failed, setFailed] = useState<string[]>([])
  const localWebp = original && /^\/assets\/upstream\/images\/nominee-(?:itdking|queen-zyska)\.png$/.test(original)
    ? original.replace(/\.png$/, '.webp') : null
  const candidates = fullSize ? [original, thumbnail] : [thumbnail, localWebp, original]
  const source = candidates.find((url) => url && !failed.includes(url))
  return {
    source,
    fail: () => { if (source) setFailed((previous) => [...previous, source]) },
  }
}
