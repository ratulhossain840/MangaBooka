// FILE: Settings.jsx
// PATH: client/src/admin/pages/Settings.jsx (রিপোতে client/src/admin/pages ফোল্ডারের ভেতরে)
// কাজ: ১) ক্যাটাগরি (মাঙ্গা/ই-বুক আলাদা, ৬ ভাষায় নাম) ২) ছাড় ও বিক্রির নিয়ম ৩) পেমেন্ট সেটআপ কেমন (শুধু দেখা; বদলাতে Render Environment)
// ৪) ডেমো ডাটা বসানো/মোছা (পরীক্ষার জন্য)।

import { useCallback, useEffect, useState } from 'react';
import { adm, admErr } from '../adminApi.js';
import HelpHint from '../components/HelpHint.jsx';

const LANGS = [
  ['bn', 'বাংলা'],
  ['en', 'English'],
  ['ja', '日本語'],
  ['zh', '中文'],
  ['ms', 'Melayu'],
  ['es', 'Español'],
];
const RULES = [
  ['minDiscountBDT', 'ন্যূনতম ছাড় (৳)', 200, 'বাংলাদেশে ছাড়ের টাকা এর কম হলে ছাড় দেখানো হবে না। খুব সামান্য ছাড় দিয়ে "ছাড়" লেবেল দেখানো এড়াতে।'],
  ['minDiscountUSD', 'ন্যূনতম ছাড় ($)', 4, 'বিদেশে ডলারে ছাড় এর কম হলে দেখানো হবে না।'],
  ['minPayableUSD', 'ছাড়ের পরে ন্যূনতম দাম ($)', 3, 'ছাড়ের পরেও ডলার দাম এর নিচে নামবে না (USDT পাঠানোর খরচের কথা ভেবে)।'],
  ['salesTierMin', '"জন কিনেছে" দেখানোর শুরু', 5, 'আসল বিক্রি এই সংখ্যা পার হলে বইয়ের কার্ডে "৫+ জন কিনেছে" ধাপে ধাপে দেখায়। ভুয়া সংখ্যা কখনো দেখানো হয় না।'],
  ['bestsellerMin', '"বেস্টসেলার" ব্যাজের শুরু', 50, 'আসল বিক্রি এই সংখ্যা পেরোলে বই "বেস্টসেলার" ব্যাজ পায়।'],
];

function Categories({ cfg, onSaved }) {
  const [list, setList] = useState(() => (cfg.categories || []).map((c) => ({ ...c, name: { ...(c.name || {}) } })));
  const [lang, setLang] = useState('bn');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const upd = (i, k, v) => setList((a) => a.map((c, x) => (x === i ? { ...c, [k]: v } : c)));
  const updN = (i, v) => setList((a) => a.map((c, x) => (x === i ? { ...c, name: { ...c.name, [lang]: v } } : c)));

  async function save() {
    setErr('');
    setMsg('');
    for (const c of list) {
      if (!/^[a-z0-9_-]+$/.test(c.key || '')) return setErr('প্রতিটি ক্যাটাগরির key ইংরেজি ছোট হাতের অক্ষর/সংখ্যা/ড্যাশ দিয়ে হবে');
      if (!(c.name.bn || '').trim()) return setErr(`"${c.key}" এর বাংলা নাম দিন`);
    }
    if (new Set(list.map((c) => c.type + ':' + c.key)).size !== list.length) return setErr('একই ধরনের দুটি ক্যাটাগরির key এক হতে পারবে না');
    setBusy(true);
    try {
      await adm.put('/settings/public', { categories: list });
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
        <b>ক্যাটাগরি</b>
        <HelpHint title="ক্যাটাগরি কী">
          শপ পেজে বাছাইয়ের বাটন। "key" হলো ইংরেজি ছোট নাম (যেমন action); প্রোডাক্ট এডিটে "ক্যাটাগরি" ঘরে ঠিক এই key লিখলে প্রোডাক্ট ওই ক্যাটাগরিতে যায়। নাম ৬ ভাষায় দিতে পারেন, ফাঁকা থাকলে বাংলা দেখায়।
        </HelpHint>
      </div>
      <div className="chips">
        {LANGS.map(([l, n]) => (
          <button key={l} type="button" className={'chip' + (lang === l ? ' active' : '')} onClick={() => setLang(l)}>
            {n}
          </button>
        ))}
      </div>
      {list.length === 0 && <span className="small muted">কোনো ক্যাটাগরি নেই</span>}
      {list.map((c, i) => (
        <div key={i} className="panel stack" style={{ gap: 8 }}>
          <div className="row">
            <select className="select" value={c.type} onChange={(e) => upd(i, 'type', e.target.value)} style={{ flex: '0 0 110px' }}>
              <option value="manga">মাঙ্গা</option>
              <option value="ebook">ই-বুক</option>
            </select>
            <input className="input grow" value={c.key || ''} onChange={(e) => upd(i, 'key', e.target.value.toLowerCase())} placeholder="key (action)" autoCapitalize="none" maxLength={40} />
          </div>
          <input className="input" value={c.name[lang] || ''} onChange={(e) => updN(i, e.target.value)} placeholder={`নাম (${LANGS.find((x) => x[0] === lang)[1]})`} maxLength={60} />
          <button type="button" className="btn btn-sm btn-danger" style={{ alignSelf: 'flex-start' }} onClick={() => setList((a) => a.filter((_, x) => x !== i))}>
            মুছুন
          </button>
        </div>
      ))}
      <button type="button" className="btn" onClick={() => setList((a) => [...a, { key: '', type: 'manga', name: {} }])}>
        + নতুন ক্যাটাগরি
      </button>
      {err && <span className="error-text">{err}</span>}
      {msg && <span className="alert ok small">{msg}</span>}
      <button type="button" className="btn btn-primary" disabled={busy} onClick={save}>
        {busy ? '…' : 'ক্যাটাগরি সেভ করুন'}
      </button>
    </section>
  );
}

function Rules({ cfg, onSaved }) {
  const [v, setV] = useState(() => Object.fromEntries(RULES.map(([k, , d]) => [k, cfg[k] ?? d])));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  async function save() {
    setBusy(true);
    setErr('');
    setMsg('');
    try {
      const body = {};
      for (const [k] of RULES) {
        const n = Number(v[k]);
        if (!(n >= 0)) throw new Error('সব ঘরে ০ বা তার বেশি সংখ্যা দিন');
        body[k] = n;
      }
      await adm.put('/settings/public', body);
      setMsg('সেভ হয়েছে ✔ (সাইটে কয়েক মিনিটের মধ্যে কাজ করবে)');
      onSaved();
    } catch (e) {
      setErr(e && e.status ? admErr(e) : e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel stack">
      <b>ছাড় ও বিক্রির নিয়ম</b>
      {RULES.map(([k, label, , help]) => (
        <div className="field" key={k}>
          <div className="row between">
            <label>{label}</label>
            <HelpHint>{help}</HelpHint>
          </div>
          <input className="input" type="number" min="0" step="any" inputMode="decimal" value={v[k]} onChange={(e) => setV((x) => ({ ...x, [k]: e.target.value }))} />
        </div>
      ))}
      {err && <span className="error-text">{err}</span>}
      {msg && <span className="alert ok small">{msg}</span>}
      <button type="button" className="btn btn-primary" disabled={busy} onClick={save}>
        {busy ? '…' : 'নিয়ম সেভ করুন'}
      </button>
    </section>
  );
}

function Payment() {
  const [p, setP] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    adm.get('/settings/payment').then(setP).catch((e) => setErr(admErr(e)));
  }, []);
  const rows = p
    ? [
        ['PAY_BKASH', 'bKash নম্বর', p.bkash],
        ['PAY_NAGAD', 'Nagad নম্বর', p.nagad],
        ['USDT_BEP20_ADDRESS', 'USDT (BEP20) ঠিকানা', p.usdtBep20],
        ['USDT_ERC20_ADDRESS', 'USDT (ERC20) ঠিকানা', p.usdtErc20],
      ]
    : [];
  return (
    <section className="panel stack">
      <div className="row between">
        <b>পেমেন্টের সেটআপ</b>
        <HelpHint title="কীভাবে বদলাবেন">
          নিরাপত্তার জন্য পেমেন্ট নম্বর ও ওয়ালেট ঠিকানা ডাটাবেসে নয়, Render এ রাখা হয়। বদলাতে: Render → আপনার সার্ভিস → Environment → নিচের নামের ভ্যালু বদলে Save করুন; সার্ভিস নিজে আবার চালু হবে।
        </HelpHint>
      </div>
      {err && <span className="error-text">{err}</span>}
      {!p && !err && <div className="spinner" />}
      {rows.map(([env, name, s]) => (
        <div key={env} className="row between small">
          <span>
            {name}
            <br />
            <span className="muted">{env}</span>
          </span>
          <b style={{ color: s.configured ? 'var(--ok)' : 'var(--danger)' }}>{s.configured ? '✔ দেওয়া আছে (…' + s.last4 + ')' : '✖ নেই'}</b>
        </div>
      ))}
    </section>
  );
}

function Demo() {
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  async function run(kind) {
    if (kind === 'del' && !window.confirm('ডেমো প্রোডাক্ট ও ডেমো ডাটা মুছে ফেলবেন?')) return;
    setBusy(kind);
    setErr('');
    setMsg('');
    try {
      if (kind === 'add') await adm.post('/seed-demo', {});
      else await adm.del('/seed-demo');
      setMsg(kind === 'add' ? 'ডেমো ডাটা বসেছে ✔' : 'ডেমো ডাটা মোছা হয়েছে ✔');
    } catch (e) {
      setErr(admErr(e));
    } finally {
      setBusy('');
    }
  }
  return (
    <section className="panel stack">
      <div className="row between">
        <b>ডেমো ডাটা</b>
        <HelpHint>সাইট পরীক্ষার জন্য কয়েকটি নমুনা মাঙ্গা/ই-বুক বসায়। আসল বই দেওয়ার আগে "ডেমো মুছুন" চাপুন। পরীক্ষায় করা ডেমো অর্ডারগুলো আলাদা, সেগুলো Firebase Console থেকে মুছতে হবে।</HelpHint>
      </div>
      <div className="row">
        <button type="button" className="btn grow" disabled={!!busy} onClick={() => run('add')}>
          {busy === 'add' ? '…' : 'ডেমো বসান'}
        </button>
        <button type="button" className="btn btn-danger grow" disabled={!!busy} onClick={() => run('del')}>
          {busy === 'del' ? '…' : 'ডেমো মুছুন'}
        </button>
      </div>
      {err && <span className="error-text">{err}</span>}
      {msg && <span className="alert ok small">{msg}</span>}
    </section>
  );
}

export default function Settings() {
  const [cfg, setCfg] = useState(null);
  const [err, setErr] = useState('');
  const [rev, setRev] = useState(0);
  const load = useCallback(() => {
    setErr('');
    adm.get('/settings/public').then((c) => { setCfg(c); }).catch((e) => setErr(admErr(e)));
  }, []);
  useEffect(load, [load]);

  if (!cfg) {
    return err ? (
      <div className="empty">
        <span>{err}</span>
        <button type="button" className="btn" onClick={load}>
          আবার চেষ্টা করুন
        </button>
      </div>
    ) : (
      <div className="page-loading">
        <div className="spinner" />
      </div>
    );
  }
  return (
    <div className="stack" style={{ gap: 16 }}>
      <h1>সেটিংস</h1>
      <Categories key={'c' + rev} cfg={cfg} onSaved={() => load()} />
      <Rules key={'r' + rev} cfg={cfg} onSaved={() => load()} />
      <Payment />
      <Demo />
    </div>
  );
            }
