// FILE: Products.jsx
// PATH: client/src/admin/pages/Products.jsx (রিপোতে client/src/admin/pages ফোল্ডারের ভেতরে)
// কাজ: সব প্রোডাক্টের তালিকা (মাঙ্গা/ই-বুক), খোঁজা, ফিল্টার, এক চাপে প্রকাশ/লুকানো, এডিটে যাওয়া, নতুন প্রোডাক্ট।

import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adm, admErr } from '../adminApi.js';
import HelpHint from '../components/HelpHint.jsx';

const TYPES = [
  ['', 'সব'],
  ['manga', 'মাঙ্গা'],
  ['ebook', 'ই-বুক'],
];
const STATUS = { published: ['প্রকাশিত', 'var(--ok)'], draft: ['খসড়া', 'var(--warn)'], hidden: ['লুকানো', 'var(--text-3)'] };

function Row({ p, onChanged }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [st, color] = STATUS[p.status] || [p.status, 'var(--accent)'];
  const live = p.status === 'published';

  async function toggle() {
    setBusy(true);
    setErr('');
    try {
      await adm.put('/products/' + p.id, { status: live ? 'hidden' : 'published' });
      onChanged();
    } catch (e) {
      setErr(admErr(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel stack" style={{ gap: 8 }}>
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <div style={{ width: 56, height: 76, flex: 'none', borderRadius: 'var(--radius-s)', overflow: 'hidden', background: 'var(--surface)', border: '1px solid var(--border)' }}>
          {p.coverUrl && <img src={p.coverUrl} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
        </div>
        <div className="stack grow" style={{ gap: 3, minWidth: 0 }}>
          <b style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.title || p.slug}</b>
          <span className="small muted">
            {p.type === 'manga' ? 'মাঙ্গা' : 'ই-বুক'} · {p.chapterCount} চ্যাপ্টার · বিক্রি {(p.stats && p.stats.sold) || 0}
          </span>
          <span className="small">
            {p.priceBDT != null ? '৳' + p.priceBDT : '৳—'} · {p.priceUSD != null ? '$' + p.priceUSD : '$—'}
            {p.discount ? ' · ছাড় চালু' : ''}
            {p.featured ? ' · ★' : ''}
          </span>
        </div>
        <span className="badge" style={{ background: color, flex: 'none' }}>
          {st}
        </span>
      </div>
      <div className="row">
        <Link to={'/products/' + p.id} className="btn btn-sm grow">
          এডিট
        </Link>
        <button type="button" className="btn btn-sm grow" disabled={busy} onClick={toggle}>
          {busy ? '…' : live ? 'লুকান' : 'প্রকাশ করুন'}
        </button>
      </div>
      {err && <span className="error-text">{err}</span>}
    </div>
  );
}

export default function Products() {
  const [items, setItems] = useState(null);
  const [err, setErr] = useState('');
  const [type, setType] = useState('');
  const [q, setQ] = useState('');

  const load = useCallback(() => {
    setErr('');
    adm.get('/products').then((r) => setItems(r.items)).catch((e) => setErr(admErr(e)));
  }, []);
  useEffect(load, [load]);

  const needle = q.trim().toLowerCase();
  const list = (items || []).filter((p) => (!type || p.type === type) && (!needle || (p.title + ' ' + p.slug).toLowerCase().includes(needle)));

  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="row between">
        <h1>প্রোডাক্ট</h1>
        <span className="row" style={{ gap: 8 }}>
          <HelpHint title="প্রকাশ আর খসড়া">
            "প্রকাশিত" হলে সাইটে সবাই দেখে। "খসড়া" বা "লুকানো" হলে শুধু আপনি দেখেন। নতুন প্রোডাক্ট প্রথমে খসড়া থাকে; কভার, দাম ও চ্যাপ্টার দিয়ে শেষে প্রকাশ করুন।
          </HelpHint>
          <Link to="/products/new" className="btn btn-primary btn-sm">
            + নতুন
          </Link>
        </span>
      </div>
      <div className="chips">
        {TYPES.map(([k, label]) => (
          <button key={k || 'all'} type="button" className={'chip' + (type === k ? ' active' : '')} onClick={() => setType(k)}>
            {label}
          </button>
        ))}
      </div>
      <input className="input" type="search" placeholder="নাম বা slug দিয়ে খুঁজুন" value={q} onChange={(e) => setQ(e.target.value)} />

      {err && !items && (
        <div className="empty">
          <span>{err}</span>
          <button type="button" className="btn" onClick={load}>
            আবার চেষ্টা করুন
          </button>
        </div>
      )}
      {!items && !err && (
        <div className="page-loading" style={{ minHeight: 120 }}>
          <div className="spinner" />
        </div>
      )}
      {items && list.length === 0 && <div className="empty">কোনো প্রোডাক্ট নেই</div>}
      {list.map((p) => (
        <Row key={p.id} p={p} onChanged={load} />
      ))}
    </div>
  );
    }
