// FILE: support.js
// PATH: server/routes/support.js
// সাপোর্ট: ক্রেতা মেসেজ পাঠায়, অ্যাডমিন রিপ্লাই দেয় (অ্যাডমিনের অংশ admin.js-এ)
// গেস্টের জন্য টিকিট তৈরির সময় একবার secret দেওয়া হয়; পরে হেডার x-ticket-secret দিয়ে দেখবে

import { Router } from 'express';
import crypto from 'crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from '../firebaseAdmin.js';
import { optionalAuth, requireAuth, withContext, limiter, asyncHandler, httpError } from '../middleware/auth.js';

const router = Router();
router.use(withContext);

const sha = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
const safeEq = (a, b) => {
  const x = Buffer.from(String(a || '')), y = Buffer.from(String(b || ''));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};
const ms = (t) => (t && typeof t.toMillis === 'function' ? t.toMillis() : null);
const ID = /^[A-Za-z0-9_-]{1,64}$/;

const view = (id, t) => ({
  id,
  subject: t.subject,
  status: t.status,
  orderCode: t.orderCode || null,
  messages: t.messages || [],
  createdAt: ms(t.createdAt),
  updatedAt: ms(t.updatedAt),
});

function canSee(req, t) {
  const uid = req.user?.uid;
  if (uid && t.userId === uid) return true;
  const secret = req.get('x-ticket-secret');
  return !!(secret && t.secretHash && safeEq(t.secretHash, sha(secret)));
}

// নতুন টিকিট: { subject, message, email? (গেস্টের জন্য বাধ্যতামূলক), orderCode? }
router.post('/', limiter(5, 10), optionalAuth, asyncHandler(async (req, res) => {
  const b = req.body || {};
  const uid = req.user?.uid || null;
  const subject = String(b.subject || '').trim().slice(0, 120);
  const message = String(b.message || '').trim().slice(0, 2000);
  if (!subject || !message) throw httpError(400, 'বিষয় ও মেসেজ লিখুন');

  let email = null;
  if (b.email) {
    email = String(b.email).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 120) throw httpError(400, 'ইমেইল ঠিক নয়');
  }
  if (!uid && !email) throw httpError(400, 'লগইন না থাকলে ইমেইল দিন');

  const orderCode = b.orderCode ? String(b.orderCode).trim().toUpperCase().slice(0, 20) : null;
  const secret = uid ? null : crypto.randomBytes(18).toString('hex');
  const now = Date.now();
  const ref = db.collection('supportTickets').doc();
  await ref.set({
    userId: uid,
    contactEmail: email,
    orderCode,
    subject,
    status: 'open',
    secretHash: secret ? sha(secret) : null,
    messages: [{ from: 'user', text: message, at: now }],
    country: req.ctx?.country || null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  res.status(201).json({ id: ref.id, secret });
}));

// আমার টিকিট (লগইন)
router.get('/mine', requireAuth, asyncHandler(async (req, res) => {
  const q = await db.collection('supportTickets').where('userId', '==', req.user.uid).limit(50).get();
  const items = q.docs.map((d) => view(d.id, d.data())).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  res.set('Cache-Control', 'no-store');
  res.json({ items });
}));

// একটি টিকিট দেখা
router.get('/:id', limiter(60, 5), optionalAuth, asyncHandler(async (req, res) => {
  if (!ID.test(req.params.id)) throw httpError(400, 'ভুল আইডি');
  const s = await db.doc('supportTickets/' + req.params.id).get();
  if (!s.exists || !canSee(req, s.data())) throw httpError(404, 'টিকিট পাওয়া যায়নি');
  res.set('Cache-Control', 'no-store');
  res.json(view(s.id, s.data()));
}));

// ক্রেতার রিপ্লাই: { message }
router.post('/:id/reply', limiter(20, 10), optionalAuth, asyncHandler(async (req, res) => {
  if (!ID.test(req.params.id)) throw httpError(400, 'ভুল আইডি');
  const message = String(req.body?.message || '').trim().slice(0, 2000);
  if (!message) throw httpError(400, 'মেসেজ লিখুন');
  const ref = db.doc('supportTickets/' + req.params.id);
  const s = await ref.get();
  if (!s.exists || !canSee(req, s.data())) throw httpError(404, 'টিকিট পাওয়া যায়নি');
  if ((s.data().messages || []).length >= 100) throw httpError(409, 'এই টিকিটে মেসেজ সীমা শেষ, নতুন টিকিট খুলুন');
  await ref.update({
    messages: FieldValue.arrayUnion({ from: 'user', text: message, at: Date.now() }),
    status: 'open',
    updatedAt: FieldValue.serverTimestamp(),
  });
  res.json({ ok: true });
}));

export default router;
