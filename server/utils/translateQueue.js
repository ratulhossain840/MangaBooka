// FILE: translateQueue.js
// PATH: server/utils/translateQueue.js
// কাজ: অনুবাদের কিউ। একটি একটি করে কাজ চলে, প্রগ্রেস Firestore-এ (translateJobs/{id}) সেভ হয়,
// Render ঘুমিয়ে বা রিস্টার্ট হলে resumeJobs() বাকি অংশ থেকে আবার শুরু করে (যা অনূদিত হয়ে গেছে তা বাদ যায়)।
// একক হিসাব: প্রতি ভাষায় ১টি "তথ্য" ধাপ (নাম, বিবরণ ইত্যাদি + অধ্যায়ের নাম) + ই-বুকে প্রতি অধ্যায়ের ১টি ধাপ।

import { db, FieldValue } from '../firebaseAdmin.js';
import { translateStrings, keyCount } from './gemini.js';
import { invalidateCatalog } from './cache.js';
import { LANGS } from './pricing.js';

const JOBS = 'translateJobs';
const ACTIVE = ['queued', 'running'];
const queue = [];
const cancelled = new Set();
let working = false;

const ts = () => FieldValue.serverTimestamp();
const fail = (status, message) => Object.assign(new Error(message), { status });
const ms = (t) => (t && typeof t.toMillis === 'function' ? t.toMillis() : null);
const byNumber = (a, b) => (a.number || 0) - (b.number || 0);

export function jobView(id, j) {
  return {
    id,
    productId: j.productId,
    langs: j.langs || [],
    force: !!j.force,
    status: j.status,
    total: j.total || 0,
    done: j.done || 0,
    current: j.current || '',
    errors: j.errors || [],
    createdAt: ms(j.createdAt),
    updatedAt: ms(j.updatedAt),
    finishedAt: ms(j.finishedAt),
  };
}

// ---------- নতুন কাজ ----------
export async function enqueue({ productId, langs, force = false, by = null }) {
  if (!keyCount()) throw fail(400, 'GEMINI_KEYS সেট করা নেই (Render Environment-এ বসান)');
  const ps = await db.doc('products/' + productId).get();
  if (!ps.exists) throw fail(404, 'প্রোডাক্ট নেই');

  const want = [...new Set((langs && langs.length ? langs : LANGS).filter((l) => LANGS.includes(l) && l !== 'bn'))];
  if (!want.length) throw fail(400, 'অনুবাদের ভাষা বাছুন (বাংলা বাদে)');

  const running = await db.collection(JOBS).where('productId', '==', productId).get();
  if (running.docs.some((d) => ACTIVE.includes(d.data().status))) throw fail(409, 'এই প্রোডাক্টের অনুবাদ আগে থেকেই চলছে');

  const ref = db.collection(JOBS).doc();
  const job = {
    productId,
    langs: want,
    force: !!force,
    status: 'queued',
    total: 0,
    done: 0,
    current: '',
    errors: [],
    createdBy: by,
    createdAt: ts(),
    updatedAt: ts(),
  };
  await ref.set(job);
  queue.push(ref.id);
  kick();
  return { id: ref.id, ...job, createdAt: Date.now(), updatedAt: Date.now() };
}

export async function cancelJob(id) {
  const ref = db.doc(`${JOBS}/${id}`);
  const s = await ref.get();
  if (!s.exists) throw fail(404, 'কাজ পাওয়া যায়নি');
  if (!ACTIVE.includes(s.data().status)) throw fail(409, 'এই কাজ আগেই শেষ হয়েছে');
  cancelled.add(id);
  await ref.update({ status: 'cancelled', updatedAt: ts(), finishedAt: ts() });
}

export async function retryJob(id) {
  const ref = db.doc(`${JOBS}/${id}`);
  const s = await ref.get();
  if (!s.exists) throw fail(404, 'কাজ পাওয়া যায়নি');
  if (ACTIVE.includes(s.data().status)) throw fail(409, 'এই কাজ এখন চলছে');
  const other = await db.collection(JOBS).where('productId', '==', s.data().productId).get();
  if (other.docs.some((d) => d.id !== id && ACTIVE.includes(d.data().status))) throw fail(409, 'এই প্রোডাক্টের আরেকটি অনুবাদ চলছে');
  cancelled.delete(id);
  await ref.update({ status: 'queued', force: false, errors: [], done: 0, current: '', updatedAt: ts() }); // যা হয়ে গেছে তা বাদ যাবে
  queue.push(id);
  kick();
}

// সার্ভার চালু হলে অসমাপ্ত কাজ আবার ধরা
export async function resumeJobs() {
  const snap = await db.collection(JOBS).where('status', 'in', ACTIVE).get();
  for (const d of snap.docs) {
    if (d.data().status === 'running') await d.ref.update({ status: 'queued', force: false, updatedAt: ts() });
    if (!queue.includes(d.id)) queue.push(d.id);
  }
  if (snap.size) console.log(`[translate] ${snap.size}টি অসমাপ্ত কাজ আবার শুরু`);
  kick();
}

function kick() {
  if (working) return;
  working = true;
  (async () => {
    try {
      while (queue.length) {
        const id = queue.shift();
        try {
          await runJob(id);
        } catch (e) {
          console.error('[translate] কাজ ব্যর্থ', id, e);
        }
        cancelled.delete(id);
      }
    } finally {
      working = false;
    }
  })();
}

// ---------- একটি কাজ চালানো ----------
async function runJob(id) {
  const ref = db.doc(`${JOBS}/${id}`);
  const snap = await ref.get();
  if (!snap.exists) return;
  const job = snap.data();
  if (!ACTIVE.includes(job.status)) return;
  const force = !!job.force;
  const errors = [];

  await ref.update({ status: 'running', errors: [], done: 0, updatedAt: ts() });

  try {
    const pref = db.doc('products/' + job.productId);
    const ps = await pref.get();
    if (!ps.exists) throw fail(404, 'প্রোডাক্ট মুছে গেছে');
    const p = ps.data();
    if (!(p.i18n && p.i18n.bn && p.i18n.bn.title)) throw fail(400, 'আগে বাংলা নাম ও বিবরণ সেভ করুন');
    const isEbook = p.type === 'ebook';

    const chSnap = await pref.collection('chapters').get();
    const chapters = chSnap.docs.map((d) => ({ id: d.id, ref: d.ref, ...d.data() })).sort(byNumber);
    const textCh = isEbook ? chapters.filter((c) => c.texts && Array.isArray(c.texts.bn) && c.texts.bn.length) : [];

    const total = job.langs.length * (1 + textCh.length);
    let done = 0;
    let streak = 0;
    let state = 'ok';
    let chapterIndex = Array.isArray(p.chapterIndex) ? p.chapterIndex : [];
    await ref.update({ total, updatedAt: ts() });

    const progress = (label) => ref.update({ done, total, current: label, errors, updatedAt: ts() }).catch(() => {});

    // একটি ধাপ চালায়: 'ok' | 'fail' | 'cancelled' | 'abort'
    const step = async (lang, label, fn) => {
      if (cancelled.has(id)) return 'cancelled';
      let r = 'ok';
      try {
        await fn();
        streak = 0;
      } catch (e) {
        if (errors.length < 20) errors.push({ lang, unit: label, message: String(e.message || e).slice(0, 200) });
        streak++;
        r = streak >= 3 ? 'abort' : 'fail';
      }
      done++;
      await progress(`${lang} · ${label}`);
      return r;
    };

    // বইয়ের নাম, বিবরণ, বুলেট, সূচি ও অধ্যায়ের নাম
    const translateMeta = async (lang) => {
      if (!force && p.i18n[lang] && p.i18n[lang].title) return;
      const bn = p.i18n.bn;
      const bullets = bn.bullets || [];
      const toc = bn.toc || [];
      const titles = chapters.map((c) => (c.title && c.title.bn) || '');
      const flat = [bn.title, bn.headline || '', bn.caption || '', bn.description || '', ...bullets, ...toc, ...titles];
      const out = await translateStrings(flat, lang, { context: `${p.type === 'manga' ? 'manga' : 'ebook'} store listing` });

      let i = 4;
      const bl = out.slice(i, i + bullets.length);
      i += bullets.length;
      const tc = out.slice(i, i + toc.length);
      i += toc.length;
      const ct = out.slice(i, i + titles.length);

      const obj = { title: out[0], headline: out[1], caption: out[2], description: out[3], bullets: bl, toc: tc };
      const idxNew = chapterIndex.map((x) => {
        const k = chapters.findIndex((c) => c.id === x.id);
        return k >= 0 && ct[k] ? { ...x, title: { ...(x.title || {}), [lang]: ct[k] } } : x;
      });
      const upd = { [`i18n.${lang}`]: obj, chapterIndex: idxNew, updatedAt: ts() };
      if (!isEbook) upd.textLangs = FieldValue.arrayUnion('bn', lang); // মাঙ্গায় শুধু তথ্য অনূদিত হয়
      await pref.update(upd);

      const batch = db.batch();
      chapters.forEach((c, k) => {
        if (ct[k]) batch.set(c.ref, { title: { [lang]: ct[k] } }, { merge: true });
      });
      await batch.commit();

      p.i18n[lang] = obj;
      chapterIndex = idxNew;
      invalidateCatalog();
    };

    // ই-বুকের একটি অধ্যায়ের সব পেজ
    const translateChapter = async (c, lang) => {
      const bnPages = c.texts.bn;
      if (!force && Array.isArray(c.texts[lang]) && c.texts[lang].length === bnPages.length) return;
      const out = await translateStrings(bnPages, lang, { context: (c.title && c.title.bn) || '' });
      await c.ref.set({ texts: { [lang]: out }, updatedAt: ts() }, { merge: true });
      c.texts[lang] = out;
    };

    outer: for (const lang of job.langs) {
      let ok = true;
      let r = await step(lang, 'তথ্য', () => translateMeta(lang));
      if (r === 'cancelled' || r === 'abort') {
        state = r;
        break;
      }
      if (r === 'fail') ok = false;

      for (const c of textCh) {
        r = await step(lang, `অধ্যায় ${c.number || ''}`.trim(), () => translateChapter(c, lang));
        if (r === 'cancelled' || r === 'abort') {
          state = r;
          break outer;
        }
        if (r === 'fail') ok = false;
      }
      if (ok && isEbook) {
        await pref.update({ textLangs: FieldValue.arrayUnion('bn', lang), updatedAt: ts() });
        invalidateCatalog();
      }
    }

    const finalStatus = state === 'cancelled' ? 'cancelled' : state === 'abort' ? 'error' : errors.length ? 'partial' : 'done';
    await ref.update({ status: finalStatus, done, total, errors, current: '', finishedAt: ts(), updatedAt: ts() });
    invalidateCatalog();
  } catch (e) {
    await ref.update({
      status: 'error',
      errors: [...errors, { lang: '-', unit: 'কাজ', message: String(e.message || e).slice(0, 200) }].slice(0, 20),
      finishedAt: ts(),
      updatedAt: ts(),
    });
  }
    }
