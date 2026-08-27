// Praxis offline shell. Caches the app and its assets on first run so the
// installed app opens with no network.
const CACHE = 'praxis-v2';
const ASSETS = [
  'Praxis.dc.html', 'support.js', 'praxis-data.js', 'praxis-geo.js',
  'vendor/leaflet.js', 'vendor/leaflet.css', 'manifest.webmanifest', 'icon.svg'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS).catch(() => {})).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  // map tiles and everything that changes with the app: network first, cache is the offline fallback
  const live = url.hostname.endsWith('basemaps.cartocdn.com')
    || e.request.mode === 'navigate'
    || /\.(html|js|json|webmanifest)$/.test(url.pathname);
  if (live) {
    e.respondWith(fetch(e.request).then(r => {
      const copy = r.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy));
      return r;
    }).catch(() => caches.match(e.request)));
    return;
  }
  // immutable assets only: cache first, refresh in the background
  e.respondWith(caches.match(e.request).then(hit => {
    const net = fetch(e.request).then(r => {
      const copy = r.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy));
      return r;
    }).catch(() => hit);
    return hit || net;
  }));
});
