// FILE: Offers.jsx
// PATH: client/src/admin/pages/Offers.jsx (রিপোতে client/src/admin/pages ফোল্ডারের ভেতরে)
// কাজ: ছাড়ের অফার একসাথে অনেক প্রোডাক্টে বসানো (শতাংশ + শুরু/শেষ সময়) এবং চলতি অফার দেখা ও বন্ধ করা।
// একটি প্রোডাক্টের নির্দিষ্ট টাকার ছাড় দিতে হলে প্রোডাক্ট এডিটে যান।

import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adm, admErr } from '../adminApi.js';
import HelpHint from '../components/HelpHint.jsx';

const when = (iso) => (iso ? new Date(iso).toLocaleString('bn-BD', { dateStyle: 'medium', timeStyle: 'short' }) : '');

function state(d) {
  if (!d) return null;
  const now = Date.now();
  const s = d.start ? new Date(d.start).getTime() : null;
  const e = d.end ? new Date(d.end).getTime() : null;
  if (e && e < now) return ['শেষ', 'var(--text-3)'];
  if (s && s > now) return ['আসছে', 'var(--warn)'];
  return ['চলছে', 'var(--ok)'];
}
const label = (d) =>
  [d.percent != null ? d.percent + '%' : null, d.fixedBDT != null ? '৳' + d.fixedBDT : null, d.fixedUSD != null ? '$' + d.fixedUSD : null].filter(Boolean).join(' · ');

export default function Offers() {
  const [items, setItems] = useState(null);
  const [err, setErr] = useState('');
  const [busyId, setBusyId] = useState('');
  const [percent, setPercent] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [sel, setSel] = useState({});
  const [q, setQ] = useState('');
  const [applying, setApplying] = useState(false);
  const [report, setReport] = useState(null);

  const load = useCallback(() => {
    adm.get('/products').then((r) => setItems(r.items)).catch((e) => setErr(admErr(e)));
  }, []);
  useEffect(load, [load]);

  async function stop(p) {
    if (!window.confirm(`"${p.title}" এর ছাড় বন্ধ করবেন?`)) return;
    setBusyId(p.id);
    try {
      await adm.put('/products/' + p.id, { discount: null });
      load();
    } catch (e) {
      setErr(admErr(e));
    } finally {
      setBusyId('');
    }
  }

  async function apply() {
    const pc = Number(percent);
    const ids = Object.keys(sel).filter((k) => sel[k]);
    if (!(pc > 0 && pc < 100)) return setErr('শতাংশ ১ থেকে ৯৯ এর মধ্যে দিন');
    if (!ids.length) return setErr('অন্তত একটি প্রোডাক্ট বাছুন');
    if (start && end && new Date(end) <= new Date(start)) return setErr('শেষের সময় শুরুর পরে হতে হবে');
    setErr('');
    setApplying(true);
    const out = { ok: 0, fail: [], warn: [] };
    for (const id of ids) {
      const p = items.find((x) => x.id === id);
      try {
        const r = await adm.put('/products/' + id, { discount: { percent: pc, start: start ? new Date(start).toISOString() : null, end: end ? new Date(end).toISOString() : null } });
        out.ok++;
        (r.warnings || []).forEach((w) => out.warn.push(`${p.title}: ${w}`));
      } catch (e) {
        out.fail.push(`${p ? p.title : id}: ${admErr(e)}`);
      }
    }
    setReport(out);
    setSel({});
    setApplying(false);
    load();
  }

  if (!items) {
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

  const withDisc = items.filter((p) => p.discount);
  const needle = q.trim().toLowerCase();
  const pick = items.filter((p) => !needle || (p.title + p.slug).toLowerCase().includes(needle));
  const count = Object.values(sel).filter(Boolean).length;

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="row between">
        <h1>অফার ও ছাড়</h1>
        <HelpHint title="অফার কীভাবে কাজ করে">
          শতাংশ ছাড় বাংলাদেশে ৳ এ ও অন্য দেশে $ এ নিজে হিসাব হয়। শুরু ও শেষের সময় দিলে ক্রেতা কাউন্টডাউন দেখে; সময় ফাঁকা রাখলে ছাড় সবসময় চালু থাকে। ছাড়ের পরের দাম খুব কম হয়ে গেলে (সেটিংসের সীমার নিচে) সাইট ছাড় দেখাবে না এবং সেভের সময় সতর্কতা আসবে।
        </HelpHint>
      </div>

      <section className="panel stack">
        <b>নতুন অফার</b>
        <div className="field">
          <label>ছাড় (%)</label>
          <input className="input" type="number" min="1" max="99" inputMode="decimal" value={percent} onChange={(e) => setPercent(e.target.value)} placeholder="যেমন: 20" />
        </div>
        <div className="row">
          <div className="field grow">
            <label>শুরু (ঐচ্ছিক)</label>
            <input className="input" type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div className="field grow">
            <label>শেষ (ঐচ্ছিক)</label>
            <input className="input" type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>
        </div>
        <input className="input" type="search" placeholder="প্রোডাক্ট খুঁজুন" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="row">
          <button type="button" className="btn btn-sm" onClick={() => setSel(Object.fromEntries(pick.map((p) => [p.id, true])))}>
            সব বাছুন
          </button>
          <button type="button" className="btn btn-sm" onClick={() => setSel({})}>
            বাছাই মুছুন
          </button>
        </div>
        <div className="stack" style={{ gap: 6, maxHeight: 280, overflowY: 'auto' }}>
          {pick.map((p) => (
            <label key={p.id} className="row" style={{ gap: 8 }}>
              <input type="checkbox" checked={!!sel[p.id]} onChange={(e) => setSel((s) => ({ ...s, [p.id]: e.target.checked }))} />
              <span className="small" style={{ minWidth: 0 }}>
                {p.title || p.slug} <span className="muted">({p.type === 'manga' ? 'মাঙ্গা' : 'ই-বুক'})</span>
              </span>
            </label>
          ))}
          {pick.length === 0 && <span className="small muted">কোনো প্রোডাক্ট নেই</span>}
        </div>
        {err && <span className="error-text">{err}</span>}
        <button type="button" className="btn btn-primary" disabled={applying} onClick={apply}>
          {applying ? 'বসানো হচ্ছে…' : `${count}টি প্রোডাক্টে অফার বসান`}
        </button>
        {report && (
          <div className="stack" style={{ gap: 4 }}>
            <div className="alert ok small">{report.ok}টিতে অফার বসেছে ✔</div>
            {report.fail.map((m, i) => (
              <div key={'f' + i} className="alert danger small">
                {m}
              </div>
            ))}
            {report.warn.map((m, i) => (
              <div key={'w' + i} className="alert warn small">
                ⚠ {m}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="stack">
        <h2>বর্তমান অফার ({withDisc.length})</h2>
        {withDisc.length === 0 && <div className="empty">কোনো প্রোডাক্টে ছাড় নেই</div>}
        {withDisc.map((p) => {
          const [st, color] = state(p.discount);
          return (
            <div key={p.id} className="panel stack" style={{ gap: 6 }}>
              <div className="row between">
                <b style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.title || p.slug}</b>
                <span className="badge" style={{ background: color }}>
                  {st}
                </span>
              </div>
              <span className="small">
                ছাড়: {label(p.discount)}
                {p.discount.start ? ` · শুরু ${when(p.discount.start)}` : ''}
                {p.discount.end ? ` · শেষ ${when(p.discount.end)}` : ' · শেষের সময় নেই'}
              </span>
              <div className="row">
                <Link to={'/products/' + p.id} className="btn btn-sm grow">
                  এডিট
                </Link>
                <button type="button" className="btn btn-sm btn-danger grow" disabled={busyId === p.id} onClick={() => stop(p)}>
                  {busyId === p.id ? '…' : 'ছাড় বন্ধ'}
                </button>
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
      }
