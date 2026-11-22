const AUDIO_CACHE = 'itd-audio-v1'
const MAX_FILES = 16
const MAX_BYTES = 60 * 1024 * 1024
const DELAY = 1500
let started = false

function pause(): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, DELAY))
}

async function store(url: string): Promise<number> {
  const cache = await caches.open(AUDIO_CACHE)
  if (await cache.match(url)) return 0
  const response = await fetch(url, { credentials: 'omit', cache: 'force-cache' })
  if (!response.ok) return 0
  const body = await response.blob()
  const headers = new Headers()
  const type = response.headers.get('content-type')
  if (type) headers.set('Content-Type', type)
  await cache.put(url, new Response(body, { headers }))
  return body.size
}

export async function prefetchTracks(urls: string[]): Promise<void> {
  if (started || !('caches' in window)) return
  started = true
  const unique = [...new Set(urls.filter((url) => url.startsWith('/api/audio/')))].slice(0, MAX_FILES)
  let total = 0
  for (const url of unique) {
    if (!navigator.onLine) break
    try {
      total += await store(url)
    } catch {
      break
    }
    if (total >= MAX_BYTES) break
    await pause()
  }
}
