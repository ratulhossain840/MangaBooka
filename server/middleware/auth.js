// FILE: auth.js
// PATH: server/middleware/auth.js (রিপোতে server/middleware ফোল্ডারের ভেতরে)
// কাজ: লগইন যাচাই (ঐচ্ছিক/বাধ্যতামূলক/অ্যাডমিন), দেশ-ভাষা-বাজার চেনা, গতিসীমা, async ত্রুটি সামলানো
// দ্রষ্টব্য: Firebase ID টোকেন যাচাই সার্ভারেই হয়, এতে Firestore রিড লাগে না।

import rateLimit from 'express-rate-limit';
import { auth, isAdminUid } from '../firebaseAdmin.js';
import { LANGS, DEFAULT_LANG_BY_COUNTRY, marketFor } from '../utils/pricing.js';

// async হ্যান্ডলারের ত্রুটি সরাসরি ত্রুটি-হ্যান্ডলারে পাঠায়
export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export const httpError = (status, message) => Object.assign(new Error(message), { status });

// নির্দিষ্ট রুটের জন্য আলাদা গতিসীমা (স্প্যাম আটকাতে)
export const limiter = (limit, minutes = 1) =>
  rateLimit({
    windowMs: minutes * 60 * 1000,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    message: { ok: false, error: 'too_many_requests' },
  });

async function readUser(req) {
  const h = req.headers.authorization || '';
  if (!h.startsWith('Bearer ')) return null;
  try {
    const d = await auth.verifyIdToken(h.slice(7).trim());
    return { uid: d.uid, email: d.email || null, emailVerified: !!d.email_verified };
  } catch {
    return null;
  }
}

// লগইন থাকলে req.user, না থাকলে null (গেস্টও চলবে)
export async function optionalAuth(req, res, next) {
  req.user = await readUser(req);
  next();
}

export async function requireAuth(req, res, next) {
  const u = await readUser(req);
  if (!u) return res.status(401).json({ ok: false, error: 'login_required' });
  req.user = u;
  next();
}

// শুধু অ্যাডমিন (ADMIN_UIDS তালিকার UID)
export async function requireAdmin(req, res, next) {
  const u = await readUser(req);
  if (!u) return res.status(401).json({ ok: false, error: 'login_required' });
  if (!isAdminUid(u.uid)) return res.status(403).json({ ok: false, error: 'forbidden' });
  req.user = u;
  req.isAdmin = true;
  next();
}

// দেশ, ভাষা ও বাজার ঠিক করে req.ctx-এ রাখে
// দেশ: ক্রেতার বাছা (?country=BD) আগে, না থাকলে সার্ভারের ধরা দেশ (Cloudflare হেডার)
// ভাষা: ?lang=bn, না থাকলে দেশের ডিফল্ট ভাষা, তাও না থাকলে English
const COUNTRY_RE = /^[A-Za-z]{2}$/;

export function withContext(req, res, next) {
  const q = req.query || {};
  const hdr = String(
    req.headers['cf-ipcountry'] || req.headers['x-vercel-ip-country'] || req.headers['x-country-code'] || ''
  ).toUpperCase();
  const detectedCountry = COUNTRY_RE.test(hdr) && hdr !== 'XX' && hdr !== 'T1' ? hdr : null;
  const chosen = typeof q.country === 'string' && COUNTRY_RE.test(q.country) ? q.country.toUpperCase() : null;
  const country = chosen || detectedCountry;

  let lang = typeof q.lang === 'string' ? q.lang.toLowerCase().slice(0, 2) : '';
  if (!LANGS.includes(lang)) lang = DEFAULT_LANG_BY_COUNTRY[country] || 'en';

  req.ctx = { country, detectedCountry, lang, market: marketFor(country, lang) };
  next();
}
