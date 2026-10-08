/* ============================================================
 *  Service Worker — AMC Log Book การผลิต GI
 *  - index.html: network-first (ได้เวอร์ชันใหม่เสมอเมื่อมีเน็ต ออฟไลน์ค่อยใช้แคช)
 *  - manifest/icons: cache-first
 *  - ห้ามแตะคำขอไป Apps Script / Drive / CDN (ต่างโดเมน -> ปล่อยผ่าน ไม่แคช) และไม่แตะ POST
 *
 *  เปลี่ยน CACHE_VERSION ทุกครั้งที่แก้ไฟล์ในโฟลเดอร์นี้ เพื่อล้างแคชเก่าในมือถือ
 * ============================================================ */
const CACHE_VERSION = 'amc-logbook-v6';
const SHELL = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_VERSION)
      .then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => null))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;                      // POST ไป Apps Script -> ปล่อยผ่าน
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;       // CDN / Google / Drive -> ไม่แตะ
  if (url.pathname.indexOf('/macros/') >= 0 || url.pathname.indexOf('/photo/') >= 0 || url.pathname.indexOf('/api') >= 0) return;

  const isPage = req.mode === 'navigate' || /\/(index\.html)?$/.test(url.pathname);
  if (isPage) {
    e.respondWith(
      fetch(req).then(res => {
        if (res && res.ok) caches.open(CACHE_VERSION).then(c => c.put(req, res.clone())).catch(err => console.warn('SW cache skipped:', req.url, String(err)));
        return res;
      }).catch(() => caches.match(req).then(hit => hit || caches.match('./index.html')))
    );
    return;
  }
  e.respondWith(
    caches.match(req).then(hit => {
      const net = fetch(req).then(res => {
        if (res && res.ok) caches.open(CACHE_VERSION).then(c => c.put(req, res.clone())).catch(err => console.warn('SW cache skipped:', req.url, String(err)));
        return res;
      }).catch(() => hit);
      return hit || net;
    })
  );
});

self.addEventListener('unhandledrejection', e => { console.warn('SW unhandled rejection:', e.reason && (e.reason.message || JSON.stringify(e.reason))); });

self.addEventListener('message', e => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});
