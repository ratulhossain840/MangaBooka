// FILE: index.js
// PATH: client/src/i18n/index.js (রিপোতে client/src/i18n ফোল্ডারের ভেতরে)
// কাজ: ৬ ভাষার অনুবাদ (bn, en, ja, zh, ms, es), t('কী'), ভাষা বদল, টাকা/সংখ্যা/তারিখের ফরম্যাট, ত্রুটির বার্তা।
// bn ও en সবসময় সাথে থাকে; ja, zh, ms, es দরকার হলে আলাদা ফাইল হিসেবে নামে (ব্যাচ ৭-এ আসবে, না থাকলে en/bn দেখায়)।
// কোনো কী না পেলে ক্রম: বর্তমান ভাষা -> en -> bn -> কী-র নামটাই।
//
// ব্যবহার (React): const { t, lang, setLang } = useI18n();   t('cart.title')   t('card.sold', { n: 50 })
// JSON-এ "{n}" জায়গায় মান বসে। তালিকা বা অবজেক্ট (যেমন pages.faq.items) t() সরাসরি ফেরত দেয়।

import { useSyncExternalStore } from 'react';
import bn from './bn.json';
import en from './en.json';

export const LANGS = ['bn', 'en', 'ja', 'zh', 'ms', 'es'];
export const LANG_NAMES = { bn: 'বাংলা', en: 'English', ja: '日本語', zh: '中文', ms: 'Bahasa Melayu', es: 'Español' };
const LOCALES = { bn: 'bn-BD', en: 'en-US', ja: 'ja-JP', zh: 'zh-CN', ms: 'ms-MY', es: 'es-CL' };
const KEY = 'mb_lang';

// ব্যাচ ৭-এর ভাষা ফাইল: থাকলে দরকারের সময় নামবে, না থাকলে খালি (বিল্ড ভাঙে না)
const loaders = import.meta.glob(['./ja.json', './zh.json', './ms.json', './es.json']);
const dicts = { bn, en };

// ---------- শুরুর ভাষা ঠিক করা ----------
function detectLang() {
  try {
    const stored = window.localStorage.getItem(KEY);
    if (LANGS.includes(stored)) return stored;
    const q = new URLSearchParams(window.location.search).get('lang');
    if (LANGS.includes(q)) return q;
    for (const l of navigator.languages || [navigator.language]) {
      const c = String(l || '').slice(0, 2).toLowerCase();
      if (LANGS.includes(c)) return c;
    }
    // ব্রাউজারের ভাষা না মিললে সময় অঞ্চল দেখে অনুমান: ঢাকা হলে বাংলা
    if (Intl.DateTimeFormat().resolvedOptions().timeZone === 'Asia/Dhaka') return 'bn';
  } catch {
    /* ignore */
  }
  return 'en';
}

// ---------- ছোট স্টোর (React এই স্টোর শোনে) ----------
let state = { lang: detectLang() };
const listeners = new Set();
const subscribe = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
const getState = () => state;
const emit = () => {
  state = { ...state };
  listeners.forEach((f) => f());
};

export const getLang = () => state.lang;
export const onLangChange = (fn) => subscribe(() => fn(state.lang));

function applyDocLang(l) {
  try {
    document.documentElement.lang = l;
  } catch {
    /* ignore */
  }
}

async function ensureLoaded(l) {
  if (dicts[l]) return true;
  const load = loaders[`./${l}.json`];
  if (!load) return false;
  try {
    const m = await load();
    dicts[l] = m.default || m;
    return true;
  } catch {
    return false;
  }
}

export async function setLang(l) {
  if (!LANGS.includes(l)) return;
  await ensureLoaded(l); // না নামলেও চলবে, en/bn দিয়ে ঢাকা পড়বে
  try {
    window.localStorage.setItem(KEY, l);
  } catch {
    /* ignore */
  }
  applyDocLang(l);
  state = { lang: l };
  emit();
}

// অ্যাপ চালুর সময়: ভাষা নামিয়ে নেয় (bn/en হলে সাথে সাথে)
applyDocLang(state.lang);
ensureLoaded(state.lang).then(emit);

// ---------- অনুবাদ ----------
function lookup(dict, key) {
  let v = dict;
  for (const part of key.split('.')) {
    if (v == null || typeof v !== 'object') return undefined;
    v = v[part];
  }
  return v;
}

function fill(str, params) {
  if (!params) return str;
  return str.replace(/\{(\w+)\}/g, (m, k) => (params[k] !== undefined && params[k] !== null ? String(params[k]) : m));
}

export function t(key, params) {
  for (const l of [state.lang, 'en', 'bn']) {
    const d = dicts[l];
    if (!d) continue;
    const v = lookup(d, key);
    if (v !== undefined) return typeof v === 'string' ? fill(v, params) : v;
  }
  return key;
}

// ---------- ফরম্যাট (বর্তমান ভাষার নিয়মে) ----------
const locale = () => LOCALES[state.lang] || 'en-US';

export function fmtNumber(n) {
  try {
    return new Intl.NumberFormat(locale()).format(Number(n) || 0);
  } catch {
    return String(n);
  }
}

// টাকা: ৳২৪০ ; ডলার: $৪ বা $4.50 (পূর্ণসংখ্যা হলে দশমিক ছাড়া)
export function fmtMoney(amount, currency) {
  const n = Number(amount) || 0;
  try {
    const whole = currency === 'BDT' || Number.isInteger(n);
    return new Intl.NumberFormat(locale(), {
      style: 'currency',
      currency,
      currencyDisplay: 'narrowSymbol',
      minimumFractionDigits: whole ? 0 : 2,
      maximumFractionDigits: currency === 'BDT' ? 0 : 2,
    }).format(n);
  } catch {
    return (currency === 'BDT' ? '৳' : '$') + n;
  }
}

export function fmtDate(ms, withTime = false) {
  if (!ms) return '';
  try {
    return new Intl.DateTimeFormat(locale(), {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
    }).format(new Date(ms));
  } catch {
    return new Date(ms).toLocaleString();
  }
}

// বাকি সময়কে { d, h, m, s } সংখ্যায় ভাঙে (অফারের কাউন্টডাউনের জন্য)
export function splitDuration(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return {
    d: Math.floor(total / 86400),
    h: Math.floor((total % 86400) / 3600),
    m: Math.floor((total % 3600) / 60),
    s: total % 60,
  };
}

// ---------- ত্রুটির বার্তা (ApiError বা সাধারণ ত্রুটি থেকে) ----------
// সার্ভারের কোড জানা থাকলে অনূদিত বার্তা; নেটওয়ার্ক/টাইমআউট আলাদা; বাংলায় থাকলে সার্ভারের নিজের বাংলা বার্তা
// (যেমন "এই TrxID/TXID আগেই ব্যবহার হয়েছে"); নইলে সাধারণ বার্তা।
export function errMsg(err) {
  if (!err) return t('errors.generic');
  const code = err.code || '';
  if (code === 'network') return t('errors.network');
  if (code === 'timeout') return t('errors.timeout');
  const known = lookup(dicts.en, `errors.codes.${code}`);
  if (code && known !== undefined) return t(`errors.codes.${code}`);
  if (state.lang === 'bn' && err.status >= 400 && err.status < 500 && typeof err.message === 'string' && /[ঀ-৿]/.test(err.message)) {
    return err.message;
  }
  if (err.status === 404) return t('errors.notFound');
  if (err.status >= 500) return t('errors.codes.server_error');
  return t('errors.generic');
}

// ---------- React হুক ----------
// ভাষা বদলালে যে কম্পোনেন্ট এটা ব্যবহার করে সেটা নিজে নতুন করে আঁকা হয়
export function useI18n() {
  const s = useSyncExternalStore(subscribe, getState);
  return {
    lang: s.lang,
    t,
    setLang,
    languages: LANGS.map((code) => ({ code, name: LANG_NAMES[code] })),
    fmtMoney,
    fmtNumber,
    fmtDate,
    errMsg,
  };
  }
