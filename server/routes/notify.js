// FILE: notify.js
// PATH: server/routes/notify.js (রিপোতে server/routes ফোল্ডারের ভেতরে)
// কাজ: পুশ নোটিফিকেশন (FCM)। লগইন করা ক্রেতার ফোনের টোকেন জমা রাখে; অর্ডার কনফার্ম/বাতিল ও সাপোর্ট উত্তরে admin.js এর pushToUser() ডাকে।
//   POST   /api/notify/token  { token }   টোকেন জমা (লগইন লাগবে)
//   DELETE /api/notify/token  { token }   টোকেন মোছা
// ব্যর্থ হলে কখনো মূল কাজ আটকায় না (pushToUser কখনো ত্রুটি ছোঁড়ে না)।

import { Router } from 'express';
import crypto from 'crypto';
import { getMessaging } from 'firebase-admin/messaging';
import { db, FieldValue } from '../firebaseAdmin.js';
import { requireAuth, limiter, asyncHandler, httpError } from '../middleware/auth.js';

const router = Router();
const TOKEN_RE = /^[A-Za-z0-9_:\-.]{20,4096}$/;
const key = (t) => crypto.createHash('sha1').update(t).digest('hex');
const MAX_TOKENS = 5;

router.post(
  '/token',
  limiter(20, 10),
  requireAuth,
  asyncHandler(async (req, res) => {
    const token = String(req.body?.token || '');
    if (!TOKEN_RE.test(token)) throw httpError(400, 'টোকেন ঠিক নয়');
    const col = db.collection(`users/${req.user.uid}/pushTokens`);
    await col.doc(key(token)).set({ token, updatedAt: FieldValue.serverTimestamp(), ua: String(req.get('user-agent') || '').slice(0, 120) }, { merge: true });
    // পুরনো টোকেন ছাঁটা (সর্বোচ্চ ৫)
    const all = await col.get();
    if (all.size > MAX_TOKENS) {
      const old = all.docs
        .map((d) => ({ ref: d.ref, t: d.data().updatedAt?.toMillis?.() || 0 }))
        .sort((a, b) => a.t - b.t)
        .slice(0, all.size - MAX_TOKENS);
      await Promise.all(old.map((o) => o.ref.delete()));
    }
    res.json({ ok: true });
  })
);

router.delete(
  '/token',
  requireAuth,
  asyncHandler(async (req, res) => {
    const token = String(req.body?.token || '');
    if (!TOKEN_RE.test(token)) throw httpError(400, 'টোকেন ঠিক নয়');
    await db.doc(`users/${req.user.uid}/pushTokens/${key(token)}`).delete();
    res.json({ ok: true });
  })
);

// অন্য ফাইল থেকে ডাকার ফাংশন: ব্যবহারকারীর সব ডিভাইসে পাঠায়, ফেল হলে চুপচাপ, মৃত টোকেন মোছে
export async function pushToUser(uid, { title, body, url = '/', tag } = {}) {
  try {
    if (!uid) return;
    const snap = await db.collection(`users/${uid}/pushTokens`).get();
    if (snap.empty) return;
    const docs = snap.docs;
    const data = { title: String(title || 'MangaBooka').slice(0, 100), body: String(body || '').slice(0, 200), url: String(url || '/').slice(0, 300) };
    if (tag) data.tag = String(tag).slice(0, 60);
    const r = await getMessaging().sendEachForMulticast({ tokens: docs.map((d) => d.data().token), data });
    await Promise.all(
      r.responses.map((x, i) => {
        const code = x.error && x.error.code;
        return code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token' ? docs[i].ref.delete() : null;
      })
    );
  } catch (e) {
    console.error('[push] ব্যর্থ', e && e.message);
  }
}

export default router;
