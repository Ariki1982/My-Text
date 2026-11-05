const V = 'adhkar-v2';
const SHELL = ['./', 'index.html', 'manifest.json', 'icon-192.png', 'icon-512.png', 'icon-180.png'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(V)
      .then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(k => Promise.all(k.filter(x => x !== V).map(x => caches.delete(x))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);
  if (u.hostname === 'api.github.com') return;
  const isFont = /(^|\.)fonts\.(googleapis|gstatic)\.com$/.test(u.hostname);
  const isRaw = u.hostname === 'raw.githubusercontent.com';
  if (!(u.origin === location.origin || isFont || isRaw)) return;

  // text and json files: network first (fresh), cache as fallback
  if (/\.(txt|json)$/i.test(u.pathname) && u.pathname !== '/manifest.json') {
    const key = u.origin + u.pathname;
    e.respondWith(
      fetch(r).then(res => {
        if (res && res.ok) { const cp = res.clone(); caches.open(V).then(c => c.put(key, cp)); }
        return res;
      }).catch(() => caches.match(key))
    );
    return;
  }

  // page navigation: network first, fall back to the cached page
  if (r.mode === 'navigate') {
    e.respondWith(
      fetch(r).then(res => {
        const cp = res.clone(); caches.open(V).then(c => c.put('index.html', cp));
        return res;
      }).catch(() => caches.match('index.html').then(m => m || caches.match('./')))
    );
    return;
  }

  // everything else (fonts, icons): cache first, refresh in background
  e.respondWith(
    caches.match(r).then(m => {
      const f = fetch(r).then(res => {
        if (res && (res.ok || res.type === 'opaque')) { const cp = res.clone(); caches.open(V).then(c => c.put(r, cp)); }
        return res;
      }).catch(() => m);
      return m || f;
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || './', self.registration.scope).href;
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if ('focus' in c) {
          if (c.navigate) c.navigate(url).catch(() => {});
          return c.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
