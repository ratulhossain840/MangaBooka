// FILE: gemini.js
// PATH: server/utils/gemini.js
// কাজ: Gemini দিয়ে লেখা অনুবাদ। ৩টি কী ঘুরিয়ে ব্যবহার, সীমা (429) হলে কী ঠান্ডা রাখা, লেখা টুকরো করে পাঠানো।
// এখানে Firebase নেই, শুধু Gemini REST API। env: GEMINI_KEYS (কমা দিয়ে), GEMINI_MODEL, TRANSLATE_GAP_MS (ঐচ্ছিক)

const API = 'https://generativelanguage.googleapis.com/v1beta/models';

export const LANG_LABEL = {
  bn: 'Bengali',
  en: 'English',
  ja: 'Japanese',
  zh: 'Simplified Chinese',
  ms: 'Malay',
  es: 'Spanish (neutral Latin American)',
};

const MAX_CHARS = 4500; // এক অনুরোধে সর্বোচ্চ কত অক্ষর পাঠানো হবে
const MAX_ITEMS = 12; // এক অনুরোধে সর্বোচ্চ কত টুকরো

const err = (message, code, status) => Object.assign(new Error(message), { code, status });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const keyList = () => [
  ...new Set(
    (process.env.GEMINI_KEYS || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  ),
];
export const keyCount = () => keyList().length;
export const modelName = () => (process.env.GEMINI_MODEL || '').trim() || 'gemini-2.5-flash';

// ---------- কী বাছাই ও ঠান্ডা রাখা ----------
const cool = new Map(); // key -> কখন পর্যন্ত বন্ধ
let rr = 0;
let lastCallAt = 0;

function pickKey() {
  const ks = keyList();
  if (!ks.length) throw err('GEMINI_KEYS সেট করা নেই', 'NO_KEYS');
  const t = Date.now();
  let soonest = Infinity;
  for (let i = 0; i < ks.length; i++) {
    const k = ks[(rr + i) % ks.length];
    const until = cool.get(k) || 0;
    if (until <= t) {
      rr = (rr + i + 1) % ks.length;
      return { key: k };
    }
    soonest = Math.min(soonest, until);
  }
  return { wait: soonest - t };
}

function retryMs(text) {
  // গুগল উত্তরে "retryDelay": "34s" দেয়
  const m = /"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/.exec(text || '');
  let ms = m ? Math.ceil(Number(m[1]) * 1000) + 1000 : 60000;
  if (/PerDay|per day|daily/i.test(text || '')) ms = Math.max(ms, 60 * 60 * 1000); // দৈনিক কোটা শেষ
  return Math.min(Math.max(ms, 5000), 6 * 60 * 60 * 1000);
}

// ---------- একটি Gemini কল ----------
async function callModel(system, userText) {
  const total = keyCount();
  let lastErr = null;
  const maxAttempts = total * 2 + 3;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const p = pickKey();
    if (p.wait !== undefined) {
      if (p.wait > 90000) throw err('সব Gemini কী এখন সীমায় পৌঁছেছে, কিছুক্ষণ পরে আবার চেষ্টা করুন', 'RATE_LIMIT');
      await sleep(p.wait + 500);
      continue;
    }

    // দুই কলের মাঝে একটু ফাঁক (ফ্রি সীমা বাঁচাতে); কী যত বেশি, ফাঁক তত কম
    const gap = Number(process.env.TRANSLATE_GAP_MS || 2500) / Math.max(1, total);
    const w = lastCallAt + gap - Date.now();
    if (w > 0) await sleep(w);
    lastCallAt = Date.now();

    let res;
    let txt = '';
    try {
      res = await fetch(`${API}/${encodeURIComponent(modelName())}:generateContent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': p.key },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts: [{ text: userText }] }],
          generationConfig: { temperature: 0.3, responseMimeType: 'application/json', maxOutputTokens: 8192 },
        }),
        signal: AbortSignal.timeout(90000),
      });
      txt = await res.text();
    } catch (e) {
      lastErr = err('Gemini সার্ভারে পৌঁছানো যায়নি', 'NETWORK');
      await sleep(1500);
      continue;
    }

    if (res.status === 429) {
      cool.set(p.key, Date.now() + retryMs(txt));
      lastErr = err('Gemini সীমা (429)', 'RATE_LIMIT', 429);
      continue;
    }
    if (res.status === 401 || res.status === 403 || (res.status === 400 && /API key/i.test(txt))) {
      cool.set(p.key, Date.now() + 30 * 60 * 1000); // কী ভুল/বন্ধ, ৩০ মিনিট বাদ
      lastErr = err('একটি Gemini কী কাজ করছে না (ভুল বা বন্ধ)', 'BAD_KEY', res.status);
      continue;
    }
    if (res.status >= 500) {
      lastErr = err('Gemini সার্ভার সমস্যা', 'SERVER', res.status);
      await sleep(2000);
      continue;
    }
    if (!res.ok) throw err(`Gemini ত্রুটি ${res.status}: ${txt.slice(0, 160)}`, 'BAD_REQUEST', res.status);

    let data;
    try {
      data = JSON.parse(txt);
    } catch {
      lastErr = err('Gemini উত্তর পড়া যায়নি', 'BAD_OUTPUT');
      continue;
    }
    const cand = data.candidates && data.candidates[0];
    if (!cand) throw err('Gemini এই লেখা অনুবাদ করতে রাজি হয়নি (ব্লক)', 'BLOCKED');
    const fr = cand.finishReason;
    if (fr === 'MAX_TOKENS') throw err('উত্তর কেটে গেছে (লেখা বড়)', 'TOO_LONG');
    if (fr && fr !== 'STOP') throw err(`Gemini থেমে গেছে (${fr})`, 'BLOCKED');
    const text = ((cand.content && cand.content.parts) || []).map((x) => x.text || '').join('');
    if (!text.trim()) throw err('Gemini ফাঁকা উত্তর দিয়েছে', 'BAD_OUTPUT');
    return text;
  }
  throw lastErr || err('Gemini এখন কাজ করছে না', 'UNAVAILABLE');
}

function parseItems(text) {
  let t = String(text).trim();
  t = t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  const j = JSON.parse(t);
  return Array.isArray(j) ? j : j && j.items;
}

// ---------- একটি টুকরো (chunk) অনুবাদ ----------
async function translateChunk(items, to, from, context) {
  const system =
    `You are a professional literary translator. Translate every string in "items" from ${LANG_LABEL[from]} to ${LANG_LABEL[to]}. ` +
    'Keep the meaning, tone and style. Keep paragraph breaks and line breaks exactly as in the source. ' +
    'Keep names, numbers, URLs and markdown as they are. Never add notes, explanations or extra text, and never skip anything. ' +
    'The content may be mature or dark psychology; translate it faithfully. ' +
    'Reply with ONLY valid JSON: {"items":[...]} containing exactly the same number of strings, in the same order.';
  const prompt = JSON.stringify({ context: context || '', items });

  let last = null;
  for (let i = 0; i < 3; i++) {
    const text = await callModel(system, prompt);
    try {
      const out = parseItems(text);
      if (Array.isArray(out) && out.length === items.length && out.every((x) => typeof x === 'string')) return out;
      last = err(`অনুবাদের সংখ্যা মেলেনি (${Array.isArray(out) ? out.length : 0}/${items.length})`, 'BAD_OUTPUT');
    } catch {
      last = err('অনুবাদের JSON ভুল', 'BAD_OUTPUT');
    }
  }
  throw last;
}

// ভেঙে ছোট করে আবার চেষ্টা (লেখা বড় বা সংখ্যা না মিললে)
async function translateGroup(items, to, from, context) {
  try {
    return await translateChunk(items, to, from, context);
  } catch (e) {
    if ((e.code === 'TOO_LONG' || e.code === 'BAD_OUTPUT') && items.length > 1) {
      const mid = Math.ceil(items.length / 2);
      const a = await translateGroup(items.slice(0, mid), to, from, context);
      const b = await translateGroup(items.slice(mid), to, from, context);
      return [...a, ...b];
    }
    throw e;
  }
}

function makeGroups(indexes, arr) {
  const groups = [];
  let cur = [];
  let chars = 0;
  for (const i of indexes) {
    const len = arr[i].length;
    if (cur.length && (cur.length >= MAX_ITEMS || chars + len > MAX_CHARS)) {
      groups.push(cur);
      cur = [];
      chars = 0;
    }
    cur.push(i);
    chars += len;
  }
  if (cur.length) groups.push(cur);
  return groups;
}

// strings: লেখার তালিকা -> একই সংখ্যার অনূদিত তালিকা (ফাঁকা লেখা ফাঁকাই থাকে)
export async function translateStrings(strings, to, { from = 'bn', context = '' } = {}) {
  if (!LANG_LABEL[to] || !LANG_LABEL[from]) throw err('ভাষা ঠিক নয়', 'BAD_LANG');
  const arr = (strings || []).map((s) => String(s ?? ''));
  const out = arr.slice();
  const indexes = [];
  arr.forEach((s, i) => {
    if (s.trim()) indexes.push(i);
  });
  for (const g of makeGroups(indexes, arr)) {
    const res = await translateGroup(
      g.map((i) => arr[i]),
      to,
      from,
      context
    );
    g.forEach((i, k) => {
      out[i] = res[k];
    });
  }
  return out;
             }
