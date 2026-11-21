// FILE: share.js
// PATH: server/routes/share.js (রিপোতে server/routes ফোল্ডারের ভেতরে)
// কাজ: প্রতিটি প্রোডাক্টের শেয়ার লিংক  yoursite.com/p/<slug>
// ফেসবুক/WhatsApp/Telegram-এর ক্রলার জাভাস্ক্রিপ্ট চালায় না, তাই এখানে সার্ভার কভার, নাম ও বিবরণ
// (Open Graph মেটা ট্যাগ) বসিয়ে তারপর React অ্যাপ (client/dist/index.html) পাঠায়।
// UTM (?utm_source=...) লিংকে থাকলে React অ্যাপ নিজে পড়ে নেবে। এখানে কোনো Firestore রাইট নেই।
//
// দ্রষ্টব্য (ব্যাচ ৫-এ client/index.html এ মানতে হবে): <title>, description, og:*, twitter:* ট্যাগ
// লেখার সময় property/name আগে লিখতে হবে (যেমন <meta property="og:title" content="...">),
// তাহলে এই ফাইল ওগুলো সরিয়ে প্রোডাক্টের ট্যাগ বসাতে পারবে।

import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { withContext, asyncHandler } from '../middleware/auth.js';
import { getCatalog, getSettings } from '../utils/cache.js';
import { toDetail } from '../utils/pricing.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INDEX_FILE = path.resolve(__dirname, '../../client/dist/index.html');
const SITE_NAME = 'MangaBooka';
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,99}$/i;
const OG_LOCALE = { bn: 'bn_BD', en: 'en_US', ja: 'ja_JP', zh: 'zh_CN', ms: 'ms_MY', es: 'es_CL' };

const router = Router();
router.use(withContext);

let indexCache = null;
function readIndex() {
  if (indexCache) return indexCache;
  if (!fs.existsSync(INDEX_FILE)) return null;
  indexCache = fs.readFileSync(INDEX_FILE, 'utf8');
  return indexCache;
}

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const clip = (s, n) => {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  return t.length > n ? t.slice(0, n - 1) + '…' : t;
};

// index.html থেকে পুরনো title/description/og/twitter/canonical সরানো
function stripHead(html) {
  return html
    .replace(/<title>[\s\S]*?<\/title>/i, '')
    .replace(/<meta\s+(?:property|name)=["'](?:og:[^"']*|twitter:[^"']*|description)["'][^>]*>/gi, '')
    .replace(/<link\s+rel=["']canonical["'][^>]*>/gi, '');
}

function buildTags({ title, description, image, url, locale, jsonLd }) {
  const tags = [
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(description)}">`,
    `<link rel="canonical" href="${esc(url)}">`,
    `<meta property="og:type" content="product">`,
    `<meta property="og:site_name" content="${SITE_NAME}">`,
    `<meta property="og:title" content="${esc(title)}">`,
    `<meta property="og:description" content="${esc(description)}">`,
    `<meta property="og:image" content="${esc(image)}">`,
    `<meta property="og:url" content="${esc(url)}">`,
    `<meta property="og:locale" content="${esc(locale)}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${esc(title)}">`,
    `<meta name="twitter:description" content="${esc(description)}">`,
    `<meta name="twitter:image" content="${esc(image)}">`,
  ];
  if (jsonLd) {
    const json = JSON.stringify(jsonLd).replace(/</g, '\\u003c');
    tags.push(`<script type="application/ld+json">${json}</script>`);
  }
  return tags.join('\n    ');
}

function page(html, tags) {
  if (html) {
    const cleaned = stripHead(html);
    return cleaned.includes('</head>') ? cleaned.replace('</head>', `    ${tags}\n  </head>`) : tags + cleaned;
  }
  // ফ্রন্টএন্ড এখনো বিল্ড না হলে সাধারণ পেজ
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${tags}</head><body><p>${SITE_NAME}</p></body></html>`;
}

router.get(
  '/:slug',
  asyncHandler(async (req, res) => {
    const slug = String(req.params.slug || '').toLowerCase();
    const siteUrl = (process.env.SITE_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
    const html = readIndex();

    res.set('Cache-Control', 'no-cache');
    res.type('html');

    let product = null;
    if (SLUG_RE.test(slug)) {
      const [catalog, settings] = await Promise.all([getCatalog(), getSettings()]);
      const p = catalog.bySlug.get(slug);
      if (p) product = toDetail(p, req.ctx, settings, Date.now());
    }

    // প্রোডাক্ট না পেলে সাধারণ মেটা সহ অ্যাপ পাঠানো (404 স্ট্যাটাস, যাতে সার্চ ইঞ্জিন জমা না রাখে)
    if (!product) {
      const tags = buildTags({
        title: SITE_NAME,
        description: 'Manga & ebooks',
        image: `${siteUrl}/icons/og-image.png`,
        url: siteUrl,
        locale: OG_LOCALE[req.ctx.lang] || 'en_US',
      });
      return res.status(404).send(page(html, tags));
    }

    const url = `${siteUrl}/p/${product.slug}`;
    const image = /^https:\/\//i.test(product.coverUrl) ? product.coverUrl : `${siteUrl}/icons/og-image.png`;
    const description = clip(product.caption || product.headline || product.description, 200);
    const title = `${product.title} | ${SITE_NAME}`;

    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: product.title,
      description,
      image,
      url,
      offers: {
        '@type': 'Offer',
        price: product.price.final,
        priceCurrency: product.price.currency,
        availability: 'https://schema.org/InStock',
        url,
      },
    };

    const tags = buildTags({
      title,
      description,
      image,
      url,
      locale: OG_LOCALE[req.ctx.lang] || 'en_US',
      jsonLd,
    });
    res.send(page(html, tags));
  })
);

export default router;
