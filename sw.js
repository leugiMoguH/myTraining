/* Treino — service worker
   Shell em cache para funcionar offline.
   Navegação: network-first (apanha updates quando online).
   Assets/imagens: cache-first (rápido e funciona sem rede). */
const CACHE = 'treino-v2';
const CORE = ['./', './index.html', './manifest.json', './favicon.svg', './icon.svg'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const sameOrigin = new URL(req.url).origin === location.origin;

  // HTML / navegação (same-origin) → network-first com fallback à cache (offline)
  if (sameOrigin && (req.mode === 'navigate' || req.destination === 'document')) {
    e.respondWith(
      fetch(req)
        .then(res => { const cp = res.clone(); caches.open(CACHE).then(c => c.put(req, cp)); return res; })
        .catch(() => caches.match(req).then(m => m || caches.match('./index.html')))
    );
    return;
  }

  // assets same-origin + imagens de qualquer origem (ex.: CDN das demos) → cache-first
  if (sameOrigin || req.destination === 'image') {
    e.respondWith(
      caches.match(req).then(m => m || fetch(req).then(res => {
        if (res && (res.status === 200 || res.type === 'opaque')) {
          const cp = res.clone();
          caches.open(CACHE).then(c => c.put(req, cp));
        }
        return res;
      }).catch(() => m))
    );
    return;
  }
});
