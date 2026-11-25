const IMAGE_CACHE = 'itd-images-v2';
const RETIRED_CACHES = ['itd-images-v1', 'itd-audio-v1'];
const mediaPath = /^\/api\/media\/(?:thumbnails\/)?[a-f0-9]{64}$/;

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(Promise.all(RETIRED_CACHES.map((name) => caches.delete(name)))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || request.destination !== 'image') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.search || !mediaPath.test(url.pathname)) return;

  let write = Promise.resolve();
  const response = (async () => {
    const cache = await caches.open(IMAGE_CACHE).catch(() => null);
    const cached = await cache?.match(request).catch(() => null);
    if (cached) return cached;
    const network = await fetch(request);
    const policy = network.headers.get('Cache-Control') ?? '';
    if (cache && network.status === 200 && network.type === 'basic'
      && /\bpublic\b/i.test(policy) && /\bimmutable\b/i.test(policy)
      && !/\b(?:private|no-store)\b/i.test(policy)) {
      write = cache.put(request, network.clone()).catch(() => {});
    }
    return network;
  })();
  event.respondWith(response);
  event.waitUntil(response.then(() => write).catch(() => {}));
});
