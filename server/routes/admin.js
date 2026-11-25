// FILE: admin.js
// PATH: server/routes/admin.js
// অ্যাডমিন API (সবগুলো requireAdmin-এর পেছনে): ড্যাশবোর্ড, অর্ডার, প্রোডাক্ট, চ্যাপ্টার, সেটিংস, সাপোর্ট

import { Router } from 'express';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from '../firebaseAdmin.js';
import * as Cache from '../utils/cache.js';
import { checkDiscount, rulesOf } from '../utils/pricing.js';
import { checkEnv } from '../scripts/checkEnv.js';
import { seedDemo, removeDemo, bootSeed } from '../scripts/seed.js';
import { requireAdmin, limiter, asyncHandler, httpError } from '../middleware/auth.js';
import { pushToUser } from './notify.js';

const router = Router();

// সার্ভার চালুর সময়: Render Logs-এ পরিবেশ ভ্যারিয়েবলের রিপোর্ট, আর SEED_DEMO থাকলে ডেমো বসানো/মোছা
checkEnv({ log: true });
if (process.env.SEED_DEMO) bootSeed().catch((e) => console.error('[seed] ব্যর্থ', e));
router.use(limiter(300, 1));
router.use(requireAdmin);
router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

const LANGS = ['bn', 'en', 'ja', 'zh', 'ms', 'es'];
const ID = /^[A-Za-z0-9_-]{1,64}$/;
const ms = (t) => (t && typeof t.toMillis === 'function' ? t.toMillis() : null);
const S = (v, n) => String(v ?? '').trim().slice(0, n);
const A = (v, max, n) => (Array.isArray(v) ? v.slice(0, max).map((x) => S(x, n)).filter(Boolean) : []);
const isUrl = (u) => typeof u === 'string' && /^https?:\/\//i.test(u) && u.length <= 500;
const dayKey = (d = new Date()) => d.toISOString().slice(0, 10);

// cache.js এর সব invalidate* ফাংশন ডাকে (ক্যাটালগ ও সেটিংস ক্যাশ নতুন হয়)
function invalidateAll() {
  for (const [k, f] of Object.entries(Cache)) {
    if (/^invalidate/i.test(k) && typeof f === 'function') {
      try { f(); } catch { /* ignore */ }
    }
  }
}

router.get('/me', (req, res) => res.json({ ok: true, uid: req.user?.uid || null }));

// imgbb কী ব্রাউজারে রাখা হয় না, অ্যাডমিন লগইনের পর এখান থেকে পায়
router.get('/imgbb-key', (req, res) => res.json({ key: process.env.IMGBB_KEY || null }));

// ================= ড্যাশবোর্ড =================
router.get('/dashboard', asyncHandler(async (req, res) => {
  const days = [];
  for (let i = 6; i >= 0; i--) days.push(dayKey(new Date(Date.now() - i * 86400000)));
  const [pending, openT, prods, daily] = await Promise.all([
    db.collection('orders').where('status', '==', 'pending').count().get(),
    db.collection('supportTickets').where('status', '==', 'open').count().get(),
    db.collection('products').count().get(),
    db.getAll(...days.map((d) => db.doc('stats/daily_' + d))),
  ]);
  res.json({
    pendingOrders: pending.data().count,
    openTickets: openT.data().count,
    products: prods.data().count,
    last7: daily.map((s, i) => ({ day: days[i], visits: s.exists ? s.data().visits || 0 : 0, orders: s.exists ? s.data().orders || 0 : 0 })),
  });
}));

router.get('/analytics', asyncHandler(async (req, res) => {
  const n = Math.min(Math.max(parseInt(req.query.days, 10) || 14, 1), 60);
  const days = [];
  for (let i = n - 1; i >= 0; i--) days.push(dayKey(new Date(Date.now() - i * 86400000)));
  const [daily, camps] = await Promise.all([
    db.getAll(...days.map((d) => db.doc('stats/daily_' + d))),
    db.collection('campaigns').limit(200).get(),
  ]);
  res.json({
    daily: daily.map((s, i) => ({ day: days[i], ...(s.exists ? s.data() : {}) })),
    campaigns: camps.docs.map((d) => ({ key: d.id, ...d.data(), lastVisitAt: ms(d.data().lastVisitAt) })),
  });
}));

// ================= অর্ডার =================
const orderRow = (id, o) => ({
  id,
  orderCode: o.orderCode,
  status: o.status,
  userId: o.userId || null,
  contactEmail: o.contactEmail || null,
  market: o.market,
  currency: o.currency,
  total: o.total,
  method: o.method,
  trxId: o.trxId,
  screenshotUrl: o.screenshotUrl || null,
  country: o.country || null,
  utmKey: o.utmKey || null,
  rejectReason: o.rejectReason || null,
  adminNote: o.adminNote || null,
  items: (o.items || []).map((i) => ({ productId: i.productId, title: i.title, price: i.price, type: i.type })),
  createdAt: ms(o.createdAt),
  confirmedAt: ms(o.confirmedAt),
});

// ?status=pending|confirmed|rejected (না দিলে সব)
router.get('/orders', asyncHandler(async (req, res) => {
  const status = String(req.query.status || '');
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 100, 1), 200);
  let q = db.collection('orders');
  if (['pending', 'confirmed', 'rejected'].includes(status)) q = q.where('status', '==', status);
  const snap = await q.limit(limit).get();
  const items = snap.docs.map((d) => orderRow(d.id, d.data())).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  res.json({ items });
}));

router.get('/orders/:id', asyncHandler(async (req, res) => {
  if (!ID.test(req.params.id)) throw httpError(400, 'ভুল আইডি');
  const s = await db.doc('orders/' + req.params.id).get();
  if (!s.exists) throw httpError(404, 'অর্ডার নেই');
  res.json(orderRow(s.id, s.data()));
}));

// কনফার্ম: { note? } — সামান্য কম পেমেন্ট এলেও অ্যাডমিন ম্যানুয়ালি কনফার্ম করতে পারে
router.post('/orders/:id/confirm', asyncHandler(async (req, res) => {
  if (!ID.test(req.params.id)) throw httpError(400, 'ভুল আইডি');
  const ref = db.doc('orders/' + req.params.id);
  let order = null;
  await db.runTransaction(async (tx) => {
    const s = await tx.get(ref);
    if (!s.exists) throw httpError(404, 'অর্ডার নেই');
    if (s.data().status !== 'pending') throw httpError(409, 'এই অর্ডার আগেই প্রক্রিয়া হয়েছে');
    order = s.data();
    tx.update(ref, {
      status: 'confirmed',
      confirmedAt: FieldValue.serverTimestamp(),
      confirmedBy: req.user?.uid || null,
      adminNote: S(req.body?.note, 300) || null,
      rejectReason: null,
    });
  });

  const inc = FieldValue.increment(1);
  const batch = db.batch();
  for (const it of order.items || []) {
    batch.set(db.doc('products/' + it.productId), { stats: { sold: inc } }, { merge: true });
    if (order.userId) {
      batch.set(db.doc(`users/${order.userId}/library/${it.productId}`), { productId: it.productId, orderId: ref.id, grantedAt: FieldValue.serverTimestamp() }, { merge: true });
    }
  }
  batch.set(db.doc('stats/daily_' + dayKey()), { orders: inc, revenue: { [order.currency]: FieldValue.increment(order.total) } }, { merge: true });
  if (order.utmKey) {
    batch.set(db.doc('campaigns/' + order.utmKey), { orders: inc, revenue: { [order.currency]: FieldValue.increment(order.total) } }, { merge: true });
  }
  await batch.commit();
  invalidateAll();
  if (order.userId) pushToUser(order.userId, { title: 'MangaBooka', body: `অর্ডার ${order.orderCode} কনফার্ম হয়েছে ✔ Order confirmed`, url: '/library', tag: 'order-' + ref.id });
  res.json({ ok: true });
}));

// রিজেক্ট: { reason (বাধ্যতামূলক), releaseTx? } — releaseTx:true হলে ওই TrxID আবার ব্যবহার করা যাবে
router.post('/orders/:id/reject', asyncHandler(async (req, res) => {
  if (!ID.test(req.params.id)) throw httpError(400, 'ভুল আইডি');
  const reason = S(req.body?.reason, 300);
  if (!reason) throw httpError(400, 'রিজেক্টের কারণ লিখুন (ক্রেতা দেখবে)');
  const ref = db.doc('orders/' + req.params.id);
  let order = null;
  await db.runTransaction(async (tx) => {
    const s = await tx.get(ref);
    if (!s.exists) throw httpError(404, 'অর্ডার নেই');
    if (s.data().status !== 'pending') throw httpError(409, 'এই অর্ডার আগেই প্রক্রিয়া হয়েছে');
    order = s.data();
    tx.update(ref, { status: 'rejected', rejectReason: reason, rejectedAt: FieldValue.serverTimestamp() });
    if (req.body?.releaseTx === true && order.trxKey) tx.delete(db.doc('usedTx/' + order.trxKey));
  });
  if (order.userId) pushToUser(order.userId, { title: 'MangaBooka', body: `অর্ডার ${order.orderCode} বাতিল: ${reason}`, url: '/orders', tag: 'order-' + ref.id });
  res.json({ ok: true });
}));

// ================= প্রোডাক্ট =================
const TYPES = ['manga', 'ebook'];
const STATUSES = ['published', 'draft', 'hidden'];

function cleanI18n(v) {
  if (!v || typeof v !== 'object') throw httpError(400, 'i18n ভুল');
  const out = {};
  for (const l of LANGS) {
    const x = v[l];
    if (!x || typeof x !== 'object') continue;
    out[l] = {
      title: S(x.title, 200),
      headline: S(x.headline, 300),
      caption: S(x.caption, 500),
      description: S(x.description, 10000),
      bullets: A(x.bullets, 20, 300),
      toc: A(x.toc, 200, 200),
    };
  }
  return out;
}

function priceOrNull(v, name) {
  if (v === null || v === '' || v === undefined) return null;
  const n = Number(v);
  if (!(n >= 0) || n > 1e7) throw httpError(400, name + ' ঠিক নয়');
  return n;
}

function cleanDiscount(d) {
  if (d === null || d === undefined) return null;
  if (typeof d !== 'object') throw httpError(400, 'ছাড় ঠিক নয়');
  const o = {};
  if (d.percent != null && d.percent !== '') {
    const p = Number(d.percent);
    if (!(p > 0 && p < 100)) throw httpError(400, 'ছাড়ের শতাংশ ১ থেকে ৯৯ এর মধ্যে দিন');
    o.percent = p;
  }
  if (d.fixedBDT != null && d.fixedBDT !== '') o.fixedBDT = priceOrNull(d.fixedBDT, 'fixedBDT');
  if (d.fixedUSD != null && d.fixedUSD !== '') o.fixedUSD = priceOrNull(d.fixedUSD, 'fixedUSD');
  const date = (v) => {
    if (!v) return null;
    const t = new Date(v).getTime();
    if (Number.isNaN(t)) throw httpError(400, 'ছাড়ের তারিখ ঠিক নয়');
    return new Date(t).toISOString();
  };
  o.start = date(d.start);
  o.end = date(d.end);
  if (o.percent == null && o.fixedBDT == null && o.fixedUSD == null) return null;
  return o;
}

// ছাড়ের নিয়ম যাচাই (utils/pricing.js checkDiscount): ত্রুটি থাকলে সেভ হবে না, সতর্কতা ফেরত যায়
async function discountWarnings(product) {
  if (!product.discount) return [];
  const { errors, warnings } = checkDiscount(product, rulesOf(await Cache.getSettings()));
  if (errors.length) throw httpError(400, errors.join(' '));
  return warnings;
}

async function slugTaken(slug, exceptId) {
  const q = await db.collection('products').where('slug', '==', slug).limit(2).get();
  return q.docs.some((d) => d.id !== exceptId);
}

function cleanProduct(b, isCreate) {
  const o = {};
  if (isCreate) {
    if (!TYPES.includes(b.type)) throw httpError(400, 'type manga বা ebook হতে হবে');
    o.type = b.type;
  }
  if (isCreate || b.slug !== undefined) {
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(String(b.slug || ''))) throw httpError(400, 'slug ইংরেজি ছোট হাতের অক্ষর, সংখ্যা ও ড্যাশ দিয়ে হবে');
    o.slug = b.slug;
  }
  if (b.status !== undefined) {
    if (!STATUSES.includes(b.status)) throw httpError(400, 'status ঠিক নয়');
    o.status = b.status;
  }
  if (b.coverUrl !== undefined) {
    if (b.coverUrl && !isUrl(b.coverUrl)) throw httpError(400, 'কভারের লিংক ঠিক নয়');
    o.coverUrl = b.coverUrl || '';
  }
  if (b.category !== undefined) o.category = S(b.category, 60);
  if (b.featured !== undefined) o.featured = !!b.featured;
  if (b.sortOrder !== undefined) o.sortOrder = Number(b.sortOrder) || 0;
  if (b.priceBDT !== undefined) o.priceBDT = priceOrNull(b.priceBDT, 'priceBDT');
  if (b.priceUSD !== undefined) o.priceUSD = priceOrNull(b.priceUSD, 'priceUSD');
  if (b.discount !== undefined) o.discount = cleanDiscount(b.discount);
  if (b.textLangs !== undefined) o.textLangs = (Array.isArray(b.textLangs) ? b.textLangs : []).filter((l) => LANGS.includes(l));
  if (b.formats !== undefined) o.formats = (Array.isArray(b.formats) ? b.formats : []).filter((f) => ['pdf', 'epub'].includes(f));
  if (isCreate || b.i18n !== undefined) {
    o.i18n = cleanI18n(b.i18n);
    if (isCreate && !o.i18n.bn?.title) throw httpError(400, 'বাংলা নাম (title) লাগবে');
  }
  return o;
}

router.get('/products', asyncHandler(async (req, res) => {
  const snap = await db.collection('products').limit(500).get();
  const items = snap.docs
    .map((d) => {
      const p = d.data();
      return {
        id: d.id, type: p.type, slug: p.slug, status: p.status, coverUrl: p.coverUrl || '', category: p.category || '',
        featured: !!p.featured, sortOrder: p.sortOrder ?? 0, priceBDT: p.priceBDT ?? null, priceUSD: p.priceUSD ?? null,
        discount: p.discount || null, title: p.i18n?.bn?.title || p.i18n?.en?.title || '', stats: p.stats || {},
        chapterCount: p.chapterCount || 0, updatedAt: ms(p.updatedAt),
      };
    })
    .sort((a, b) => (a.sortOrder - b.sortOrder) || a.title.localeCompare(b.title));
  res.json({ items });
}));

router.get('/products/:id', asyncHandler(async (req, res) => {
  if (!ID.test(req.params.id)) throw httpError(400, 'ভুল আইডি');
  const s = await db.doc('products/' + req.params.id).get();
  if (!s.exists) throw httpError(404, 'প্রোডাক্ট নেই');
  const p = s.data();
  res.json({ id: s.id, ...p, createdAt: ms(p.createdAt), updatedAt: ms(p.updatedAt) });
}));

router.post('/products', asyncHandler(async (req, res) => {
  const o = cleanProduct(req.body || {}, true);
  if (await slugTaken(o.slug, null)) throw httpError(409, 'এই slug আগেই আছে');
  const warnings = await discountWarnings(o);
  const ref = db.collection('products').doc();
  await ref.set({
    status: 'draft', coverUrl: '', category: '', featured: false, sortOrder: 100, priceBDT: null, priceUSD: null, discount: null,
    textLangs: [], formats: [], chapterIndex: [], chapterCount: 0, pageCount: 0, wordCount: 0,
    ...o,
    stats: { sold: 0, likes: 0, dislikes: 0 },
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  invalidateAll();
  res.status(201).json({ id: ref.id, warnings });
}));

router.put('/products/:id', asyncHandler(async (req, res) => {
  if (!ID.test(req.params.id)) throw httpError(400, 'ভুল আইডি');
  const ref = db.doc('products/' + req.params.id);
  const s = await ref.get();
  if (!s.exists) throw httpError(404, 'প্রোডাক্ট নেই');
  const o = cleanProduct(req.body || {}, false);
  if (o.slug && o.slug !== s.data().slug && (await slugTaken(o.slug, s.id))) throw httpError(409, 'এই slug আগেই আছে');
  const warnings = await discountWarnings({ ...s.data(), ...o });
  const upd = {};
  for (const [k, v] of Object.entries(o)) {
    if (k === 'i18n') for (const [l, val] of Object.entries(v)) upd[`i18n.${l}`] = val; // অন্য ভাষা মুছে যায় না
    else upd[k] = v;
  }
  upd.updatedAt = FieldValue.serverTimestamp();
  await ref.update(upd);
  invalidateAll();
  res.json({ ok: true, warnings });
}));

// ================= চ্যাপ্টার =================
// মাঙ্গা: { number, title:{bn,..}, pages:[ছবির লিংক...] }
// ই-বুক: { number, title:{bn,..}, texts:{ bn:[পেজ টেক্সট...], en:[...] } }
function chapterPages(c) {
  if (Array.isArray(c.pages)) return c.pages.length;
  if (c.texts && typeof c.texts === 'object') return Math.max(0, ...Object.values(c.texts).map((a) => (Array.isArray(a) ? a.length : 0)));
  return 0;
}

async function rebuildIndex(pid) {
  const snap = await db.collection(`products/${pid}/chapters`).get();
  const list = snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (a.number || 0) - (b.number || 0));
  let pageCount = 0;
  let wordCount = 0;
  const idx = list.map((c) => {
    const pc = chapterPages(c);
    pageCount += pc;
    if (c.texts) {
      const arr = c.texts.bn || c.texts.en || Object.values(c.texts)[0] || [];
      wordCount += arr.join(' ').split(/\s+/).filter(Boolean).length;
    }
    return { id: c.id, number: c.number || 0, title: c.title || {}, pageCount: pc };
  });
  await db.doc('products/' + pid).update({ chapterIndex: idx, chapterCount: idx.length, pageCount, wordCount, updatedAt: FieldValue.serverTimestamp() });
  invalidateAll();
}

async function saveChapter(pid, cid, b) {
  const ps = await db.doc('products/' + pid).get();
  if (!ps.exists) throw httpError(404, 'প্রোডাক্ট নেই');
  const doc = { updatedAt: FieldValue.serverTimestamp() };
  if (b.number !== undefined) doc.number = Number(b.number) || 0;
  if (b.title !== undefined) {
    const t = {};
    for (const l of LANGS) if (b.title?.[l]) t[l] = S(b.title[l], 200);
    doc.title = t;
  }
  if (ps.data().type === 'manga') {
    if (b.pages !== undefined) {
      if (!Array.isArray(b.pages) || b.pages.length > 500 || !b.pages.every(isUrl)) throw httpError(400, 'pages ছবির লিংকের তালিকা হতে হবে (সর্বোচ্চ ৫০০)');
      doc.pages = b.pages;
    }
  } else if (b.texts !== undefined) {
    const t = {};
    for (const l of LANGS) {
      const arr = b.texts?.[l];
      if (arr === undefined) continue;
      if (!Array.isArray(arr) || arr.length > 1000 || !arr.every((x) => typeof x === 'string' && x.length <= 20000)) throw httpError(400, `texts.${l} পেজের তালিকা হতে হবে`);
      t[l] = arr;
    }
    doc.texts = t;
  }
  if (Buffer.byteLength(JSON.stringify(doc)) > 900000) throw httpError(413, 'চ্যাপ্টার খুব বড় (১MB সীমা), দুই ভাগ করুন');
  await db.doc(`products/${pid}/chapters/${cid}`).set(doc, { merge: true });
  await rebuildIndex(pid);
}

router.get('/products/:id/chapters', asyncHandler(async (req, res) => {
  if (!ID.test(req.params.id)) throw httpError(400, 'ভুল আইডি');
  const s = await db.doc('products/' + req.params.id).get();
  if (!s.exists) throw httpError(404, 'প্রোডাক্ট নেই');
  res.json({ items: s.data().chapterIndex || [] });
}));

router.get('/products/:id/chapters/:cid', asyncHandler(async (req, res) => {
  const { id, cid } = req.params;
  if (!ID.test(id) || !ID.test(cid)) throw httpError(400, 'ভুল আইডি');
  const s = await db.doc(`products/${id}/chapters/${cid}`).get();
  if (!s.exists) throw httpError(404, 'চ্যাপ্টার নেই');
  res.json({ id: s.id, ...s.data(), updatedAt: ms(s.data().updatedAt) });
}));

router.post('/products/:id/chapters', asyncHandler(async (req, res) => {
  if (!ID.test(req.params.id)) throw httpError(400, 'ভুল আইডি');
  const cid = db.collection(`products/${req.params.id}/chapters`).doc().id;
  await saveChapter(req.params.id, cid, req.body || {});
  res.status(201).json({ id: cid });
}));

router.put('/products/:id/chapters/:cid', asyncHandler(async (req, res) => {
  const { id, cid } = req.params;
  if (!ID.test(id) || !ID.test(cid)) throw httpError(400, 'ভুল আইডি');
  await saveChapter(id, cid, req.body || {});
  res.json({ ok: true });
}));

router.delete('/products/:id/chapters/:cid', asyncHandler(async (req, res) => {
  const { id, cid } = req.params;
  if (!ID.test(id) || !ID.test(cid)) throw httpError(400, 'ভুল আইডি');
  await db.doc(`products/${id}/chapters/${cid}`).delete();
  await rebuildIndex(id);
  res.json({ ok: true });
}));

// ================= সেটিংস =================
router.get('/settings/public', asyncHandler(async (req, res) => {
  const s = await db.doc('settings/public').get();
  res.json(s.exists ? s.data() : {});
}));

router.put('/settings/public', asyncHandler(async (req, res) => {
  const b = req.body || {};
  const o = {};
  if (b.categories !== undefined) {
    if (!Array.isArray(b.categories) || b.categories.length > 60) throw httpError(400, 'categories ঠিক নয়');
    o.categories = b.categories.map((c) => ({
      key: S(c.key, 40), type: TYPES.includes(c.type) ? c.type : 'manga',
      name: Object.fromEntries(LANGS.filter((l) => c.name?.[l]).map((l) => [l, S(c.name[l], 60)])),
    })).filter((c) => /^[a-z0-9_-]+$/.test(c.key));
  }
  if (b.banners !== undefined) {
    if (!Array.isArray(b.banners) || b.banners.length > 20) throw httpError(400, 'banners ঠিক নয়');
    const tr = (x) => Object.fromEntries(LANGS.filter((l) => x?.[l]).map((l) => [l, S(x[l], 200)]));
    o.banners = b.banners.map((x, i) => ({
      id: S(x.id, 40) || 'b' + Date.now() + i, image: isUrl(x.image) ? x.image : '', link: S(x.link, 300),
      title: tr(x.title), subtitle: tr(x.subtitle), cta: tr(x.cta), order: Number(x.order) || 0, active: x.active !== false,
    }));
  }
  if (b.announcement !== undefined) {
    const a = b.announcement || {};
    o.announcement = {
      active: !!a.active, link: S(a.link, 300),
      text: Object.fromEntries(LANGS.filter((l) => a.text?.[l]).map((l) => [l, S(a.text[l], 300)])),
    };
  }
  for (const k of ['salesTierMin', 'bestsellerMin', 'minDiscountBDT', 'minDiscountUSD', 'minPayableUSD']) {
    if (b[k] !== undefined) {
      const n = Number(b[k]);
      if (!(n >= 0)) throw httpError(400, k + ' ঠিক নয়');
      o[k] = n;
    }
  }
  if (!Object.keys(o).length) throw httpError(400, 'বদলানোর মতো কিছু নেই');
  await db.doc('settings/public').set(o, { merge: true });
  invalidateAll();
  res.json({ ok: true });
}));

// পেমেন্ট নম্বর/ঠিকানা Render Environment-এ থাকে (ডাটাবেসে নয়)। এখানে শুধু চালু আছে কিনা ও শেষ ৪ অক্ষর দেখায়।
// বদলাতে: Render -> Environment -> PAY_BKASH, PAY_NAGAD, USDT_BEP20_ADDRESS, USDT_ERC20_ADDRESS
router.get('/settings/payment', (req, res) => {
  const mask = (k) => {
    const v = (process.env[k] || '').trim();
    return v ? { configured: true, last4: v.slice(-4) } : { configured: false, last4: null };
  };
  res.json({
    source: 'env',
    bkash: mask('PAY_BKASH'),
    nagad: mask('PAY_NAGAD'),
    usdtBep20: mask('USDT_BEP20_ADDRESS'),
    usdtErc20: mask('USDT_ERC20_ADDRESS'),
  });
});

router.get('/env-check', (req, res) => res.json(checkEnv({ log: false })));

// ডেমো ডাটা (পরীক্ষার জন্য) বসানো/মোছা
router.post('/seed-demo', asyncHandler(async (req, res) => {
  await seedDemo();
  res.json({ ok: true });
}));
router.delete('/seed-demo', asyncHandler(async (req, res) => {
  await removeDemo();
  res.json({ ok: true });
}));

// ================= সাপোর্ট =================
router.get('/support', asyncHandler(async (req, res) => {
  const status = String(req.query.status || '');
  let q = db.collection('supportTickets');
  if (['open', 'answered', 'closed'].includes(status)) q = q.where('status', '==', status);
  const snap = await q.limit(100).get();
  const items = snap.docs
    .map((d) => {
      const t = d.data();
      const last = (t.messages || [])[(t.messages || []).length - 1];
      return {
        id: d.id, subject: t.subject, status: t.status, orderCode: t.orderCode || null, userId: t.userId || null,
        contactEmail: t.contactEmail || null, country: t.country || null, lastMessage: last?.text?.slice(0, 120) || '',
        lastFrom: last?.from || null, updatedAt: ms(t.updatedAt),
      };
    })
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  res.json({ items });
}));

router.get('/support/:id', asyncHandler(async (req, res) => {
  if (!ID.test(req.params.id)) throw httpError(400, 'ভুল আইডি');
  const s = await db.doc('supportTickets/' + req.params.id).get();
  if (!s.exists) throw httpError(404, 'টিকিট নেই');
  const { secretHash, ...t } = s.data();
  res.json({ id: s.id, ...t, createdAt: ms(t.createdAt), updatedAt: ms(t.updatedAt) });
}));

router.post('/support/:id/reply', asyncHandler(async (req, res) => {
  if (!ID.test(req.params.id)) throw httpError(400, 'ভুল আইডি');
  const message = S(req.body?.message, 2000);
  if (!message) throw httpError(400, 'রিপ্লাই লিখুন');
  const ref = db.doc('supportTickets/' + req.params.id);
  const s = await ref.get();
  if (!s.exists) throw httpError(404, 'টিকিট নেই');
  await ref.update({
    messages: FieldValue.arrayUnion({ from: 'admin', text: message, at: Date.now() }),
    status: 'answered',
    updatedAt: FieldValue.serverTimestamp(),
  });
  if (s.data().userId) pushToUser(s.data().userId, { title: 'MangaBooka', body: message.slice(0, 120), url: '/support', tag: 'ticket-' + ref.id });
  res.json({ ok: true });
}));

router.post('/support/:id/close', asyncHandler(async (req, res) => {
  if (!ID.test(req.params.id)) throw httpError(400, 'ভুল আইডি');
  await db.doc('supportTickets/' + req.params.id).update({ status: 'closed', updatedAt: FieldValue.serverTimestamp() });
  res.json({ ok: true });
}));

export default router;
