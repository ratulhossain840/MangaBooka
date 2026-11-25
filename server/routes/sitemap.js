// FILE: sitemap.js
// PATH: server/routes/sitemap.js (রিপোতে server/routes ফোল্ডারের ভেতরে)
// কাজ: /sitemap.xml (হোম, শপ, সব প্রকাশিত প্রোডাক্ট /p/slug, তথ্যের পেজ) ও /robots.txt (/admin, /api সার্চ ইঞ্জিনে বন্ধ)।
// SITE_URL (Render Environment) থেকে ঠিকানা নেয়; না থাকলে রিকোয়েস্টের হোস্ট।
// index.js এ '/' এ বসে; অন্য কোনো পথে হাত দেয় না।

import { Router } from 'express';
import { asyncHandler } from '../middleware/auth.js';
import { getCatalog } from '../utils/cache.js';

const router = Router();
const STATIC_PATHS = ['/', '/manga', '/ebook', '/how-to', '/about', '/faq', '/contact', '/terms', '/privacy', '/refund'];

const site = (req) => (process.env.SITE_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const ms = (t) => (t && typeof t.toMillis === 'function' ? t.toMillis() : null);

router.get('/robots.txt', (req, res) => {
  res.type('text/plain').set('Cache-Control', 'public, max-age=3600').send(
    ['User-agent: *', 'Allow: /', 'Disallow: /admin', 'Disallow: /api/', 'Disallow: /cart', 'Disallow: /checkout', 'Disallow: /order-success', 'Disallow: /orders', 'Disallow: /library', 'Disallow: /read/', '', `Sitemap: ${site(req)}/sitemap.xml`, ''].join('\n')
  );
});

router.get(
  '/sitemap.xml',
  asyncHandler(async (req, res) => {
    const base = site(req);
    const { list } = await getCatalog();
    const urls = STATIC_PATHS.map((p) => `<url><loc>${esc(base + p)}</loc><changefreq>${p === '/' ? 'daily' : 'weekly'}</changefreq></url>`);
    for (const p of list) {
      if (!p.slug) continue;
      const t = ms(p.updatedAt);
      urls.push(`<url><loc>${esc(base + '/p/' + p.slug)}</loc>${t ? `<lastmod>${new Date(t).toISOString().slice(0, 10)}</lastmod>` : ''}<changefreq>weekly</changefreq></url>`);
    }
    res
      .type('application/xml')
      .set('Cache-Control', 'public, max-age=3600')
      .send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`);
  })
);

export default router;
