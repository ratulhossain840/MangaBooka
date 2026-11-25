// FILE: sw.js
// PATH: client/public/sw.js (রিপোতে client/public ফোল্ডারের ভেতরে)
// কাজ: সাইটকে দ্রুত ও অফলাইন-বান্ধব করে। হ্যাশ করা /assets ফাইল ও আইকন ক্যাশ হয়; পেজ সবসময় নেটওয়ার্ক থেকে, নেট না থাকলে offline.html।
// কিছুই ক্যাশ/আটকানো হয় না: /api, /admin, অন্য সাইটের ফাইল (imgbb ছবি, Firebase), এবং পেমেন্ট/লগইনের কোনো তথ্য।
// নতুন ভার্সনে VERSION বদলালে পুরনো ক্যাশ নিজে মুছে যায়।

const VERSION = 'mb-v1';
const STATIC = VERSION + '-static';
const OFFLINE_URL = '/offline.html';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC)
      .then((c) => c.addAll([OFFLINE_URL]))
      .catch(() => {})
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('mb-') && !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const p = url.pathname;
  if (p.startsWith('/api/') || p === '/admin' || p.startsWith('/admin/') || p === '/sw.js' || p === '/firebase-messaging-sw.js') return;

  // পেজ খোলা: নেটওয়ার্ক আগে; ব্যর্থ হলে অফলাইন পেজ (/admin এ ঢোকে না, উপরে বাদ)
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => caches.match(OFFLINE_URL).then((r) => r || new Response('অফলাইন', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })))
    );
    return;
  }

  // নাম-হ্যাশ করা বিল্ড ফাইল (বদলায় না): ক্যাশ আগে
  if (p.startsWith('/assets/')) {
    event.respondWith(
      caches.open(STATIC).then((cache) =>
        cache.match(req).then(
          (hit) =>
            hit ||
            fetch(req).then((res) => {
              if (res.ok) cache.put(req, res.clone());
              return res;
            })
        )
      )
    );
    return;
  }

  // আইকন, ম্যানিফেস্ট: ক্যাশ দেখায়, পেছনে নতুনটা আনে
  if (p.startsWith('/icons/') || p === '/manifest.json') {
    event.respondWith(
      caches.open(STATIC).then((cache) =>
        cache.match(req).then((hit) => {
          const net = fetch(req)
            .then((res) => {
              if (res.ok) cache.put(req, res.clone());
              return res;
            })
            .catch(() => hit);
          return hit || net;
        })
      )
    );
  }
});
