// FILE: EbookEditor.jsx
// PATH: client/src/admin/components/EbookEditor.jsx (রিপোতে client/src/admin/components ফোল্ডারের ভেতরে)
// কাজ: ই-বুকের চ্যাপ্টার লেখা। লেখা পেস্ট করে "অটো পেজ ভাগ" চাপলে প্রায় ২৭৫ শব্দের পেজে ভাগ হয় (অনুচ্ছেদ না ভেঙে)।
// পেজগুলোর মাঝে একটি লাইন "=== পেজ ===" থাকে; হাতে সেটা সরিয়ে/বসিয়ে পেজ বদলানো যায়। ছয় ভাষার ট্যাব আছে (অনুবাদ থাকলে বসান, না থাকলে ফাঁকা রাখুন)।
// ব্যবহার: <EbookEditor productId={id} />

import { useCallback, useEffect, useState } from 'react';
import { adm, admErr } from '../adminApi.js';
import { splitIntoPages, countWords } from '../../utils/paginate.js';
import HelpHint from './HelpHint.jsx';

const LANGS = [
  ['bn', 'বাংলা'],
  ['en', 'English'],
  ['ja', '日本語'],
  ['zh', '中文'],
  ['ms', 'Melayu'],
  ['es', 'Español'],
];
const SEP = '=== পেজ ===';
const SEP_RE = /\n*^[ \t]*={3}\s*পেজ\s*={3}[ \t]*$\n*/m;
const toPages = (s) =>
  String(s || '')
    .split(new RegExp(SEP_RE.source, 'gm'))
    .map((x) => x.trim())
    .filter(Boolean);
const toText = (arr) => (Array.isArray(arr) ? arr.join('\n\n' + SEP + '\n\n') : '');

function Editor({ productId, chapter, nextNumber, onClose, onSaved }) {
  const isNew = !chapter;
  const [number, setNumber] = useState(chapter ? chapter.number : nextNumber);
  const [titles, setTitles] = useState({ ...((chapter && chapter.title) || {}) });
  const [texts, setTexts] = useState(() => {
    const o = {};
    for (const [l] of LANGS) o[l] = toText(chapter && chapter.texts && chapter.texts[l]);
    return o;
  });
  const [lang, setLang] = useState('bn');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');

  const cur = texts[lang] || '';
  const pageCount = toPages(cur).length;
  const words = countWords(cur.replace(new RegExp(SEP_RE.source, 'gm'), ' '), lang);

  function autoSplit() {
    const plain = cur.replace(new RegExp(SEP_RE.source, 'gm'), '\n\n').trim();
    if (!plain) return;
    const pages = splitIntoPages(plain, { lang, words: 275 });
    setTexts((t) => ({ ...t, [lang]: toText(pages) }));
    setMsg(`${pages.length} পেজে ভাগ হয়েছে`);
  }

  async function save() {
    if (busy) return;
    const out = {};
    for (const [l] of LANGS) {
      const p = toPages(texts[l]);
      if (p.length) out[l] = p;
    }
    if (!Object.keys(out).length) {
      setErr('অন্তত একটি ভাষায় লেখা দিন');
      return;
    }
    const title = {};
    for (const [l] of LANGS) if ((titles[l] || '').trim()) title[l] = titles[l].trim();
    const body = { number: Number(number) || 0, title, texts: out };
    if (new Blob([JSON.stringify(body)]).size > 880000) {
      setErr('চ্যাপ্টার খুব বড় (প্রায় ১MB সীমা)। দুই চ্যাপ্টারে ভাগ করুন।');
      return;
    }
    setBusy(true);
    setErr('');
    try {
      if (isNew) await adm.post(`/products/${productId}/chapters`, body);
      else await adm.put(`/products/${productId}/chapters/${chapter.id}`, body);
      onSaved();
    } catch (ex) {
      setErr(admErr(ex));
      setBusy(false);
    }
  }

  return (
    <div className="panel stack">
      <b>{isNew ? 'নতুন চ্যাপ্টার' : 'চ্যাপ্টার এডিট'}</b>
      <div className="field" style={{ width: 110 }}>
        <label>নম্বর</label>
        <input className="input" type="number" min="0" value={number} onChange={(e) => setNumber(e.target.value)} />
      </div>

      <div className="chips">
        {LANGS.map(([l, n]) => (
          <button key={l} type="button" className={'chip' + (lang === l ? ' active' : '')} onClick={() => { setLang(l); setMsg(''); }}>
            {n}
            {toPages(texts[l]).length ? ' ✔' : ''}
          </button>
        ))}
      </div>

      <div className="field">
        <label>চ্যাপ্টারের নাম ({LANGS.find((x) => x[0] === lang)[1]})</label>
        <input className="input" value={titles[lang] || ''} onChange={(e) => setTitles((t) => ({ ...t, [lang]: e.target.value }))} maxLength={200} />
      </div>

      <div className="field">
        <div className="row between">
          <label>লেখা</label>
          <HelpHint title="পেজ কীভাবে হয়">
            পুরো চ্যাপ্টারের লেখা এখানে পেস্ট করে "অটো পেজ ভাগ" চাপুন। পেজের মাঝে "{SEP}" লাইন বসে যাবে। চাইলে নিজে ওই লাইন সরিয়ে বা যোগ করে পেজ বদলাতে পারেন। অন্য ভাষার ট্যাবে অনুবাদ থাকলে বসান; না থাকলে ফাঁকা রাখুন, ক্রেতা বাংলা/ইংরেজি পাবে।
          </HelpHint>
        </div>
        <textarea className="textarea" style={{ minHeight: 320, fontSize: 15 }} value={cur} onChange={(e) => setTexts((t) => ({ ...t, [lang]: e.target.value }))} placeholder="এখানে লেখা পেস্ট করুন" />
        <span className="small muted">
          {pageCount} পেজ · {words} {lang === 'ja' || lang === 'zh' ? 'অক্ষর' : 'শব্দ'}
        </span>
      </div>

      <button type="button" className="btn" onClick={autoSplit} disabled={!cur.trim()}>
        অটো পেজ ভাগ
      </button>
      {msg && <span className="alert ok small">{msg}</span>}
      {err && <span className="error-text">{err}</span>}
      <div className="row">
        <button type="button" className="btn btn-primary grow" disabled={busy} onClick={save}>
          {busy ? '…' : 'সেভ করুন'}
        </button>
        <button type="button" className="btn grow" disabled={busy} onClick={onClose}>
          বাতিল
        </button>
      </div>
    </div>
  );
}

export default function EbookEditor({ productId }) {
  const [list, setList] = useState(null);
  const [err, setErr] = useState('');
  const [edit, setEdit] = useState(null);
  const [loadingId, setLoadingId] = useState('');

  const load = useCallback(() => {
    adm.get(`/products/${productId}/chapters`).then((r) => setList(r.items)).catch((e) => setErr(admErr(e)));
  }, [productId]);
  useEffect(load, [load]);

  async function open(c) {
    setLoadingId(c.id);
    setErr('');
    try {
      setEdit(await adm.get(`/products/${productId}/chapters/${c.id}`));
    } catch (e) {
      setErr(admErr(e));
    } finally {
      setLoadingId('');
    }
  }
  async function remove(c) {
    if (!window.confirm(`"${(c.title && (c.title.bn || c.title.en)) || 'চ্যাপ্টার ' + c.number}" মুছে ফেলবেন?`)) return;
    try {
      await adm.del(`/products/${productId}/chapters/${c.id}`);
      load();
    } catch (e) {
      setErr(admErr(e));
    }
  }

  if (edit) {
    return (
      <Editor
        productId={productId}
        chapter={edit === 'new' ? null : edit}
        nextNumber={(list || []).reduce((m, c) => Math.max(m, c.number || 0), 0) + 1}
        onClose={() => setEdit(null)}
        onSaved={() => {
          setEdit(null);
          load();
        }}
      />
    );
  }

  return (
    <div className="stack">
      <div className="row between">
        <h2>চ্যাপ্টার</h2>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setEdit('new')}>
          + নতুন চ্যাপ্টার
        </button>
      </div>
      {err && <span className="error-text">{err}</span>}
      {!list && !err && <div className="spinner" />}
      {list && list.length === 0 && <div className="empty">এখনো চ্যাপ্টার নেই</div>}
      {(list || []).map((c) => (
        <div key={c.id} className="panel row between">
          <span style={{ minWidth: 0 }}>
            <b>{c.number}.</b> {(c.title && (c.title.bn || c.title.en)) || 'নামহীন'} <span className="muted small">({c.pageCount} পেজ)</span>
          </span>
          <span className="row" style={{ gap: 6, flex: 'none' }}>
            <button type="button" className="btn btn-sm" disabled={loadingId === c.id} onClick={() => open(c)}>
              {loadingId === c.id ? '…' : 'এডিট'}
            </button>
            <button type="button" className="btn btn-sm btn-danger" onClick={() => remove(c)}>
              মুছুন
            </button>
          </span>
        </div>
      ))}
    </div>
  );
    }
