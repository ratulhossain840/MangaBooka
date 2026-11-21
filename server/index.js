// MangaBooka সার্ভারের মূল ফাইল
import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { db, adminCount } from './firebaseAdmin.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'client', 'dist');
const PORT = process.env.PORT || 3000;

const app = express();
app.set('trust proxy', 1); // Render প্রক্সির পেছনে আছে
app.disable('x-powered-by');

app.use(
  helmet({
    contentSecurityPolicy: false, // পরে ব্যাচ ২০-তে কড়া করা হবে
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginEmbedderPolicy: false,
  })
);
app.use(compression());

const origins = (process.env.CLIENT_ORIGIN || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
app.use(cors({ origin: origins.length ? origins : false }));

app.use(express.json({ limit: '5mb' }));

// সব API-তে সাধারণ গতিসীমা (স্প্যাম আটকাতে)
app.use(
  '/api',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 600,
    standardHeaders: true,
    legacyHeaders: false,
    message: { ok: false, error: 'too_many_requests' },
  })
);

// ---- স্বাস্থ্য পরীক্ষা (UptimeRobot এখানে পিং করবে, ডাটাবেস পড়ে না) ----
app.get('/api/health', (req, res) => {
  res.json({ ok: true, app: 'MangaBooka', time: new Date().toISOString() });
});

// ---- ডাটাবেস সংযোগ পরীক্ষা (হাতে একবার খুলে দেখার জন্য) ----
app.get('/api/health/db', async (req, res, next) => {
  try {
    await db.doc('settings/public').get();
    res.json({ ok: true, database: 'connected', adminsConfigured: adminCount() });
  } catch (err) {
    next(err);
  }
});

// ---- রাউট ফাইল: যেটা তৈরি আছে সেটাই চালু হবে (পরের ব্যাচে একটি একটি করে আসবে) ----
const routes = [
  ['/api/catalog', 'catalog.js'],
  ['/api/orders', 'orders.js'],
  ['/api/content', 'content.js'],
  ['/api/support', 'support.js'],
  ['/api/analytics', 'analytics.js'],
  ['/api/translate', 'translate.js'],
  ['/api/admin', 'admin.js'],
  ['/p', 'share.js'], // প্রোডাক্ট শেয়ার লিংক
  ['/', 'sitemap.js'], // sitemap.xml ও robots.txt
];

async function mount(urlPath, file) {
  const full = path.join(__dirname, 'routes', file);
  if (!fs.existsSync(full)) {
    console.log(`[routes] এখনো নেই: ${file}`);
    return;
  }
  const mod = await import(pathToFileURL(full).href);
  app.use(urlPath, mod.default);
  console.log(`[routes] চালু: ${urlPath} -> ${file}`);
}
for (const [urlPath, file] of routes) await mount(urlPath, file);

// অজানা API
app.use('/api', (req, res) => res.status(404).json({ ok: false, error: 'not_found' }));

// ---- ফ্রন্টএন্ড (React build) ----
if (fs.existsSync(DIST)) {
  app.use(
    express.static(DIST, {
      index: false,
      setHeaders(res, filePath) {
        if (/[\\/]assets[\\/]/.test(filePath)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        } else if (/[\\/]icons[\\/]/.test(filePath)) {
          res.setHeader('Cache-Control', 'public, max-age=86400');
        } else {
          res.setHeader('Cache-Control', 'no-cache'); // index.html, sw.js, manifest
        }
      },
    })
  );

  const sendPage = (file) => (req, res, next) => {
    if (path.extname(req.path)) return next(); // ফাইল না পেলে 404
    res.sendFile(path.join(DIST, file));
  };
  app.get(/^\/admin(\/.*)?$/, sendPage('admin/index.html'));
  app.get(/^\/(?!api\/).*/, sendPage('index.html'));
} else {
  app.get('/', (req, res) => {
    res.send('MangaBooka সার্ভার চালু আছে। ফ্রন্টএন্ড এখনো বিল্ড হয়নি।');
  });
}

app.use((req, res) => res.status(404).send('Not found'));

// ---- ত্রুটি সামলানো ----
app.use((err, req, res, next) => {
  console.error('[error]', err);
  const status = err.status && err.status < 600 ? err.status : 500;
  res.status(status).json({
    ok: false,
    error: status === 500 ? 'server_error' : err.message || 'error',
  });
});

process.on('unhandledRejection', (e) => console.error('[unhandledRejection]', e));

if (!adminCount()) console.warn('[warn] ADMIN_UIDS সেট নেই, অ্যাডমিন প্যানেলে কেউ ঢুকতে পারবে না');

app.listen(PORT, () => console.log(`MangaBooka server চালু: পোর্ট ${PORT}`));
