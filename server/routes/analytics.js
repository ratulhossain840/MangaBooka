// FILE: analytics.js
// PATH: server/routes/analytics.js
// ভিজিটর/ক্যাম্পেইন গণনা: শুধু aggregate counter (প্রতি ভিজিটে ১টি ছোট রাইট)।
// ফ্রন্টএন্ড প্রতি সেশনে একবারই /visit ডাকবে (ব্যাচ ৮-এ)

import { Router } from 'express';
import { FieldValue } from 'firebase-admin/firestore';
import * as FB from '../firebaseAdmin.js';
import { withContext, limiter, asyncHandler } from '../middleware/auth.js';

const db = FB.db || FB.firestore || (typeof FB.getDb === 'function' ? FB.getDb() : null) || FB.default;
const router = Router();
router.use(withContext);

const clean = (v, n = 40) => String(v || '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, n);
export const dayKey = (d = new Date()) => d.toISOString().slice(0, 10);

// body: { utm_source?, utm_medium?, utm_campaign?, productSlug? }
router.post('/visit', limiter(30, 1), asyncHandler(async (req, res) => {
  const b = req.body || {};
  const src = clean(b.utm_source);
  const med = clean(b.utm_medium);
  const camp = clean(b.utm_campaign);
  const slug = clean(b.productSlug, 80);
  const country = clean(req.ctx?.country, 2).toUpperCase();
  const inc = FieldValue.increment(1);

  const daily = { visits: inc };
  if (slug) daily.views = { [slug]: inc };
  if (country) daily.countries = { [country]: inc };

  const batch = db.batch();
  batch.set(db.doc('stats/daily_' + dayKey()), daily, { merge: true });
  if (src || camp) {
    const key = `${src || 'none'}__${camp || 'none'}`;
    batch.set(
      db.doc('campaigns/' + key),
      { source: src, medium: med, campaign: camp, visits: inc, lastVisitAt: FieldValue.serverTimestamp() },
      { merge: true }
    );
  }
  await batch.commit();
  res.json({ ok: true });
}));

export default router;
