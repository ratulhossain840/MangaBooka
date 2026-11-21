// FILE: checkEnv.js
// PATH: server/scripts/checkEnv.js
// কাজ: গোপন সেটিং (Render Environment) ঠিক আছে কিনা দেখে। মান কখনো প্রিন্ট করে না, শুধু ঠিক/ভুল বলে।
// সার্ভার চালুর সময় নিজে Render Logs-এ রিপোর্ট দেয় (admin.js ডাকে); অ্যাডমিন লগইনে GET /api/admin/env-check ও আছে।
// লোকালে: node server/scripts/checkEnv.js

const has = (k) => !!(process.env[k] || '').trim();
const val = (k) => (process.env[k] || '').trim();

export function checkEnv({ log = false } = {}) {
  const items = [];
  const add = (level, name, msg) => items.push({ level, name, msg });

  // সাইট
  if (!has('SITE_URL')) add('warn', 'SITE_URL', 'নেই (শেয়ার লিংক ও sitemap-এ লাগবে)');
  else if (!/^https:\/\//.test(val('SITE_URL')) || /\/$/.test(val('SITE_URL'))) add('warn', 'SITE_URL', 'https:// দিয়ে শুরু ও শেষে / ছাড়া হতে হবে');
  else add('ok', 'SITE_URL', 'ঠিক আছে');

  // Firebase
  if (!has('FIREBASE_SERVICE_ACCOUNT')) {
    add('error', 'FIREBASE_SERVICE_ACCOUNT', 'নেই');
  } else {
    try {
      const raw = val('FIREBASE_SERVICE_ACCOUNT');
      const text = raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
      const j = JSON.parse(text);
      const miss = ['project_id', 'client_email', 'private_key'].filter((k) => !j[k]);
      if (miss.length) add('error', 'FIREBASE_SERVICE_ACCOUNT', `JSON-এ নেই: ${miss.join(', ')}`);
      else add('ok', 'FIREBASE_SERVICE_ACCOUNT', 'ঠিক আছে');
    } catch {
      add('error', 'FIREBASE_SERVICE_ACCOUNT', 'পড়া যাচ্ছে না (base64 ঠিক আছে কিনা দেখুন)');
    }
  }
  const admins = val('ADMIN_UIDS').split(',').map((s) => s.trim()).filter(Boolean);
  if (!admins.length) add('error', 'ADMIN_UIDS', 'নেই, অ্যাডমিন প্যানেলে কেউ ঢুকতে পারবে না');
  else add('ok', 'ADMIN_UIDS', `${admins.length}টি অ্যাডমিন UID`);

  // Gemini
  const keys = val('GEMINI_KEYS').split(',').map((s) => s.trim()).filter(Boolean);
  if (!keys.length) add('warn', 'GEMINI_KEYS', 'নেই, অটো অনুবাদ চলবে না');
  else if (new Set(keys).size !== keys.length) add('warn', 'GEMINI_KEYS', 'একই কী একাধিকবার আছে');
  else if (keys.length < 3) add('warn', 'GEMINI_KEYS', `${keys.length}টি কী আছে (৩টি রাখার কথা)`);
  else add('ok', 'GEMINI_KEYS', `${keys.length}টি কী`);
  if (!has('GEMINI_MODEL')) add('warn', 'GEMINI_MODEL', 'নেই, ডিফল্ট gemini-2.5-flash ব্যবহার হবে');
  else add('ok', 'GEMINI_MODEL', 'আছে');

  if (!has('IMGBB_KEY')) add('warn', 'IMGBB_KEY', 'নেই, অ্যাডমিন থেকে ছবি আপলোড চলবে না');
  else add('ok', 'IMGBB_KEY', 'আছে');

  // পেমেন্ট: বাংলাদেশ
  for (const k of ['PAY_BKASH', 'PAY_NAGAD']) {
    if (!has(k)) add('warn', k, 'নেই');
    else if (!/^(\+?88)?01[3-9]\d{8}$/.test(val(k).replace(/[\s-]/g, ''))) add('warn', k, 'নম্বরের ফরম্যাট সন্দেহজনক (০১XXXXXXXXX হতে হবে)');
    else add('ok', k, 'ঠিক আছে');
  }
  // পেমেন্ট: USDT (BEP20 ও ERC20 দুটোরই ঠিকানা 0x + ৪০ হেক্স)
  for (const k of ['USDT_BEP20_ADDRESS', 'USDT_ERC20_ADDRESS']) {
    if (!has(k)) add('warn', k, 'নেই');
    else if (!/^0x[a-fA-F0-9]{40}$/.test(val(k))) add('error', k, 'ঠিকানা ভুল (0x দিয়ে শুরু, মোট ৪২ অক্ষর হতে হবে)');
    else add('ok', k, 'ঠিক আছে');
  }

  // ফ্রন্টএন্ড বিল্ডের সময় লাগে
  const vite = ['VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_AUTH_DOMAIN', 'VITE_FIREBASE_PROJECT_ID', 'VITE_FIREBASE_APP_ID'].filter((k) => !has(k));
  if (vite.length) add('warn', 'VITE_FIREBASE_*', `নেই: ${vite.join(', ')} (ফ্রন্টএন্ড বিল্ডে লাগবে)`);
  else add('ok', 'VITE_FIREBASE_*', 'সব আছে');

  const ok = !items.some((i) => i.level === 'error');
  if (log) {
    const icon = { ok: '✔', warn: '⚠', error: '✖' };
    console.log('[env] পরিবেশ ভ্যারিয়েবল পরীক্ষা:');
    for (const i of items) console.log(`[env] ${icon[i.level]} ${i.name}: ${i.msg}`);
  }
  return { ok, items };
}

// সরাসরি চালালে: node server/scripts/checkEnv.js
if (process.argv[1] && /checkEnv\.js$/.test(process.argv[1])) {
  await import('dotenv/config');
  const r = checkEnv({ log: true });
  process.exit(r.ok ? 0 : 1);
           }
