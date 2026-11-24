// FILE: paginate.js
// PATH: client/src/utils/paginate.js (রিপোতে client/src/utils ফোল্ডারের ভেতরে)
// কাজ: লম্বা লেখাকে ই-বুকের পেজে ভাগ করা (প্রায় ২৫০–৩০০ শব্দ, অনুচ্ছেদ না ভেঙে) এবং শব্দ গোনা।
// অ্যাডমিনের ই-বুক এডিটর (ব্যাচ ১৭) পেস্ট করা লেখা এই ফাইল দিয়ে পেজ বানাবে; জাপানি/চীনা লেখায় শব্দ নেই, তাই অক্ষর গুনে ভাগ হয়।
//
// ব্যবহার: splitIntoPages(text, { lang: 'bn', words: 275 }) => ['পেজ ১', 'পেজ ২', ...]
//         countWords(text, lang) => সংখ্যা

const CJK = new Set(['ja', 'zh']);
const CJK_RE = /[぀-ヿ㐀-䶿一-鿿豈-﫿]/;

export const isCjkLang = (lang) => CJK.has(lang);

// শব্দ গোনা (CJK ভাষায় ফাঁকা বাদে অক্ষর সংখ্যা)
export function countWords(text, lang = '') {
  const s = String(text || '');
  if (CJK.has(lang) || (!lang && CJK_RE.test(s))) return s.replace(/\s+/g, '').length;
  return s.split(/\s+/).filter(Boolean).length;
}

// একটি পেজে সর্বোচ্চ কত একক (শব্দ বা অক্ষর) বসবে
const unitsFor = (lang, words) => (CJK.has(lang) ? Math.round(words * 1.7) : words);

// বাক্যে ভাঙা: । . ! ? 。！？ এর পর ছেদ
function sentences(par) {
  const parts = par.match(/[^।.!?。！？]+[।.!?。！？]*[\s]*/g);
  return parts && parts.length ? parts.map((x) => x.trim()).filter(Boolean) : [par];
}

// খুব লম্বা অনুচ্ছেদকে (বাক্য, দরকারে শব্দ ধরে) limit-এর মধ্যে টুকরো করা
function breakParagraph(par, limit, lang) {
  if (countWords(par, lang) <= limit) return [par];
  const out = [];
  let cur = '';
  const push = () => {
    if (cur.trim()) out.push(cur.trim());
    cur = '';
  };
  for (const sen of sentences(par)) {
    if (countWords(sen, lang) > limit) {
      // একটিমাত্র বাক্যই বড়: শব্দ (বা অক্ষর) ধরে কাটি
      push();
      if (CJK.has(lang)) {
        for (let i = 0; i < sen.length; i += limit) out.push(sen.slice(i, i + limit));
      } else {
        const w = sen.split(/\s+/);
        for (let i = 0; i < w.length; i += limit) out.push(w.slice(i, i + limit).join(' '));
      }
      continue;
    }
    const sep = CJK.has(lang) ? '' : ' ';
    if (countWords(cur + sep + sen, lang) > limit) push();
    cur = cur ? cur + sep + sen : sen;
  }
  push();
  return out;
}

export function splitIntoPages(text, { lang = 'bn', words = 275 } = {}) {
  const limit = Math.max(40, unitsFor(lang, words));
  const soft = Math.round(limit * 1.15); // সামান্য বেশি হলেও অনুচ্ছেদ না ভেঙে রাখি
  const paras = String(text || '')
    .replace(/\r\n?/g, '\n')
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .flatMap((p) => breakParagraph(p, limit, lang));

  const pages = [];
  let cur = [];
  let n = 0;
  for (const p of paras) {
    const c = countWords(p, lang);
    if (cur.length && n + c > soft) {
      pages.push(cur.join('\n\n'));
      cur = [];
      n = 0;
    } else if (cur.length && n >= limit) {
      pages.push(cur.join('\n\n'));
      cur = [];
      n = 0;
    }
    cur.push(p);
    n += c;
  }
  if (cur.length) pages.push(cur.join('\n\n'));
  return pages;
}
