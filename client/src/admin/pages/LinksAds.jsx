// FILE: LinksAds.jsx
// PATH: client/src/admin/pages/LinksAds.jsx (রিপোতে client/src/admin/pages ফোল্ডারের ভেতরে)
// কাজ: ১) প্রচারের লিংক বানানো (utm দিয়ে, যাতে কোন ফেসবুক/ইউটিউব পোস্ট থেকে ভিজিট এলো দেখা যায়) ২) ভিজিট, দেশ, ক্যাম্পেইনের হিসাব
// ৩) হোমের ব্যানার ও উপরের ঘোষণা (announcement) এডিট।

import { useCallback, useEffect, useMemo, useState } from 'react';
import { adm, admErr } from '../adminApi.js';
import HelpHint from '../components/HelpHint.jsx';
import ImageUploader from '../components/ImageUploader.jsx';
import BarChart, { BarList } from '../components/Charts.jsx';

const LANGS = [
  ['bn', 'বাংলা'],
  ['en', 'English'],
  ['ja', '日本語'],
  ['zh', '中文'],
  ['ms', 'Melayu'],
  ['es', 'Español'],
];
const SOURCES = ['facebook', 'youtube', 'tiktok', 'telegram', 'whatsapp', 'instagram', 'x', 'other'];
const clean = (v) => String(v || '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 40);
const nf = new Intl.NumberFormat('bn-BD');
const dl = (d) => {
  const [, m, x] = d.split('-');
  return `${Number(x)}/${Number(m)}`;
};

// ---------- লিংক বানানো ----------
function LinkMaker({ products }) {
  const [slug, setSlug] = useState('');
  const [source, setSource] = useState('facebook');
  const [medium, setMedium] = useState('social');
  const [camp, setCamp] = useState('');
  const [copied, setCopied] = useState(false);

  const url = useMemo(() => {
    const base = window.location.origin + (slug ? '/p/' + slug : '/');
    const p = new URLSearchParams();
    if (clean(source)) p.set('utm_source', clean(source));
    if (clean(medium)) p.set('utm_medium', clean(medium));
    if (clean(camp)) p.set('utm_campaign', clean(camp));
    const qs = p.toString();
    return qs ? base + '?' + qs : base;
  }, [slug, source, medium, camp]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  return (
    <section className="panel stack">
      <div className="row between">
        <b>প্রচারের লিংক বানান</b>
        <HelpHint title="এটা কেন">
          ফেসবুক, ইউটিউব বা টেলিগ্রামে লিংক দিলে এই লিংকটাই দিন। তাহলে নিচের হিসাবে দেখবেন কোন জায়গা থেকে কতজন এলো। প্রোডাক্ট বাছলে লিংকটি সরাসরি ওই বইয়ের পেজে যায় এবং শেয়ারে বইয়ের কভার ও নাম দেখায়।
        </HelpHint>
      </div>
      <div className="field">
        <label>কোন পেজে যাবে</label>
        <select className="select" value={slug} onChange={(e) => setSlug(e.target.value)}>
          <option value="">হোম পেজ</option>
          {products.map((p) => (
            <option key={p.id} value={p.slug}>
              {p.title || p.slug}
            </option>
          ))}
        </select>
      </div>
      <div className="row">
        <div className="field grow">
          <label>কোথায় দেবেন</label>
          <select className="select" value={SOURCES.includes(source) ? source : 'other'} onChange={(e) => setSource(e.target.value === 'other' ? '' : e.target.value)}>
            {SOURCES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="field grow">
          <label>প্রচারের নাম</label>
          <input className="input" value={camp} onChange={(e) => setCamp(e.target.value)} placeholder="eid-offer" autoCapitalize="none" />
        </div>
      </div>
      {!SOURCES.slice(0, -1).includes(source) && (
        <div className="field">
          <label>উৎসের নাম (ইংরেজিতে)</label>
          <input className="input" value={source} onChange={(e) => setSource(e.target.value)} placeholder="যেমন: mygroup" autoCapitalize="none" />
        </div>
      )}
      <div className="field">
        <label>মাধ্যম</label>
        <input className="input" value={medium} onChange={(e) => setMedium(e.target.value)} placeholder="social / ad / bio" autoCapitalize="none" />
      </div>
      <div className="code-box small" style={{ userSelect: 'all', wordBreak: 'break-all' }}>
        {url}
      </div>
      <button type="button" className="btn btn-primary" onClick={copy}>
        {copied ? 'কপি হয়েছে ✔' : 'লিংক কপি করুন'}
      </button>
    </section>
  );
}

// ---------- হিসাব ----------
function Stats({ products }) {
  const [days, setDays] = useState(14);
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    setD(null);
    setErr('');
    adm.get('/analytics?days=' + days).then(setD).catch((e) => setErr(admErr(e)));
  }, [days]);

  const view = useMemo(() => {
    if (!d) return null;
    const countries = {};
    const views = {};
    for (const r of d.daily) {
      for (const [k, v] of Object.entries(r.countries || {})) countries[k] = (countries[k] || 0) + v;
      for (const [k, v] of Object.entries(r.views || {})) views[k] = (views[k] || 0) + v;
    }
    const title = (slug) => (products.find((p) => p.slug === slug) || {}).title || slug;
    const top = (o, f = (x) => x) =>
      Object.entries(o)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([k, v]) => ({ label: f(k), value: v }));
    return {
      total: d.daily.reduce((s, r) => s + (r.visits || 0), 0),
      bars: d.daily.map((r) => ({ label: dl(r.day), value: r.visits || 0 })),
      countries: top(countries),
      views: top(views, title),
      camps: [...d.campaigns].sort((a, b) => (b.visits || 0) - (a.visits || 0)).slice(0, 15).map((c) => ({ label: `${c.source || 'none'} / ${c.campaign || 'none'}`, value: c.visits || 0, sub: c.medium ? 'মাধ্যম: ' + c.medium : '' })),
    };
  }, [d, products]);

  return (
    <section className="panel stack">
      <div className="row between">
        <b>ভিজিটের হিসাব</b>
        <span className="chips">
          {[7, 14, 30].map((n) => (
            <button key={n} type="button" className={'chip' + (days === n ? ' active' : '')} onClick={() => setDays(n)}>
              {n} দিন
            </button>
          ))}
        </span>
      </div>
      {err && <span className="error-text">{err}</span>}
      {!d && !err && <div className="spinner" />}
      {view && (
        <>
          <span className="small muted">এই সময়ে মোট ভিজিট: {nf.format(view.total)}</span>
          <BarChart data={view.bars} />
          <b className="small">কোন দেশ থেকে</b>
          <BarList items={view.countries} color="var(--ok)" />
          <b className="small">কোন বই বেশি দেখা হয়েছে</b>
          <BarList items={view.views} color="var(--warn)" />
          <div className="row between">
            <b className="small">লিংক/ক্যাম্পেইন (সব সময়ের)</b>
            <HelpHint>উপরের লিংক বানানো টুলের লিংক দিয়ে যারা এসেছে তাদের গণনা। utm ছাড়া সরাসরি আসা ভিজিট এখানে আসে না।</HelpHint>
          </div>
          <BarList items={view.camps} empty="এখনো utm লিংক থেকে কেউ আসেনি" />
        </>
      )}
    </section>
  );
}

// ---------- ব্যানার ও ঘোষণা ----------
const trKeep = (o) => ({ ...(o || {}) });

function Banners({ cfg, onSaved }) {
  const [list, setList] = useState(() => (cfg.banners || []).map((b) => ({ ...b, title: trKeep(b.title), subtitle: trKeep(b.subtitle), cta: trKeep(b.cta) })));
  const [open, setOpen] = useState(-1);
  const [lang, setLang] = useState('bn');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const upd = (i, k, v) => setList((a) => a.map((b, x) => (x === i ? { ...b, [k]: v } : b)));
  const updT = (i, k, v) => setList((a) => a.map((b, x) => (x === i ? { ...b, [k]: { ...b[k], [lang]: v } } : b)));
  const move = (i, d) =>
    setList((a) => {
      const n = [...a];
      const j = i + d;
      if (j < 0 || j >= n.length) return n;
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });

  async function save() {
    setBusy(true);
    setErr('');
    setMsg('');
    try {
      await adm.put('/settings/public', { banners: list.map((b, i) => ({ ...b, order: i })) });
      setMsg('সেভ হয়েছে ✔');
      onSaved();
    } catch (e) {
      setErr(admErr(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel stack">
      <div className="row between">
        <b>হোমের ব্যানার</b>
        <HelpHint title="ব্যানার">হোম পেজের উপরের স্লাইডে চলে। ছবি চওড়া (যেমন ১৪০০×৬০০) হলে ভালো দেখায়। "লিংক" এ /p/বইয়ের-slug বা পুরো লিংক দিন। বন্ধ করলে সাইটে দেখায় না কিন্তু এখানে থাকে।</HelpHint>
      </div>
      {list.length === 0 && <span className="small muted">কোনো ব্যানার নেই</span>}
      {list.map((b, i) => (
        <div key={b.id || i} className="panel stack" style={{ gap: 8 }}>
          <div className="row between">
            <span className="row" style={{ gap: 8, minWidth: 0 }}>
              {b.image && <img src={b.image} alt="" style={{ width: 64, height: 36, objectFit: 'cover', borderRadius: 4 }} />}
              <b className="small" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {(b.title && (b.title.bn || b.title.en)) || 'ব্যানার ' + (i + 1)}
              </b>
            </span>
            <span className="row" style={{ gap: 4, flex: 'none' }}>
              <button type="button" className="btn btn-sm" onClick={() => move(i, -1)}>
                ↑
              </button>
              <button type="button" className="btn btn-sm" onClick={() => move(i, 1)}>
                ↓
              </button>
              <button type="button" className="btn btn-sm" onClick={() => setOpen(open === i ? -1 : i)}>
                {open === i ? 'বন্ধ' : 'এডিট'}
              </button>
            </span>
          </div>
          {open === i && (
            <>
              <ImageUploader label="ছবি" value={b.image} onChange={(u) => upd(i, 'image', u)} maxW={1400} />
              <div className="field">
                <label>লিংক</label>
                <input className="input" value={b.link || ''} onChange={(e) => upd(i, 'link', e.target.value)} placeholder="/p/dark-psychology" autoCapitalize="none" />
              </div>
              <div className="chips">
                {LANGS.map(([l, n]) => (
                  <button key={l} type="button" className={'chip' + (lang === l ? ' active' : '')} onClick={() => setLang(l)}>
                    {n}
                  </button>
                ))}
              </div>
              {[
                ['title', 'শিরোনাম'],
                ['subtitle', 'উপশিরোনাম'],
                ['cta', 'বাটনের লেখা'],
              ].map(([k, n]) => (
                <div className="field" key={k}>
                  <label>{n}</label>
                  <input className="input" value={(b[k] && b[k][lang]) || ''} onChange={(e) => updT(i, k, e.target.value)} maxLength={200} />
                </div>
              ))}
              <label className="row" style={{ gap: 8 }}>
                <input type="checkbox" checked={b.active !== false} onChange={(e) => upd(i, 'active', e.target.checked)} />
                <span>চালু</span>
              </label>
              <button type="button" className="btn btn-sm btn-danger" onClick={() => { setList((a) => a.filter((_, x) => x !== i)); setOpen(-1); }}>
                এই ব্যানার মুছুন
              </button>
            </>
          )}
        </div>
      ))}
      <button type="button" className="btn" onClick={() => { setList((a) => [...a, { id: 'b' + Date.now(), image: '', link: '', title: {}, subtitle: {}, cta: {}, active: true }]); setOpen(list.length); }}>
        + নতুন ব্যানার
      </button>
      {err && <span className="error-text">{err}</span>}
      {msg && <span className="alert ok small">{msg}</span>}
      <button type="button" className="btn btn-primary" disabled={busy} onClick={save}>
        {busy ? '…' : 'ব্যানার সেভ করুন'}
      </button>
    </section>
  );
}

function Announcement({ cfg, onSaved }) {
  const a = cfg.announcement || {};
  const [active, setActive] = useState(!!a.active);
  const [link, setLink] = useState(a.link || '');
  const [text, setText] = useState({ ...(a.text || {}) });
  const [lang, setLang] = useState('bn');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  async function save() {
    setBusy(true);
    setErr('');
    setMsg('');
    try {
      await adm.put('/settings/public', { announcement: { active, link, text } });
      setMsg('সেভ হয়েছে ✔');
      onSaved();
    } catch (e) {
      setErr(admErr(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel stack">
      <div className="row between">
        <b>উপরের ঘোষণা</b>
        <HelpHint>হোম পেজের উপরে একটি ছোট লাইন (যেমন "ঈদ অফার চলছে!")। চালু থাকলে সবাই দেখে।</HelpHint>
      </div>
      <label className="row" style={{ gap: 8 }}>
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
        <span>চালু</span>
      </label>
      <div className="chips">
        {LANGS.map(([l, n]) => (
          <button key={l} type="button" className={'chip' + (lang === l ? ' active' : '')} onClick={() => setLang(l)}>
            {n}
          </button>
        ))}
      </div>
      <div className="field">
        <label>লেখা</label>
        <input className="input" value={text[lang] || ''} onChange={(e) => setText((t) => ({ ...t, [lang]: e.target.value }))} maxLength={300} />
      </div>
      <div className="field">
        <label>চাপলে কোথায় যাবে (ঐচ্ছিক)</label>
        <input className="input" value={link} onChange={(e) => setLink(e.target.value)} placeholder="/manga" autoCapitalize="none" />
      </div>
      {err && <span className="error-text">{err}</span>}
      {msg && <span className="alert ok small">{msg}</span>}
      <button type="button" className="btn btn-primary" disabled={busy} onClick={save}>
        {busy ? '…' : 'ঘোষণা সেভ করুন'}
      </button>
    </section>
  );
}

export default function LinksAds() {
  const [products, setProducts] = useState([]);
  const [cfg, setCfg] = useState(null);
  const [err, setErr] = useState('');

  const loadCfg = useCallback(() => {
    adm.get('/settings/public').then(setCfg).catch((e) => setErr(admErr(e)));
  }, []);
  useEffect(() => {
    adm.get('/products').then((r) => setProducts(r.items.filter((p) => p.status === 'published'))).catch(() => {});
    loadCfg();
  }, [loadCfg]);

  return (
    <div className="stack" style={{ gap: 16 }}>
      <h1>লিংক ও বিজ্ঞাপন</h1>
      <LinkMaker products={products} />
      <Stats products={products} />
      {err && !cfg && (
        <div className="empty">
          <span>{err}</span>
          <button type="button" className="btn" onClick={loadCfg}>
            আবার চেষ্টা করুন
          </button>
        </div>
      )}
      {cfg && <Banners cfg={cfg} onSaved={loadCfg} />}
      {cfg && <Announcement cfg={cfg} onSaved={loadCfg} />}
    </div>
  );
  }
