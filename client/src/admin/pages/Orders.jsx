// FILE: Orders.jsx
// PATH: client/src/admin/pages/Orders.jsx (রিপোতে client/src/admin/pages ফোল্ডারের ভেতরে)
// কাজ: অর্ডার দেখা ও কনফার্ম/রিজেক্ট। ক্রেতা টাকা পাঠিয়ে TrxID/TXID দেয়; আপনি bKash/Nagad অ্যাপে বা ব্লকচেইনে মিলিয়ে "কনফার্ম" চাপলে সে পড়তে পারে।
// USDT অর্ডারে TXID চাপলে BscScan (BEP20) বা Etherscan (ERC20) এ খোলে। সামান্য কম এলেও আপনি চাইলে কনফার্ম করতে পারেন (নোট লিখে রাখুন)।

import { useCallback, useEffect, useState } from 'react';
import { adm, admErr } from '../adminApi.js';
import HelpHint from '../components/HelpHint.jsx';

const FILTERS = [
  ['pending', 'অপেক্ষায়'],
  ['confirmed', 'কনফার্ম'],
  ['rejected', 'বাতিল'],
  ['', 'সব'],
];
const STATUS = { pending: ['অপেক্ষায়', 'var(--warn)'], confirmed: ['কনফার্ম', 'var(--ok)'], rejected: ['বাতিল', 'var(--danger)'] };
const METHOD = { bkash: 'bKash', nagad: 'Nagad', usdt_bep20: 'USDT (BEP20)', usdt_erc20: 'USDT (ERC20)' };

const money = (n, cur) => {
  try {
    return new Intl.NumberFormat(cur === 'BDT' ? 'bn-BD' : 'en-US', { style: 'currency', currency: cur, currencyDisplay: 'narrowSymbol', maximumFractionDigits: cur === 'BDT' ? 0 : 2 }).format(n);
  } catch {
    return (cur === 'BDT' ? '৳' : '$') + n;
  }
};
const when = (ms) => (ms ? new Date(ms).toLocaleString('bn-BD', { dateStyle: 'medium', timeStyle: 'short' }) : '');
const explorer = (m, tx) => (m === 'usdt_bep20' ? 'https://bscscan.com/tx/' + tx : m === 'usdt_erc20' ? 'https://etherscan.io/tx/' + tx : null);

async function copy(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    /* ignore */
  }
}

function OrderCard({ o, onDone }) {
  const [mode, setMode] = useState(null); // 'confirm' | 'reject'
  const [note, setNote] = useState('');
  const [reason, setReason] = useState('');
  const [release, setRelease] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [st, color] = STATUS[o.status] || [o.status, 'var(--accent)'];
  const link = explorer(o.method, o.trxId);

  async function act(kind) {
    if (busy) return;
    if (kind === 'reject' && !reason.trim()) {
      setErr('রিজেক্টের কারণ লিখুন (ক্রেতা দেখতে পাবে)');
      return;
    }
    setBusy(true);
    setErr('');
    try {
      if (kind === 'confirm') await adm.post(`/orders/${o.id}/confirm`, { note: note.trim() });
      else await adm.post(`/orders/${o.id}/reject`, { reason: reason.trim(), releaseTx: release });
      setMode(null);
      onDone();
    } catch (e) {
      setErr(admErr(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel stack" style={{ gap: 8 }}>
      <div className="row between">
        <b style={{ fontFamily: 'ui-monospace, Menlo, monospace' }}>{o.orderCode}</b>
        <span className="badge" style={{ background: color }}>
          {st}
        </span>
      </div>
      <div className="row between">
        <b style={{ fontSize: 20 }}>{money(o.total, o.currency)}</b>
        <span className="muted small">{when(o.createdAt)}</span>
      </div>
      <span className="small">
        {METHOD[o.method] || o.method}
        {o.country ? ' · ' + o.country : ''}
      </span>

      <div className="row" style={{ gap: 8 }}>
        <div className="code-box grow small" style={{ userSelect: 'all' }}>
          {o.trxId}
        </div>
        <button type="button" className="btn btn-sm" onClick={() => copy(o.trxId)}>
          কপি
        </button>
      </div>
      {link && (
        <a href={link} target="_blank" rel="noopener noreferrer" className="small">
          ব্লকচেইনে দেখুন ↗
        </a>
      )}

      <div className="stack" style={{ gap: 2 }}>
        {o.items.map((i) => (
          <span key={i.productId} className="small">
            • {i.title} <span className="muted">({money(i.price && i.price.final != null ? i.price.final : i.price, o.currency)})</span>
          </span>
        ))}
      </div>

      {(o.contactEmail || o.userId) && (
        <span className="small muted">
          {o.contactEmail || ''} {o.userId ? '· অ্যাকাউন্টসহ' : '· গেস্ট'}
        </span>
      )}
      {o.screenshotUrl && (
        <a href={o.screenshotUrl} target="_blank" rel="noopener noreferrer">
          <img src={o.screenshotUrl} alt="পেমেন্টের স্ক্রিনশট" loading="lazy" style={{ maxHeight: 160, width: 'auto', borderRadius: 'var(--radius-s)', border: '1px solid var(--border)' }} />
        </a>
      )}
      {o.status === 'rejected' && o.rejectReason && <div className="alert danger small">কারণ: {o.rejectReason}</div>}
      {o.status === 'confirmed' && o.adminNote && <div className="alert small">নোট: {o.adminNote}</div>}

      {o.status === 'pending' && !mode && (
        <div className="row">
          <button type="button" className="btn btn-primary grow" onClick={() => setMode('confirm')}>
            কনফার্ম
          </button>
          <button type="button" className="btn btn-danger grow" onClick={() => setMode('reject')}>
            রিজেক্ট
          </button>
        </div>
      )}

      {mode === 'confirm' && (
        <div className="stack">
          <input className="input" placeholder="নোট (ঐচ্ছিক, যেমন: ২০ টাকা কম এসেছিল)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />
          <div className="row">
            <button type="button" className="btn btn-primary grow" disabled={busy} onClick={() => act('confirm')}>
              {busy ? '…' : 'হ্যাঁ, কনফার্ম করুন'}
            </button>
            <button type="button" className="btn grow" onClick={() => setMode(null)}>
              না
            </button>
          </div>
        </div>
      )}
      {mode === 'reject' && (
        <div className="stack">
          <input className="input" placeholder="কারণ (ক্রেতা দেখবে, বাধ্যতামূলক)" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} />
          <label className="row small" style={{ gap: 8 }}>
            <input type="checkbox" checked={release} onChange={(e) => setRelease(e.target.checked)} />
            <span>এই TrxID আবার ব্যবহার করার অনুমতি দিন</span>
            <HelpHint>
              ক্রেতা ভুল TrxID দিয়ে থাকলে এটা টিক দিন, তাহলে সে সঠিক টাকার জন্য একই TrxID নতুন অর্ডারে দিতে পারবে। টাকা আসলেই না এসে থাকলে টিক দেবেন না, যাতে কেউ ভুয়া ID আবার ব্যবহার করতে না পারে।
            </HelpHint>
          </label>
          <div className="row">
            <button type="button" className="btn btn-danger grow" disabled={busy} onClick={() => act('reject')}>
              {busy ? '…' : 'রিজেক্ট করুন'}
            </button>
            <button type="button" className="btn grow" onClick={() => setMode(null)}>
              না
            </button>
          </div>
        </div>
      )}
      {err && <span className="error-text">{err}</span>}
    </div>
  );
}

export default function Orders() {
  const [status, setStatus] = useState('pending');
  const [q, setQ] = useState('');
  const [items, setItems] = useState(null);
  const [err, setErr] = useState('');

  const load = useCallback(() => {
    setErr('');
    adm
      .get('/orders' + (status ? '?status=' + status : ''))
      .then((r) => setItems(r.items))
      .catch((e) => setErr(admErr(e)));
  }, [status]);

  useEffect(() => {
    setItems(null);
    load();
    const id = setInterval(load, 60000);
    return () => clearInterval(id);
  }, [load]);

  const needle = q.trim().toLowerCase();
  const list = (items || []).filter(
    (o) => !needle || [o.orderCode, o.trxId, o.contactEmail].some((v) => String(v || '').toLowerCase().includes(needle))
  );

  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="row between">
        <h1>অর্ডার</h1>
        <HelpHint title="কীভাবে কনফার্ম করবেন">
          ১. ক্রেতার দেওয়া TrxID bKash/Nagad অ্যাপের লেনদেনের তালিকায় মিলিয়ে দেখুন (টাকার পরিমাণও)।
          {'\n'}২. USDT হলে "ব্লকচেইনে দেখুন" চেপে TXID ও পরিমাণ মিলান, ঠিকানা আপনার ওয়ালেটের কিনা দেখুন।
          {'\n'}৩. ঠিক থাকলে "কনফার্ম"। এরপর ক্রেতা লাইব্রেরি থেকে পড়তে পারবে। মেলে না বা টাকা আসেনি হলে কারণসহ "রিজেক্ট"।
        </HelpHint>
      </div>

      <div className="chips">
        {FILTERS.map(([k, label]) => (
          <button key={k || 'all'} type="button" className={'chip' + (status === k ? ' active' : '')} onClick={() => setStatus(k)}>
            {label}
          </button>
        ))}
      </div>
      <input className="input" type="search" placeholder="কোড, TrxID বা ইমেইল দিয়ে খুঁজুন" value={q} onChange={(e) => setQ(e.target.value)} />

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
      {items && list.length === 0 && <div className="empty">কোনো অর্ডার নেই</div>}
      {list.map((o) => (
        <OrderCard key={o.id} o={o} onDone={load} />
      ))}
    </div>
  );
  }
