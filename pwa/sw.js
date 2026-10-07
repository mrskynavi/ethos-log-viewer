// Service Worker: hält die App offline verfügbar. VERSION setzt scripts/build-pwa.js bei jedem Build neu,
// damit Geräte nach einer Änderung die neuen Dateien holen und den alten Cache löschen.
const VERSION = '__VERSION__';
const CACHE = 'ethoslv-' + VERSION;
const SHELL = __SHELL__;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('ethoslv-') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Seite selbst: aus dem Cache, damit sie auch ohne Netz startet
  if (req.mode === 'navigate') {
    e.respondWith(caches.match('./index.html', { ignoreSearch: true }).then(r => r || fetch(req)));
    return;
  }
  // Eigene Dateien (App, Icons, Beispiel-Log) und Google Fonts: Cache zuerst, sonst laden und merken
  if (url.origin === location.origin || url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open(CACHE).then(c => c.match(req, { ignoreSearch: url.origin === location.origin }).then(hit => hit || fetch(req).then(res => {
      if (res.ok || res.type === 'opaque') c.put(req, res.clone());
      return res;
    }))));
  }
});
