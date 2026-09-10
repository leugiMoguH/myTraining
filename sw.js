/* Treino — service worker
   Shell em cache para funcionar offline.
   Navegação: network-first (apanha updates quando online).
   Assets/imagens: cache-first (rápido e funciona sem rede). */
const CACHE = 'treino-v4';
/* instructions.en.json (610 KB) fica de fora: só é preciso ao abrir uma ficha,
   e o handler cache-first abaixo guarda-o na primeira vez que for pedido. */
const CORE = [
  './',
  './index.html',
  './manifest.json',
  './favicon.svg',
  './icon.svg',
  './js/app.js',
  './js/backup.js',
  './js/bridge.js',
  './js/catalog.js',
  './js/charts.js',
  './js/data.js',
  './js/guide.js',
  './js/labels.js',
  './js/loads.js',
  './js/media.js',
  './js/notify.js',
  './js/nutrition.js',
  './js/profile.js',
  './js/progression.js',
  './js/sliders.js',
  './js/state.js',
  './js/timer.js',
  './js/ui.js',
  './js/volume.js',
  './js/wake.js',
  './js/workout.js',
  './data/catalog.json'
];

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
