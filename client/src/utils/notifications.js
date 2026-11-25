// FILE: notifications.js
// PATH: client/src/utils/notifications.js (রিপোতে client/src/utils ফোল্ডারের ভেতরে)
// কাজ: পুশ নোটিফিকেশন চালু/বন্ধ (অর্ডার কনফার্ম, সাপোর্টের উত্তর)। শুধু লগইন করা ইউজারের জন্য।
// দরকার (Render Environment, "VITE_" দিয়ে শুরু; পরিবর্তনের পর ফ্রন্টএন্ড আবার বিল্ড/ডিপ্লয় হয়):
//   VITE_FIREBASE_MESSAGING_SENDER_ID  (Firebase Console → Project settings → Cloud Messaging/General → Sender ID)
//   VITE_FIREBASE_VAPID_KEY            (Firebase Console → Project settings → Cloud Messaging → Web Push certificates → Key pair)
// না থাকলে pushStatus() 'unconfigured' দেয় এবং সাইটের কিছুই ভাঙে না।
//
// ব্যবহার: await pushStatus() → 'unsupported' | 'unconfigured' | 'denied' | 'off' | 'on'
//         await enablePush() / await disablePush()  (ত্রুটিতে Error ছোঁড়ে, বার্তা বাংলায়)

import { getApps } from 'firebase/app';
import { api } from '../api.js';

const env = import.meta.env;
const SENDER = env.VITE_FIREBASE_MESSAGING_SENDER_ID;
const VAPID = env.VITE_FIREBASE_VAPID_KEY;
const LS = 'mb_push_token';

const lsGet = () => {
  try {
    return localStorage.getItem(LS);
  } catch {
    return null;
  }
};
const lsSet = (v) => {
  try {
    if (v) localStorage.setItem(LS, v);
    else localStorage.removeItem(LS);
  } catch {
    /* ignore */
  }
};

export function pushSupported() {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}
const configured = () => !!(SENDER && VAPID && env.VITE_FIREBASE_API_KEY && env.VITE_FIREBASE_PROJECT_ID && env.VITE_FIREBASE_APP_ID);

export async function pushStatus() {
  if (!pushSupported()) return 'unsupported';
  if (!configured()) return 'unconfigured';
  if (Notification.permission === 'denied') return 'denied';
  return Notification.permission === 'granted' && lsGet() ? 'on' : 'off';
}

async function register() {
  const q = new URLSearchParams({
    apiKey: env.VITE_FIREBASE_API_KEY,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    messagingSenderId: SENDER,
    appId: env.VITE_FIREBASE_APP_ID,
  });
  return navigator.serviceWorker.register('/firebase-messaging-sw.js?' + q.toString(), { scope: '/firebase-cloud-messaging-push-scope' });
}

export async function enablePush() {
  const st = await pushStatus();
  if (st === 'unsupported') throw new Error('এই ব্রাউজারে নোটিফিকেশন চলে না');
  if (st === 'unconfigured') throw new Error('নোটিফিকেশন এখনো চালু করা হয়নি');
  if (st === 'denied') throw new Error('ব্রাউজারের সেটিংসে নোটিফিকেশন বন্ধ করা আছে, সেখান থেকে চালু করুন');
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('অনুমতি দেওয়া হয়নি');
  const app = getApps()[0];
  if (!app) throw new Error('লগইন সেবা চালু নেই');
  const [{ getMessaging, getToken }, reg] = await Promise.all([import('firebase/messaging'), register()]);
  const token = await getToken(getMessaging(app), { vapidKey: VAPID, serviceWorkerRegistration: reg });
  if (!token) throw new Error('নোটিফিকেশন চালু করা যায়নি, আবার চেষ্টা করুন');
  await api.post('/api/notify/token', { token }, { auth: 'required' });
  lsSet(token);
  return true;
}

export async function disablePush() {
  const token = lsGet();
  lsSet(null);
  if (!token) return true;
  try {
    await api.del('/api/notify/token', { body: { token }, auth: 'required' });
  } catch {
    /* ignore */
  }
  return true;
}
