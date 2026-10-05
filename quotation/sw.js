/* ============================================================
 *  Service Worker — AMC ใบเสนอราคา GI
 *  - index.html: network-first (ได้เวอร์ชันใหม่เสมอเมื่อมีเน็ต ออฟไลน์ค่อยใช้แคช)
 *  - manifest/icons: cache-first
 *  - ห้ามแตะคำขอไป Apps Script / CDN (ต่างโดเมน -> ปล่อยผ่าน ไม่แคช)
 *
 *  เปลี่ยน CACHE_VERSION ทุกครั้งที่แก้ไฟล์ในโฟลเดอร์นี้ เพื่อล้างแคชเก่าในมือถือ
 * ============================================================ */
const CACHE_VERSION = 'amc-quote-v3';
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
  if (url.origin !== self.location.origin) return;       // CDN / Google -> ไม่แตะ
  if (url.pathname.indexOf('/macros/') >= 0) return;

  const isPage = req.mode === 'navigate' || /\/(index\.html)?$/.test(url.pathname);
  if (isPage) {
    // network-first
    e.respondWith(
      fetch(req).then(res => {
        if (res && res.ok) caches.open(CACHE_VERSION).then(c => c.put(req, res.clone()));
        return res;
      }).catch(() => caches.match(req).then(hit => hit || caches.match('./index.html')))
    );
    return;
  }
  // cache-first สำหรับไฟล์นิ่ง ๆ แล้วอัปเดตเบื้องหลัง
  e.respondWith(
    caches.match(req).then(hit => {
      const net = fetch(req).then(res => {
        if (res && res.ok) caches.open(CACHE_VERSION).then(c => c.put(req, res.clone()));
        return res;
      }).catch(() => hit);
      return hit || net;
    })
  );
});

self.addEventListener('message', e => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});
