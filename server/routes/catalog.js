// FILE: catalog.js
// PATH: server/routes/catalog.js (রিপোতে server/routes ফোল্ডারের ভেতরে)
// কাজ: ক্রেতার জন্য প্রোডাক্ট তালিকা, হোম সেকশন, প্রোডাক্ট বিস্তারিত, সেটিংস ও লাইক/ডিসলাইক
// সব তালিকা সার্ভারের মেমোরি ক্যাশ থেকে আসে (Firestore রিড প্রায় শূন্য)
//
// API তালিকা (সবগুলোতে ?lang=bn&country=BD দেওয়া যায়, না দিলে সার্ভার নিজে ঠিক করে):
//   GET  /api/catalog/config                  ভাষা, দেশ, বাজার, ক্যাটাগরি, ব্যানার
//   GET  /api/catalog/home?type=manga|ebook   হোমের সেকশন (featured, new, trending, sale)
//   GET  /api/catalog/products                তালিকা (type, category, q, sort, limit, cursor)
//   GET  /api/catalog/product/:slug           প্রোডাক্টের বিস্তারিত + সম্পর্কিত
//   POST /api/catalog/product/:id/react       লাইক/ডিসলাইক (লগইন লাগে) body: {value:'like'|'dislike'|'none'}

import { Router } from 'express';
import { db, FieldValue } from '../firebaseAdmin.js';
import { optionalAuth, requireAuth, withContext, limiter, asyncHandler, httpError } from '../middleware/auth.js';
import { getCatalog, getSettings, patchProductStats } from '../utils/cache.js';
import {
  toCard,
  toDetail,
  pickText,
  localize,
  toMillis,
  currencyOf,
  LANGS,
  LANG_NAMES,
  DEFAULT_LANG_BY_COUNTRY,
} from '../utils/pricing.js';

const router = Router();
router.use(withContext);
router.use((req, res, next) => {
  res.set('Cache-Control', 'private, max-age=30');
  next();
});

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,99}$/i;
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const TYPES = ['manga', 'ebook'];

// বর্তমান বাজারে দাম আছে এমন প্রোডাক্টগুলো (card সহ)
function visible(catalog, ctx, settings, type, now) {
  const out = [];
  for (const p of catalog.list) {
    if (type && p.type !== type) continue;
    const card = toCard(p, ctx, settings, now);
    if (card) out.push({ p, card });
  }
  return out;
}

const createdOf = (x) => toMillis(x.p.createdAt) || 0;
const soldOf = (x) => Number(x.p.stats?.sold) || 0;
const scoreOf = (x) => (Number(x.p.stats?.likes) || 0) - (Number(x.p.stats?.dislikes) || 0);

const SORTERS = {
  default: (a, b) =>
    (b.p.featured ? 1 : 0) - (a.p.featured ? 1 : 0) ||
    (Number(a.p.sortOrder) || 9999) - (Number(b.p.sortOrder) || 9999) ||
    createdOf(b) - createdOf(a),
  new: (a, b) => createdOf(b) - createdOf(a),
  popular: (a, b) => soldOf(b) - soldOf(a) || scoreOf(b) - scoreOf(a) || createdOf(b) - createdOf(a),
  price_asc: (a, b) => a.card.price.final - b.card.price.final,
  price_desc: (a, b) => b.card.price.final - a.card.price.final,
};

function matchesQuery(x, q) {
  const bn = localize(x.p, 'bn');
  const en = localize(x.p, 'en');
  const hay = [x.card.title, x.card.headline, x.card.caption, x.card.category, bn.title, en.title]
    .join(' ')
    .toLowerCase();
  return hay.includes(q);
}

// ---------- কনফিগ ----------
router.get(
  '/config',
  asyncHandler(async (req, res) => {
    const s = await getSettings();
    const { country, detectedCountry, lang, market } = req.ctx;

    const categories = (s.categories || []).map((c) => ({
      key: c.key,
      type: c.type,
      name: pickText(c.name, lang),
    }));
    const banners = (s.banners || [])
      .filter((b) => b && b.active !== false && b.image)
      .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0))
      .map((b) => ({
        id: b.id,
        image: b.image,
        link: b.link || '',
        title: pickText(b.title, lang),
        subtitle: pickText(b.subtitle, lang),
        cta: pickText(b.cta, lang),
      }));
    const a = s.announcement;
    const announcement =
      a && a.active ? { text: pickText(a.text, lang), link: a.link || '' } : null;

    res.json({
      ok: true,
      country,
      detectedCountry,
      lang,
      suggestedLang: DEFAULT_LANG_BY_COUNTRY[country] || 'en',
      market,
      currency: currencyOf(market),
      languages: LANGS.map((code) => ({ code, name: LANG_NAMES[code] })),
      categories,
      banners,
      announcement,
    });
  })
);

// ---------- হোম ----------
router.get(
  '/home',
  asyncHandler(async (req, res) => {
    const type = TYPES.includes(req.query.type) ? req.query.type : null;
    const [catalog, settings] = await Promise.all([getCatalog(), getSettings()]);
    const now = Date.now();
    const all = visible(catalog, req.ctx, settings, type, now);
    const cards = (arr) => arr.slice(0, 12).map((x) => x.card);

    const featured = all.filter((x) => x.p.featured).sort(SORTERS.default);
    const fresh = [...all].sort(SORTERS.new);
    const trending = [...all].sort(SORTERS.popular);
    const sale = all.filter((x) => x.card.price.onSale).sort(SORTERS.popular);

    res.json({
      ok: true,
      market: req.ctx.market,
      sections: {
        featured: cards(featured),
        new: cards(fresh),
        trending: cards(trending),
        sale: cards(sale),
      },
    });
  })
);

// ---------- তালিকা (ইনফিনিট স্ক্রলের জন্য cursor) ----------
router.get(
  '/products',
  asyncHandler(async (req, res) => {
    const q = req.query;
    const type = TYPES.includes(q.type) ? q.type : null;
    const category = typeof q.category === 'string' ? q.category.slice(0, 60) : '';
    const search = typeof q.q === 'string' ? q.q.trim().toLowerCase().slice(0, 60) : '';
    const sort = SORTERS[q.sort] ? q.sort : 'default';
    const limit = Math.min(30, Math.max(1, parseInt(q.limit, 10) || 12));
    const offset = Math.max(0, parseInt(q.cursor, 10) || 0);

    const [catalog, settings] = await Promise.all([getCatalog(), getSettings()]);
    let items = visible(catalog, req.ctx, settings, type, Date.now());
    if (category) items = items.filter((x) => x.p.category === category);
    if (search) items = items.filter((x) => matchesQuery(x, search));
    items.sort(SORTERS[sort]);

    const total = items.length;
    const slice = items.slice(offset, offset + limit).map((x) => x.card);
    res.json({
      ok: true,
      market: req.ctx.market,
      total,
      items: slice,
      nextCursor: offset + limit < total ? offset + limit : null,
    });
  })
);

// ---------- প্রোডাক্টের বিস্তারিত ----------
router.get(
  '/product/:slug',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const slug = String(req.params.slug || '').toLowerCase();
    if (!SLUG_RE.test(slug)) throw httpError(404, 'not_found');

    const [catalog, settings] = await Promise.all([getCatalog(), getSettings()]);
    const p = catalog.bySlug.get(slug);
    if (!p) throw httpError(404, 'not_found');

    const now = Date.now();
    const product = toDetail(p, req.ctx, settings, now);
    if (!product) throw httpError(404, 'not_available_in_market');

    const related = catalog.list
      .filter((x) => x.id !== p.id && x.type === p.type && (!p.category || x.category === p.category))
      .sort((a, b) => (Number(b.stats?.sold) || 0) - (Number(a.stats?.sold) || 0))
      .map((x) => toCard(x, req.ctx, settings, now))
      .filter(Boolean)
      .slice(0, 6);

    // লগইন করা ক্রেতার নিজের লাইক/ডিসলাইক (১টি রিড, শুধু লগইন থাকলে)
    let myReaction = null;
    if (req.user) {
      const r = await db.doc(`products/${p.id}/reactions/${req.user.uid}`).get();
      myReaction = r.exists ? r.data().value || null : null;
    }

    const siteUrl = (process.env.SITE_URL || '').replace(/\/$/, '');
    res.json({
      ok: true,
      market: req.ctx.market,
      product,
      related,
      myReaction,
      shareUrl: `${siteUrl}/p/${p.slug}`,
    });
  })
);

// ---------- লাইক / ডিসলাইক (শুধু আসল, প্রতি ইউজারের একটি) ----------
router.post(
  '/product/:id/react',
  limiter(30, 1),
  requireAuth,
  asyncHandler(async (req, res) => {
    const id = String(req.params.id || '');
    const value = req.body && req.body.value;
    if (!ID_RE.test(id)) throw httpError(404, 'not_found');
    if (!['like', 'dislike', 'none'].includes(value)) throw httpError(400, 'invalid_value');

    const catalog = await getCatalog();
    if (!catalog.byId.has(id)) throw httpError(404, 'not_found');

    const pref = db.collection('products').doc(id);
    const rref = pref.collection('reactions').doc(req.user.uid);
    const next = value === 'none' ? null : value;

    const out = await db.runTransaction(async (tx) => {
      const [ps, rs] = await Promise.all([tx.get(pref), tx.get(rref)]);
      if (!ps.exists || ps.data().status !== 'published') throw httpError(404, 'not_found');
      const prev = rs.exists ? rs.data().value || null : null;
      const s = ps.data().stats || {};
      let likes = Number(s.likes) || 0;
      let dislikes = Number(s.dislikes) || 0;
      if (prev === next) return { likes, dislikes, my: next };

      let dl = 0;
      let dd = 0;
      if (prev === 'like') dl -= 1;
      if (prev === 'dislike') dd -= 1;
      if (next === 'like') dl += 1;
      if (next === 'dislike') dd += 1;

      tx.update(pref, {
        'stats.likes': FieldValue.increment(dl),
        'stats.dislikes': FieldValue.increment(dd),
      });
      if (next) tx.set(rref, { value: next, at: FieldValue.serverTimestamp() });
      else tx.delete(rref);

      likes = Math.max(0, likes + dl);
      dislikes = Math.max(0, dislikes + dd);
      return { likes, dislikes, my: next };
    });

    patchProductStats(id, { likes: out.likes, dislikes: out.dislikes });
    res.json({ ok: true, likes: out.likes, dislikes: out.dislikes, myReaction: out.my });
  })
);

export default router;
