// FILE: pricing.js
// PATH: server/utils/pricing.js (রিপোতে server/utils ফোল্ডারের ভেতরে)
// কাজ: দাম, ছাড়, বাজার (টাকা/ডলার), ভাষা বাছাই, ক্রেতাকে দেখানো প্রোডাক্টের চেহারা

// ---------- ধ্রুবক ----------
export const LANGS = ['bn', 'en', 'ja', 'zh', 'ms', 'es'];
export const LANG_NAMES = {
  bn: 'বাংলা',
  en: 'English',
  ja: '日本語',
  zh: '中文',
  ms: 'Bahasa Melayu',
  es: 'Español',
};
export const SUPPORTED_COUNTRIES = ['BD', 'JP', 'CN', 'SG', 'MY', 'CL'];
export const DEFAULT_LANG_BY_COUNTRY = { BD: 'bn', JP: 'ja', CN: 'zh', SG: 'en', MY: 'ms', CL: 'es' };

// ছাড়ের নিয়ম (অ্যাডমিন সেটিংসে বদলানো যাবে, না দিলে এই মান)
export const RULES = {
  minDiscountBDT: 200, // ৳২০০ এর নিচে ছাড় নেই
  minDiscountUSD: 4, // $৪ এর নিচে ছাড় নেই
  minPayableUSD: 3, // ছাড়ের পরেও ডলার দাম $৩ এর নিচে নামবে না (USDT ন্যূনতম পাঠানো)
};

// আসল বিক্রির ধাপ (ভুয়া সংখ্যা নয়, শুধু আসল বিক্রি এই ধাপ পার হলে দেখাবে)
export const SALES_TIERS = [5, 10, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 50000, 100000];

export const rulesOf = (settings = {}) => ({
  minDiscountBDT: Number(settings.minDiscountBDT ?? RULES.minDiscountBDT),
  minDiscountUSD: Number(settings.minDiscountUSD ?? RULES.minDiscountUSD),
  minPayableUSD: Number(settings.minPayableUSD ?? RULES.minPayableUSD),
});

// ---------- বাজার ----------
// দেশ = বাংলাদেশ এবং ভাষা = বাংলা বা English হলে BD (টাকা), নাহলে INT (ডলার)
export const marketFor = (country, lang) =>
  country === 'BD' && (lang === 'bn' || lang === 'en') ? 'BD' : 'INT';
export const currencyOf = (market) => (market === 'BD' ? 'BDT' : 'USD');

// ---------- ছোট সহায়ক ----------
export function toMillis(v) {
  if (!v) return null;
  if (typeof v === 'number') return v;
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (v instanceof Date) return v.getTime();
  if (typeof v === 'object' && typeof v._seconds === 'number') return v._seconds * 1000;
  const t = Date.parse(v);
  return Number.isFinite(t) ? t : null;
}
const round2 = (n) => Math.round(n * 100) / 100;
const num = (v) => (v === '' || v === null || v === undefined ? NaN : Number(v));

// ভাষা অনুযায়ী লেখা বাছা: চাওয়া ভাষা -> English -> বাংলা -> যা আছে
export function pickText(map, lang) {
  if (!map) return '';
  if (typeof map === 'string') return map;
  return map[lang] || map.en || map.bn || Object.values(map).find(Boolean) || '';
}

export function localize(product, lang) {
  const i = product.i18n || {};
  const order = [lang, 'en', 'bn', ...Object.keys(i)];
  const hit = order.find((l) => i[l] && i[l].title);
  const t = (hit && i[hit]) || {};
  return {
    lang: hit || null,
    ready: hit === lang, // চাওয়া ভাষায় অনুবাদ তৈরি আছে কিনা
    title: t.title || '',
    headline: t.headline || '',
    caption: t.caption || '',
    description: t.description || '',
    bullets: Array.isArray(t.bullets) ? t.bullets : [],
    toc: Array.isArray(t.toc) ? t.toc : [],
  };
}

// আসল বিক্রি ধাপ অনুযায়ী দেখানোর সংখ্যা। ন্যূনতম সীমার নিচে হলে null (কিছুই দেখাবে না)
export function salesTier(sold, minToShow = 5) {
  const s = Number(sold) || 0;
  if (s < minToShow) return null;
  let tier = null;
  for (const t of SALES_TIERS) if (s >= t && t >= minToShow) tier = t;
  return tier;
}

// ---------- দাম ও ছাড় ----------
// ফেরত: { currency, base, final, percentOff, onSale, endsAt } অথবা null (এই বাজারে দাম নেই)
export function computePrice(product, market, now = Date.now(), rules = RULES) {
  const currency = currencyOf(market);
  const base = num(market === 'BD' ? product.priceBDT : product.priceUSD);
  if (!Number.isFinite(base) || base <= 0) return null;

  const out = { currency, base, final: base, percentOff: 0, onSale: false, endsAt: null };
  const d = product.discount;
  if (!d) return out;

  const start = toMillis(d.start);
  const end = toMillis(d.end);
  if (start && now < start) return out;
  if (end && now > end) return out;

  const min = market === 'BD' ? rules.minDiscountBDT : rules.minDiscountUSD;
  if (base < min) return out; // ছোট দামে ছাড় নেই

  let final = null;
  const fixed = num(market === 'BD' ? d.fixedBDT : d.fixedUSD);
  if (Number.isFinite(fixed) && fixed > 0) {
    final = fixed;
  } else {
    const p = num(d.percent);
    if (Number.isFinite(p) && p > 0 && p < 100) final = base * (1 - p / 100);
  }
  if (final === null) return out;

  final = market === 'BD' ? Math.round(final) : round2(final);
  if (market !== 'BD') final = Math.max(final, rules.minPayableUSD);
  if (final >= base) return out; // সীমার কারণে ছাড় বাকি না থাকলে ছাড় নেই

  out.final = final;
  out.percentOff = Math.max(1, Math.round((1 - final / base) * 100));
  out.onSale = true;
  out.endsAt = end ? new Date(end).toISOString() : null;
  return out;
}

// অ্যাডমিন ছাড় সেভ করার আগে যাচাই (ত্রুটি হলে সেভ হবে না, সতর্কতা হলে বলে দেবে)
export function checkDiscount(product, rules = RULES) {
  const errors = [];
  const warnings = [];
  const d = product.discount;
  if (!d) return { errors, warnings };

  const p = num(d.percent);
  const fBDT = num(d.fixedBDT);
  const fUSD = num(d.fixedUSD);
  const hasP = Number.isFinite(p);
  const hasFB = Number.isFinite(fBDT);
  const hasFU = Number.isFinite(fUSD);
  if (!hasP && !hasFB && !hasFU) errors.push('ছাড়ের শতাংশ বা অফার দাম অন্তত একটি দিন।');
  if (hasP && (p <= 0 || p >= 100)) errors.push('ছাড়ের শতাংশ ১ থেকে ৯৯ এর মধ্যে হতে হবে।');

  const s = toMillis(d.start);
  const e = toMillis(d.end);
  if (s && e && e <= s) errors.push('শেষের তারিখ শুরুর তারিখের পরে হতে হবে।');

  const bdt = num(product.priceBDT);
  const usd = num(product.priceUSD);
  if (Number.isFinite(bdt) && bdt < rules.minDiscountBDT)
    warnings.push(`টাকার দাম ৳${rules.minDiscountBDT} এর নিচে, তাই বাংলাদেশে ছাড় দেখাবে না।`);
  if (Number.isFinite(usd) && usd < rules.minDiscountUSD)
    warnings.push(`ডলারের দাম $${rules.minDiscountUSD} এর নিচে, তাই বিদেশে ছাড় দেখাবে না।`);
  if (hasFB && Number.isFinite(bdt) && fBDT >= bdt) errors.push('টাকার অফার দাম আসল দামের চেয়ে কম হতে হবে।');
  if (hasFU && Number.isFinite(usd) && fUSD >= usd) errors.push('ডলারের অফার দাম আসল দামের চেয়ে কম হতে হবে।');
  if (Number.isFinite(usd) && usd >= rules.minDiscountUSD) {
    const after = hasFU ? fUSD : hasP ? usd * (1 - p / 100) : null;
    if (after !== null && after < rules.minPayableUSD)
      warnings.push(`ছাড়ের পর ডলার দাম $${rules.minPayableUSD} এর নিচে নামবে, তাই সিস্টেম দাম $${rules.minPayableUSD} এ আটকে দেবে।`);
  }
  return { errors, warnings };
}

// ---------- ক্রেতাকে দেখানো চেহারা (শুধু নিরাপদ তথ্য) ----------
const DAY = 86400000;

export function toCard(product, ctx, settings = {}, now = Date.now()) {
  const price = computePrice(product, ctx.market, now, rulesOf(settings));
  if (!price) return null; // এই বাজারে দাম না থাকলে প্রোডাক্ট দেখানো হয় না
  const L = localize(product, ctx.lang);
  const stats = product.stats || {};
  const sold = Number(stats.sold) || 0;
  const created = toMillis(product.createdAt);

  const badges = [];
  if (created && now - created < 14 * DAY) badges.push('new');
  if (price.onSale) badges.push('sale');
  if (product.featured) badges.push('featured');
  if (sold >= Number(settings.bestsellerMin ?? 50)) badges.push('bestseller');

  return {
    id: product.id,
    type: product.type,
    slug: product.slug,
    coverUrl: product.coverUrl || '',
    category: product.category || '',
    title: L.title,
    headline: L.headline,
    caption: L.caption,
    price,
    badges,
    soldTier: salesTier(sold, Number(settings.salesTierMin ?? 5)),
    likes: Math.max(0, Number(stats.likes) || 0),
    dislikes: Math.max(0, Number(stats.dislikes) || 0),
    chapterCount: Number(product.chapterCount) || (product.chapterIndex || []).length || 0,
    textReady: L.ready,
    langs: Array.isArray(product.textLangs) && product.textLangs.length ? product.textLangs : ['bn'],
  };
}

export function toDetail(product, ctx, settings = {}, now = Date.now()) {
  const card = toCard(product, ctx, settings, now);
  if (!card) return null;
  const L = localize(product, ctx.lang);
  const chapters = (product.chapterIndex || [])
    .map((c) => ({
      id: c.id,
      number: Number(c.number) || 0,
      title: pickText(c.title, ctx.lang),
      pageCount: Number(c.pageCount) || 0,
    }))
    .sort((a, b) => a.number - b.number);
  return {
    ...card,
    description: L.description,
    bullets: L.bullets,
    toc: L.toc,
    chapters,
    pageCount: Number(product.pageCount) || 0,
    wordCount: Number(product.wordCount) || 0,
    formats: Array.isArray(product.formats) ? product.formats : [],
    createdAt: toMillis(product.createdAt),
  };
}
