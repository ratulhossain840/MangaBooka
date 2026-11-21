// FILE: content.js
// PATH: server/routes/content.js
// কনফার্ম হওয়া ক্রেতার জন্য মাঙ্গা/ই-বুক কনটেন্ট। কনফার্মের আগে এক পেজও নয়।
// এক্সেস: (১) লগইন ইউজারের লাইব্রেরি, বা (২) গেস্ট: হেডার x-order-code + x-order-secret, বা (৩) অ্যাডমিন

import { Router } from 'express';
import crypto from 'crypto';
import { db, isAdminUid } from '../firebaseAdmin.js';
import { optionalAuth, requireAuth, withContext, limiter, asyncHandler, httpError } from '../middleware/auth.js';

const router = Router();
router.use(withContext);
router.use((req, res, next) => {
  res.set('Cache-Control', 'private, no-store');
  next();
});

const sha = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
const safeEq = (a, b) => {
  const x = Buffer.from(String(a || '')), y = Buffer.from(String(b || ''));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};
const ID = /^[A-Za-z0-9_-]{1,64}$/;

async function hasAccess(req, productId) {
  const uid = req.user?.uid;
  if (uid) {
    if (isAdminUid(uid)) return true;
    const l = await db.doc(`users/${uid}/library/${productId}`).get();
    if (l.exists) return true;
  }
  const code = req.get('x-order-code');
  const secret = req.get('x-order-secret');
  if (code && secret) {
    const q = await db.collection('orders').where('orderCode', '==', String(code).trim().toUpperCase()).limit(1).get();
    if (!q.empty) {
      const o = q.docs[0].data();
      if (o.status === 'confirmed' && safeEq(o.secretHash, sha(secret)) && (o.items || []).some((i) => i.productId === productId)) return true;
    }
  }
  return false;
}

const pickLang = (obj, lang) => obj?.[lang] || obj?.en || obj?.bn || Object.values(obj || {})[0] || {};

// ---------- আমার লাইব্রেরি (লগইন) ----------
router.get('/library', requireAuth, asyncHandler(async (req, res) => {
  const lib = await db.collection(`users/${req.user.uid}/library`).limit(200).get();
  if (lib.empty) return res.json({ items: [] });
  const ids = lib.docs.map((d) => d.id);
  const snaps = await db.getAll(...ids.map((id) => db.doc('products/' + id)));
  const lang = req.ctx?.lang || 'en';
  const items = snaps
    .filter((s) => s.exists)
    .map((s) => {
      const p = s.data();
      return {
        productId: s.id,
        type: p.type,
        slug: p.slug,
        coverUrl: p.coverUrl || '',
        title: pickLang(p.i18n, lang).title || '',
        chapterCount: p.chapterCount || 0,
        pageCount: p.pageCount || 0,
        textLangs: p.textLangs || [],
      };
    });
  res.json({ items });
}));

// ---------- প্রোডাক্টের সূচি (চ্যাপ্টার তালিকা) ----------
router.get('/:productId/index', limiter(60, 5), optionalAuth, asyncHandler(async (req, res) => {
  const { productId } = req.params;
  if (!ID.test(productId)) throw httpError(400, 'ভুল আইডি');
  if (!(await hasAccess(req, productId))) throw httpError(403, 'এই কনটেন্ট দেখতে আগে কিনতে হবে (অর্ডার কনফার্ম হলে পাবেন)');
  const s = await db.doc('products/' + productId).get();
  if (!s.exists) throw httpError(404, 'প্রোডাক্ট নেই');
  const p = s.data();
  res.json({
    productId,
    type: p.type,
    slug: p.slug,
    title: pickLang(p.i18n, req.ctx?.lang || 'en').title || '',
    textLangs: p.textLangs || [],
    chapterIndex: p.chapterIndex || [],
  });
}));

// ---------- একটি চ্যাপ্টারের কনটেন্ট ----------
router.get('/:productId/chapter/:cid', limiter(120, 5), optionalAuth, asyncHandler(async (req, res) => {
  const { productId, cid } = req.params;
  if (!ID.test(productId) || !ID.test(cid)) throw httpError(400, 'ভুল আইডি');
  if (!(await hasAccess(req, productId))) throw httpError(403, 'এই কনটেন্ট দেখতে আগে কিনতে হবে (অর্ডার কনফার্ম হলে পাবেন)');

  const [ps, cs] = await Promise.all([
    db.doc('products/' + productId).get(),
    db.doc(`products/${productId}/chapters/${cid}`).get(),
  ]);
  if (!ps.exists || !cs.exists) throw httpError(404, 'চ্যাপ্টার পাওয়া যায়নি');
  const p = ps.data();
  const c = cs.data();

  if (p.type === 'manga') {
    return res.json({ id: cid, type: 'manga', number: c.number || 0, title: c.title || {}, pages: c.pages || [] });
  }

  const texts = c.texts || {};
  const want = String(req.query.lang || req.ctx?.lang || 'en');
  const lang = texts[want] ? want : texts.en ? 'en' : texts.bn ? 'bn' : Object.keys(texts)[0];
  res.json({
    id: cid,
    type: 'ebook',
    number: c.number || 0,
    title: c.title || {},
    lang: lang || null,
    availableLangs: Object.keys(texts),
    pages: (lang && texts[lang]) || [],
  });
}));

export default router;
