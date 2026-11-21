// FILE: cache.js
// PATH: server/utils/cache.js (রিপোতে server/utils ফোল্ডারের ভেতরে)
// কাজ: সার্ভারের মেমোরি ক্যাশ + ক্যাটালগ ও সেটিংস লোড। Firebase রিড বাঁচানোর মূল জায়গা।
// নিয়ম: প্রোডাক্ট তালিকা ৩০ মিনিট বা অ্যাডমিন বদলালে (invalidateCatalog) পর্যন্ত মেমোরিতে থাকে,
// তাই হাজার ভিজিটরেও Firestore রিড হয় না।

import { db } from '../firebaseAdmin.js';
import { RULES } from './pricing.js';

// ---------- সাধারণ ক্যাশ ----------
const store = new Map(); // key -> { v, exp }
const inflight = new Map(); // একই সময়ে একই কাজ দুবার না করার জন্য

export function cacheGet(key) {
  const hit = store.get(key);
  if (!hit) return undefined;
  if (hit.exp < Date.now()) {
    store.delete(key);
    return undefined;
  }
  return hit.v;
}
export function cacheSet(key, value, ttlMs) {
  store.set(key, { v: value, exp: Date.now() + ttlMs });
}
export function cacheDel(key) {
  store.delete(key);
}

export async function remember(key, ttlMs, loader) {
  const hit = cacheGet(key);
  if (hit !== undefined) return hit;
  if (inflight.has(key)) return inflight.get(key);
  const p = (async () => {
    try {
      const v = await loader();
      cacheSet(key, v, ttlMs);
      return v;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, p);
  return p;
}

// ---------- ক্যাটালগ (প্রকাশিত প্রোডাক্ট) ----------
const CATALOG_TTL = 30 * 60 * 1000;

export async function getCatalog() {
  return remember('catalog', CATALOG_TTL, async () => {
    const snap = await db.collection('products').where('status', '==', 'published').get();
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const byId = new Map();
    const bySlug = new Map();
    for (const p of list) {
      byId.set(p.id, p);
      if (p.slug) bySlug.set(String(p.slug).toLowerCase(), p);
    }
    return { list, byId, bySlug, loadedAt: Date.now() };
  });
}

// অ্যাডমিন প্রোডাক্ট বদলালে এটা ডাকলে পরের রিকোয়েস্টে নতুন তালিকা আসবে
export function invalidateCatalog() {
  cacheDel('catalog');
}

// লাইক/ডিসলাইকের মতো ছোট বদলে পুরো তালিকা না আনে, শুধু মেমোরির কপি ঠিক করে
export function patchProductStats(id, patch) {
  const c = cacheGet('catalog');
  const p = c && c.byId.get(id);
  if (p) p.stats = { ...(p.stats || {}), ...patch };
}

// ---------- পাবলিক সেটিংস (settings/public) ----------
const SETTINGS_TTL = 5 * 60 * 1000;

export const DEFAULT_SETTINGS = {
  categories: [], // [{ key, type, name: { bn, en, ... } }]
  banners: [], // [{ id, image, link, title:{}, subtitle:{}, cta:{}, order, active }]
  announcement: null, // { active, text:{}, link }
  salesTierMin: 5, // কত আসল বিক্রি থেকে "X+ জন কিনেছে" দেখাবে
  bestsellerMin: 50, // কত আসল বিক্রিতে "বেস্টসেলার" ব্যাজ বসবে
  ...RULES,
};

export async function getSettings() {
  return remember('settings', SETTINGS_TTL, async () => {
    const s = await db.doc('settings/public').get();
    return { ...DEFAULT_SETTINGS, ...(s.exists ? s.data() : {}) };
  });
}
export function invalidateSettings() {
  cacheDel('settings');
                  }
