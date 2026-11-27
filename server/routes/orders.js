// FILE: orders.js
// PATH: server/routes/orders.js
// অর্ডার তৈরি, স্ক্রিনশট আপলোড, ট্র্যাকিং, নিজের অর্ডার তালিকা, গেস্ট অর্ডার নিজের অ্যাকাউন্টে নেওয়া

import { Router } from 'express';
import crypto from 'crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from '../firebaseAdmin.js';
import { optionalAuth, requireAuth, withContext, limiter, asyncHandler, httpError } from '../middleware/auth.js';
import { getCatalog, getSettings } from '../utils/cache.js';
import { computePrice, rulesOf, localize } from '../utils/pricing.js';

const router = Router();
router.use(withContext);

const sha = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
const safeEq = (a, b) => {
  const x = Buffer.from(String(a || '')), y = Buffer.from(String(b || ''));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const makeCode = () => {
  let s = '';
  for (const x of crypto.randomBytes(6)) s += ALPHA[x % ALPHA.length];
  return 'MB-' + s;
};
const ms = (t) => (t && typeof t.toMillis === 'function' ? t.toMillis() : null);
const METHODS = { BD: ['bkash', 'nagad'], INT: ['usdt_bep20', 'usdt_erc20'] };
const cleanKey = (v, n = 40) => String(v || '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, n);

const view = (id, o) => ({
  id,
  orderCode: o.orderCode,
  status: o.status,
  rejectReason: o.rejectReason || null,
  currency: o.currency,
  total: o.total,
  method: o.method,
  trxId: o.trxId,
  items: (o.items || []).map((i) => ({ productId: i.productId, type: i.type, slug: i.slug, title: i.title, coverUrl: i.coverUrl, price: i.price })),
  createdAt: ms(o.createdAt),
  confirmedAt: ms(o.confirmedAt),
});

async function grantLibrary(uid, order, orderId) {
  const b = db.batch();
  for (const i of order.items || []) {
    b.set(db.doc(`users/${uid}/library/${i.productId}`), { productId: i.productId, orderId, grantedAt: FieldValue.serverTimestamp() }, { merge: true });
  }
  await b.commit();
}

async function findByCode(code, secret) {
  const q = await db.collection('orders').where('orderCode', '==', String(code || '').trim().toUpperCase()).limit(1).get();
  if (q.empty) return null;
  const doc = q.docs[0];
  if (!safeEq(doc.data().secretHash, sha(secret))) return null;
  return doc;
}

// ---------- পেমেন্ট তথ্য (শুধু চেকআউটে; নম্বর/ঠিকানা Render Environment থেকে, ডাটাবেসে নয়) ----------
// env: PAY_BKASH, PAY_NAGAD, PAY_NOTE_BD, USDT_BEP20_ADDRESS, USDT_ERC20_ADDRESS, PAY_NOTE_INT
const env = (k) => (process.env[k] || '').trim() || null;
router.get('/payment-info', limiter(60, 10), asyncHandler(async (req, res) => {
  const market = req.ctx?.market === 'BD' ? 'BD' : 'INT';
  res.set('Cache-Control', 'no-store');
  if (market === 'BD') {
    return res.json({ market, methods: { bkash: env('PAY_BKASH'), nagad: env('PAY_NAGAD') }, note: env('PAY_NOTE_BD') || '' });
  }
  res.json({
    market,
    methods: { usdt_bep20: env('USDT_BEP20_ADDRESS'), usdt_erc20: env('USDT_ERC20_ADDRESS') },
    note: env('PAY_NOTE_INT') || '',
  });
}));

// ---------- অর্ডার তৈরি ----------
// body: { items:[{productId}], method, trxId, screenshotUrl?, email?, utm?:{source,medium,campaign} }
router.post('/', limiter(10, 10), optionalAuth, asyncHandler(async (req, res) => {
  const market = req.ctx?.market === 'BD' ? 'BD' : 'INT';
  const currency = market === 'BD' ? 'BDT' : 'USD';
  const b = req.body || {};
  const uid = req.user?.uid || null;

  const ids = [...new Set((Array.isArray(b.items) ? b.items : []).map((i) => String(i?.productId || '')).filter((x) => /^[A-Za-z0-9_-]{1,64}$/.test(x)))];
  if (!ids.length || ids.length > 20) throw httpError(400, 'কার্টে ১ থেকে ২০টি প্রোডাক্ট থাকতে হবে');

  const method = String(b.method || '');
  if (!METHODS[market].includes(method)) throw httpError(400, 'পেমেন্ট পদ্ধতি ঠিক নয়');
  const ENV_OF = { bkash: 'PAY_BKASH', nagad: 'PAY_NAGAD', usdt_bep20: 'USDT_BEP20_ADDRESS', usdt_erc20: 'USDT_ERC20_ADDRESS' };
  if (!env(ENV_OF[method])) throw httpError(400, 'এই পেমেন্ট পদ্ধতি এখন চালু নেই');

  const trxId = String(b.trxId || '').trim();
  if (trxId.length < 6 || trxId.length > 120 || /\s/.test(trxId)) throw httpError(400, 'TrxID/TXID ঠিকভাবে দিন (ফাঁকা ছাড়া)');
  // USDT (BEP20/ERC20) লেনদেনের হ্যাশ: 0x + ৬৪টি হেক্স অক্ষর
  if (market !== 'BD' && !/^0x[a-fA-F0-9]{64}$/.test(trxId)) throw httpError(400, 'TXID ঠিক নয় (0x দিয়ে শুরু, মোট ৬৬ অক্ষর হতে হবে)');

  let screenshotUrl = null;
  if (b.screenshotUrl) {
    screenshotUrl = String(b.screenshotUrl).trim();
    if (!/^https?:\/\//i.test(screenshotUrl) || screenshotUrl.length > 500) throw httpError(400, 'স্ক্রিনশটের লিংক ঠিক নয়');
  }
  let email = null;
  if (b.email) {
    email = String(b.email).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 120) throw httpError(400, 'ইমেইল ঠিক নয়');
  }
  const u = b.utm || {};
  const utm = { source: cleanKey(u.source), medium: cleanKey(u.medium), campaign: cleanKey(u.campaign) };
  const utmKey = utm.source || utm.campaign ? `${utm.source || 'none'}__${utm.campaign || 'none'}` : null;

  // ক্যাটালগ ক্যাশ থেকে (Firestore রিড বাঁচে); দাম/ছাড় সার্ভারে pricing.js দিয়েই হিসাব হয়
  const [catalog, st] = await Promise.all([getCatalog(), getSettings()]);
  const rules = rulesOf(st);

  if (uid) {
    const owned = await db.getAll(...ids.map((id) => db.doc(`users/${uid}/library/${id}`)));
    if (owned.some((s) => s.exists)) throw httpError(409, 'এই প্রোডাক্ট আপনার লাইব্রেরিতে আগেই আছে');
  }

  const lang = req.ctx?.lang || 'en';
  const now = Date.now();
  let total = 0;
  const items = ids.map((id) => {
    const p = catalog.byId.get(id);
    if (!p) throw httpError(404, 'একটি প্রোডাক্ট পাওয়া যায়নি');
    const fp = computePrice(p, market, now, rules);
    if (!fp) throw httpError(400, 'এই প্রোডাক্ট আপনার বাজারে বিক্রি হচ্ছে না');
    total += fp.final;
    return {
      productId: id,
      type: p.type,
      slug: p.slug,
      title: localize(p, lang).title,
      coverUrl: p.coverUrl || '',
      price: fp.final,
      basePrice: fp.base,
    };
  });
  total = market === 'BD' ? Math.round(total) : Math.round(total * 100) / 100;

  const secret = crypto.randomBytes(18).toString('hex');
  const trxKey = sha(trxId.toLowerCase());
  const orderRef = db.collection('orders').doc();
  const code = makeCode();

  await db.runTransaction(async (tx) => {
    const usedRef = db.doc('usedTx/' + trxKey);
    if ((await tx.get(usedRef)).exists) throw httpError(409, 'এই TrxID/TXID আগেই ব্যবহার হয়েছে');
    tx.set(usedRef, { orderId: orderRef.id, createdAt: FieldValue.serverTimestamp() });
    tx.set(orderRef, {
      orderCode: code,
      userId: uid,
      secretHash: sha(secret),
      items,
      market,
      currency,
      total,
      method,
      trxId,
      trxKey,
      screenshotUrl,
      contactEmail: email,
      country: req.ctx?.country || null,
      utm,
      utmKey,
      status: 'pending',
      rejectReason: null,
      createdAt: FieldValue.serverTimestamp(),
    });
  });

  // secret শুধু এই একবারই পাওয়া যায়; গেস্ট ক্রেতা এটা দিয়ে অর্ডার দেখবে ও কনটেন্ট পড়বে
  res.status(201).json({ id: orderRef.id, orderCode: code, secret, currency, total });
}));

// ---------- পেমেন্ট স্ক্রিনশট আপলোড (ক্রেতার জন্য; imgbb কী সার্ভারেই থাকে, ব্রাউজারে যায় না) ----------
// body: { image: "<base64, data: প্রিফিক্স ছাড়া>" } -> { url }। ক্লায়েন্ট ছবি ছোট করে পাঠায় (প্রায় ১ MB এর নিচে)।
router.post('/screenshot', limiter(8, 10), asyncHandler(async (req, res) => {
  const key = String(process.env.IMGBB_KEY || '').trim().replace(/^["']+|["']+$/g, '');
  if (!key) throw httpError(503, 'এখন ছবি আপলোড বন্ধ আছে');
  const image = String((req.body && req.body.image) || '').replace(/^data:image\/[a-z+.-]+;base64,/i, '');
  if (!image || image.length > 2_000_000 || !/^[A-Za-z0-9+/=]+$/.test(image)) throw httpError(400, 'ছবিটি ঠিক নয় বা বড় বেশি');
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 20000);
  let json;
  try {
    const r = await fetch('https://api.imgbb.com/1/upload?key=' + encodeURIComponent(key), {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ image }).toString(),
      signal: ctl.signal,
    });
    json = await r.json().catch(() => null);
    if (!r.ok || !json || !json.success) throw new Error('imgbb ' + r.status);
  } catch (e) {
    console.warn('[orders] screenshot upload failed:', e && e.message);
    throw httpError(502, 'ছবি আপলোড হয়নি, আবার চেষ্টা করুন');
  } finally {
    clearTimeout(timer);
  }
  const url = json.data && (json.data.url || json.data.display_url);
  if (!url) throw httpError(502, 'ছবি আপলোড হয়নি, আবার চেষ্টা করুন');
  res.json({ url });
}));

// ---------- নিজের অর্ডার ----------
router.get('/mine', requireAuth, asyncHandler(async (req, res) => {
  const q = await db.collection('orders').where('userId', '==', req.user.uid).limit(100).get();
  const list = q.docs.map((d) => view(d.id, d.data())).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  res.set('Cache-Control', 'no-store');
  res.json({ items: list });
}));

// ---------- গেস্ট অর্ডার ট্র্যাক ----------
router.post('/track', limiter(20, 10), asyncHandler(async (req, res) => {
  const doc = await findByCode(req.body?.orderCode, req.body?.secret);
  if (!doc) throw httpError(404, 'অর্ডার পাওয়া যায়নি, কোড ও সিক্রেট মিলিয়ে দেখুন');
  res.set('Cache-Control', 'no-store');
  res.json(view(doc.id, doc.data()));
}));

// ---------- গেস্ট অর্ডার লগইন করা অ্যাকাউন্টে নেওয়া ----------
router.post('/claim', limiter(10, 10), requireAuth, asyncHandler(async (req, res) => {
  const doc = await findByCode(req.body?.orderCode, req.body?.secret);
  if (!doc) throw httpError(404, 'অর্ডার পাওয়া যায়নি');
  const o = doc.data();
  if (o.userId && o.userId !== req.user.uid) throw httpError(403, 'এই অর্ডার অন্য অ্যাকাউন্টের');
  if (!o.userId) await doc.ref.update({ userId: req.user.uid });
  if (o.status === 'confirmed') await grantLibrary(req.user.uid, o, doc.id);
  res.json(view(doc.id, { ...o, userId: req.user.uid }));
}));

export default router;
