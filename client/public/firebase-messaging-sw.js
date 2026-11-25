// FILE: firebase-messaging-sw.js
// PATH: client/public/firebase-messaging-sw.js (রিপোতে client/public ফোল্ডারের ভেতরে)
// কাজ: সাইট বন্ধ থাকলেও পুশ নোটিফিকেশন (অর্ডার কনফার্ম, সাপোর্টের উত্তর) দেখায় ও চাপলে সঠিক পেজ খোলে।
// Firebase কনফিগ এই ফাইলে লেখা থাকে না; src/utils/notifications.js রেজিস্টারের সময় লিংকের ?apiKey=…&projectId=… দিয়ে পাঠায়।
// কনফিগ না পেলে চুপচাপ কিছু করে না।

/* global importScripts, firebase */
const q = new URL(self.location.href).searchParams;
const cfg = {
  apiKey: q.get('apiKey'),
  projectId: q.get('projectId'),
  messagingSenderId: q.get('messagingSenderId'),
  appId: q.get('appId'),
};

if (cfg.apiKey && cfg.projectId && cfg.messagingSenderId && cfg.appId) {
  try {
    importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
    importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');
    firebase.initializeApp(cfg);
    const messaging = firebase.messaging();
    // সার্ভার শুধু data পাঠায় (title, body, url); আমরা নিজে দেখাই, তাই দুবার দেখায় না
    messaging.onBackgroundMessage((payload) => {
      const d = (payload && payload.data) || {};
      self.registration.showNotification(d.title || 'MangaBooka', {
        body: d.body || '',
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        data: { url: d.url || '/' },
        tag: d.tag || undefined,
      });
    });
  } catch (e) {
    /* ignore */
  }
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const raw = (event.notification.data && event.notification.data.url) || '/';
  let target = '/';
  try {
    const u = new URL(raw, self.location.origin);
    if (u.origin === self.location.origin) target = u.pathname + u.search;
  } catch (e) {
    /* ignore */
  }
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (c.url.startsWith(self.location.origin) && 'focus' in c) {
          if ('navigate' in c) c.navigate(target);
          return c.focus();
        }
      }
      return self.clients.openWindow(target);
    })
  );
});
