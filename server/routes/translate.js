// FILE: translate.js
// PATH: server/routes/translate.js
// অনুবাদের অ্যাডমিন API (সবগুলো requireAdmin-এর পেছনে)
//   GET  /api/translate/health                  Gemini কী কয়টি, মডেল কোনটি
//   POST /api/translate/test                    {text, to} একটি ছোট লেখা অনুবাদ করে কী পরীক্ষা
//   POST /api/translate/products/:id            {langs?:['en','ja'..], force?:bool} অনুবাদ শুরু
//   GET  /api/translate/status/:productId       কোন ভাষায় কতটা অনূদিত
//   GET  /api/translate/jobs                    সাম্প্রতিক কাজ
//   GET  /api/translate/jobs/:id                একটি কাজের প্রগ্রেস
//   POST /api/translate/jobs/:id/cancel | /retry

import { Router } from 'express';
import { db } from '../firebaseAdmin.js';
import { requireAdmin, limiter, asyncHandler, httpError } from '../middleware/auth.js';
import { LANGS } from '../utils/pricing.js';
import { translateStrings, keyCount, modelName } from '../utils/gemini.js';
import { enqueue, cancelJob, retryJob, resumeJobs, jobView } from '../utils/translateQueue.js';

const router = Router();
router.use(limiter(120, 1));
router.use(requireAdmin);
router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

const ID = /^[A-Za-z0-9_-]{1,64}$/;
const st = (e) => (e && e.status) || (e && e.code === 'BAD_LANG' ? 400 : 502);

// সার্ভার চালু হওয়ার একটু পরে অসমাপ্ত অনুবাদ আবার ধরে (Render ঘুম থেকে উঠলে)
setTimeout(() => resumeJobs().catch((e) => console.error('[translate] resume ব্যর্থ', e.message)), 5000);

router.get('/health', (req, res) => {
  res.json({ ok: true, keys: keyCount(), model: modelName(), langs: LANGS });
});

router.post(
  '/test',
  limiter(10, 1),
  asyncHandler(async (req, res) => {
    const to = String(req.body?.to || 'en');
    const text = String(req.body?.text || 'আমি বই পড়তে ভালোবাসি।').slice(0, 500);
    try {
      const [out] = await translateStrings([text], to);
      res.json({ ok: true, to, text, translated: out });
    } catch (e) {
      throw httpError(st(e), e.message);
    }
  })
);

router.post(
  '/products/:id',
  asyncHandler(async (req, res) => {
    if (!ID.test(req.params.id)) throw httpError(400, 'ভুল আইডি');
    const langs = Array.isArray(req.body?.langs) ? req.body.langs : [];
    try {
      const job = await enqueue({
        productId: req.params.id,
        langs,
        force: req.body?.force === true,
        by: req.user?.uid || null,
      });
      res.status(202).json({ ok: true, job });
    } catch (e) {
      throw httpError(st(e), e.message);
    }
  })
);

// কোন ভাষায় কতটা তৈরি আছে
router.get(
  '/status/:productId',
  asyncHandler(async (req, res) => {
    const id = req.params.productId;
    if (!ID.test(id)) throw httpError(400, 'ভুল আইডি');
    const ref = db.doc('products/' + id);
    const ps = await ref.get();
    if (!ps.exists) throw httpError(404, 'প্রোডাক্ট নেই');
    const p = ps.data();
    const isEbook = p.type === 'ebook';
    let chapters = [];
    if (isEbook) {
      const cs = await ref.collection('chapters').get();
      chapters = cs.docs.map((d) => d.data()).filter((c) => c.texts && Array.isArray(c.texts.bn) && c.texts.bn.length);
    }
    const langs = LANGS.filter((l) => l !== 'bn').map((l) => ({
      lang: l,
      meta: !!(p.i18n && p.i18n[l] && p.i18n[l].title),
      chaptersDone: chapters.filter((c) => Array.isArray(c.texts[l]) && c.texts[l].length === c.texts.bn.length).length,
      chaptersTotal: chapters.length,
    }));
    res.json({ ok: true, type: p.type, textLangs: p.textLangs || [], langs });
  })
);

router.get(
  '/jobs',
  asyncHandler(async (req, res) => {
    const snap = await db.collection('translateJobs').limit(60).get();
    const items = snap.docs
      .map((d) => jobView(d.id, d.data()))
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      .slice(0, 30);
    res.json({ ok: true, items });
  })
);

router.get(
  '/jobs/:id',
  asyncHandler(async (req, res) => {
    if (!ID.test(req.params.id)) throw httpError(400, 'ভুল আইডি');
    const s = await db.doc('translateJobs/' + req.params.id).get();
    if (!s.exists) throw httpError(404, 'কাজ নেই');
    res.json({ ok: true, job: jobView(s.id, s.data()) });
  })
);

router.post(
  '/jobs/:id/cancel',
  asyncHandler(async (req, res) => {
    if (!ID.test(req.params.id)) throw httpError(400, 'ভুল আইডি');
    try {
      await cancelJob(req.params.id);
      res.json({ ok: true });
    } catch (e) {
      throw httpError(st(e), e.message);
    }
  })
);

router.post(
  '/jobs/:id/retry',
  asyncHandler(async (req, res) => {
    if (!ID.test(req.params.id)) throw httpError(400, 'ভুল আইডি');
    try {
      await retryJob(req.params.id);
      res.json({ ok: true });
    } catch (e) {
      throw httpError(st(e), e.message);
    }
  })
);

export default router;
