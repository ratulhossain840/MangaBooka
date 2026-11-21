// FILE: seed.js
// PATH: server/scripts/seed.js
// কাজ: পরীক্ষার জন্য ডেমো ডাটা (১টি মাঙ্গা + ১টি ই-বুক, প্রতিটিতে ২টি অধ্যায়) বসায় বা মুছে দেয়।
// ডেমো প্রোডাক্টের আইডি demo_manga / demo_ebook, নামের আগে "Demo", তাই আসল ডাটার সাথে মিশবে না।
//
// মোবাইল থেকে (কমান্ড ছাড়া): Render Environment-এ SEED_DEMO=1 দিয়ে ডিপ্লয় করুন -> ডেমো বসবে।
// পরীক্ষা শেষে SEED_DEMO=remove দিয়ে ডিপ্লয় করুন -> ডেমো মুছবে, তারপর SEED_DEMO ভ্যারিয়েবলটি মুছে দিন।
// লোকালে: node server/scripts/seed.js seed | remove

import { db, FieldValue } from '../firebaseAdmin.js';
import { invalidateCatalog } from '../utils/cache.js';

const DEMO = [
  {
    id: 'demo_manga',
    type: 'manga',
    slug: 'demo-manga',
    category: 'action',
    priceBDT: 300,
    priceUSD: 5,
    discount: { percent: 20, start: null, end: null },
    i18n: {
      bn: {
        title: 'ডেমো মাঙ্গা',
        headline: 'পরীক্ষার জন্য নমুনা মাঙ্গা',
        caption: 'এটি শুধু সাইট পরীক্ষার ডেমো, আসল প্রোডাক্ট নয়।',
        description: 'এই মাঙ্গাটি শুধু সিস্টেম ঠিকমতো চলছে কিনা দেখার জন্য বানানো।',
        bullets: ['২টি অধ্যায়', 'নমুনা ছবি'],
        toc: ['অধ্যায় ১', 'অধ্যায় ২'],
      },
      en: {
        title: 'Demo Manga',
        headline: 'A sample manga for testing',
        caption: 'This is a test demo, not a real product.',
        description: 'This manga exists only to check that the system works.',
        bullets: ['2 chapters', 'Sample images'],
        toc: ['Chapter 1', 'Chapter 2'],
      },
    },
    chapters: [
      { id: 'demo_m1', number: 1, title: { bn: 'অধ্যায় ১', en: 'Chapter 1' }, pages: [1, 2, 3].map((n) => `https://placehold.co/800x1200/png?text=Demo+Manga+Ch1+P${n}`) },
      { id: 'demo_m2', number: 2, title: { bn: 'অধ্যায় ২', en: 'Chapter 2' }, pages: [1, 2].map((n) => `https://placehold.co/800x1200/png?text=Demo+Manga+Ch2+P${n}`) },
    ],
  },
  {
    id: 'demo_ebook',
    type: 'ebook',
    slug: 'demo-ebook',
    category: 'dark-psychology',
    priceBDT: 250,
    priceUSD: 4,
    discount: null,
    textLangs: ['bn', 'en'],
    i18n: {
      bn: {
        title: 'ডেমো ই-বুক',
        headline: 'পরীক্ষার জন্য নমুনা ই-বুক',
        caption: 'এটি শুধু সাইট পরীক্ষার ডেমো, আসল বই নয়।',
        description: 'এই ই-বুকটি শুধু রিডার ও কেনার প্রক্রিয়া পরীক্ষার জন্য।',
        bullets: ['২টি অধ্যায়', 'নমুনা লেখা'],
        toc: ['প্রথম অধ্যায়', 'দ্বিতীয় অধ্যায়'],
      },
      en: {
        title: 'Demo Ebook',
        headline: 'A sample ebook for testing',
        caption: 'This is a test demo, not a real book.',
        description: 'This ebook exists only to test the reader and the buying flow.',
        bullets: ['2 chapters', 'Sample text'],
        toc: ['First chapter', 'Second chapter'],
      },
    },
    chapters: [
      {
        id: 'demo_e1',
        number: 1,
        title: { bn: 'প্রথম অধ্যায়', en: 'First chapter' },
        texts: {
          bn: ['এটি ডেমো ই-বুকের প্রথম পেজ। এখানে শুধু নমুনা লেখা আছে।\n\nদ্বিতীয় অনুচ্ছেদ এখানে।', 'এটি প্রথম অধ্যায়ের দ্বিতীয় পেজ।'],
          en: ['This is the first page of the demo ebook. It only has sample text.\n\nThe second paragraph is here.', 'This is the second page of the first chapter.'],
        },
      },
      {
        id: 'demo_e2',
        number: 2,
        title: { bn: 'দ্বিতীয় অধ্যায়', en: 'Second chapter' },
        texts: {
          bn: ['এটি দ্বিতীয় অধ্যায়ের একমাত্র পেজ।'],
          en: ['This is the only page of the second chapter.'],
        },
      },
    ],
  },
];

const wordsOf = (arr) => (arr || []).join(' ').split(/\s+/).filter(Boolean).length;

export async function seedDemo() {
  // ক্যাটাগরি: আগে থেকে না থাকলেই বসাবে (আপনার নিজের ক্যাটাগরি মুছবে না)
  const sref = db.doc('settings/public');
  const sset = await sref.get();
  if (!sset.exists || !Array.isArray(sset.data().categories) || !sset.data().categories.length) {
    await sref.set(
      {
        categories: [
          { key: 'dark-psychology', type: 'ebook', name: { bn: 'ডার্ক সাইকোলজি', en: 'Dark Psychology' } },
          { key: 'action', type: 'manga', name: { bn: 'অ্যাকশন', en: 'Action' } },
        ],
      },
      { merge: true }
    );
  }

  for (const d of DEMO) {
    const pref = db.doc('products/' + d.id);
    const index = d.chapters.map((c) => ({
      id: c.id,
      number: c.number,
      title: c.title,
      pageCount: c.pages ? c.pages.length : Math.max(...Object.values(c.texts).map((a) => a.length)),
    }));
    const pageCount = index.reduce((n, c) => n + c.pageCount, 0);
    const wordCount = d.type === 'ebook' ? d.chapters.reduce((n, c) => n + wordsOf(c.texts.bn), 0) : 0;

    await pref.set({
      type: d.type,
      slug: d.slug,
      status: 'published',
      coverUrl: `https://placehold.co/600x900/png?text=${encodeURIComponent(d.i18n.en.title)}`,
      category: d.category,
      featured: true,
      sortOrder: 1,
      priceBDT: d.priceBDT,
      priceUSD: d.priceUSD,
      discount: d.discount,
      i18n: d.i18n,
      textLangs: d.textLangs || ['bn', 'en'],
      formats: d.type === 'ebook' ? ['pdf', 'epub'] : [],
      chapterIndex: index,
      chapterCount: index.length,
      pageCount,
      wordCount,
      stats: { sold: 0, likes: 0, dislikes: 0 },
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    for (const c of d.chapters) {
      const doc = { number: c.number, title: c.title, updatedAt: FieldValue.serverTimestamp() };
      if (c.pages) {
        doc.pages = c.pages;
        doc.pageCount = c.pages.length;
      } else {
        doc.texts = c.texts;
        doc.pageCount = Math.max(...Object.values(c.texts).map((a) => a.length));
      }
      await pref.collection('chapters').doc(c.id).set(doc);
    }
  }
  invalidateCatalog();
  console.log('[seed] ডেমো ডাটা বসেছে: demo-manga, demo-ebook');
}

export async function removeDemo() {
  for (const d of DEMO) {
    const pref = db.doc('products/' + d.id);
    for (const c of d.chapters) await pref.collection('chapters').doc(c.id).delete();
    const reactions = await pref.collection('reactions').get();
    for (const r of reactions.docs) await r.ref.delete();
    await pref.delete();
  }
  invalidateCatalog();
  console.log('[seed] ডেমো ডাটা মুছে গেছে');
}

// admin.js সার্ভার চালুর সময় ডাকে: SEED_DEMO=1 -> বসাও, SEED_DEMO=remove -> মোছো
export async function bootSeed() {
  const v = String(process.env.SEED_DEMO || '').trim().toLowerCase();
  if (v === 'remove') return removeDemo();
  if (v === '1' || v === 'true' || v === 'seed') return seedDemo();
}

// সরাসরি চালালে: node server/scripts/seed.js seed | remove
if (process.argv[1] && /seed\.js$/.test(process.argv[1])) {
  await import('dotenv/config');
  const cmd = process.argv[2] || 'seed';
  try {
    if (cmd === 'remove') await removeDemo();
    else await seedDemo();
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
          }
