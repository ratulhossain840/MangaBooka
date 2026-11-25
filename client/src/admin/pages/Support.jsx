// FILE: Support.jsx
// PATH: client/src/admin/pages/Support.jsx (রিপোতে client/src/admin/pages ফোল্ডারের ভেতরে)
// কাজ: ক্রেতাদের সাপোর্ট মেসেজ দেখা, উত্তর দেওয়া, বন্ধ করা। উত্তর দিলে ক্রেতা তার "সাপোর্ট" পেজে দেখে (গেস্টও, এই ডিভাইসে)।

import { useCallback, useEffect, useState } from 'react';
import { adm, admErr } from '../adminApi.js';
import HelpHint from '../components/HelpHint.jsx';

const FILTERS = [
  ['open', 'খোলা'],
  ['answered', 'উত্তর দেওয়া'],
  ['closed', 'বন্ধ'],
  ['', 'সব'],
];
const STATUS = { open: ['খোলা', 'var(--warn)'], answered: ['উত্তর দেওয়া', 'var(--ok)'], closed: ['বন্ধ', 'var(--text-3)'] };
const when = (ms) => (ms ? new Date(ms).toLocaleString('bn-BD', { dateStyle: 'medium', timeStyle: 'short' }) : '');

function Thread({ id, onBack }) {
  const [t, setT] = useState(null);
  const [err, setErr] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    adm.get('/support/' + id).then(setT).catch((e) => setErr(admErr(e)));
  }, [id]);
  useEffect(load, [load]);

  async function reply(e) {
    e.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true);
    setErr('');
    try {
      await adm.post(`/support/${id}/reply`, { message: text.trim() });
      setText('');
      load();
    } catch (ex) {
      setErr(admErr(ex));
    } finally {
      setBusy(false);
    }
  }
  async function close() {
    setBusy(true);
    try {
      await adm.post(`/support/${id}/close`, {});
      onBack();
    } catch (ex) {
      setErr(admErr(ex));
      setBusy(false);
    }
  }

  if (!t) {
    return err ? (
      <div className="empty">
        <span>{err}</span>
        <button type="button" className="btn" onClick={onBack}>
          পিছনে
        </button>
      </div>
    ) : (
      <div className="page-loading">
        <div className="spinner" />
      </div>
    );
  }
  const [st, color] = STATUS[t.status] || [t.status, 'var(--accent)'];

  return (
    <div className="stack">
      <button type="button" className="btn btn-sm btn-ghost" style={{ alignSelf: 'flex-start' }} onClick={onBack}>
        ← পিছনে
      </button>
      <div className="row between">
        <h2>{t.subject}</h2>
        <span className="badge" style={{ background: color }}>
          {st}
        </span>
      </div>
      <span className="muted small">
        {t.contactEmail || (t.userId ? 'অ্যাকাউন্ট ইউজার' : '')}
        {t.orderCode ? ' · অর্ডার ' + t.orderCode : ''}
        {t.country ? ' · ' + t.country : ''}
      </span>

      {(t.messages || []).map((m, i) => (
        <div key={i} className="panel stack" style={{ gap: 4, alignSelf: m.from === 'admin' ? 'flex-end' : 'flex-start', maxWidth: '90%', borderColor: m.from === 'admin' ? 'var(--accent)' : 'var(--border)' }}>
          <span className="small muted">
            {m.from === 'admin' ? 'আপনি' : 'ক্রেতা'} · {when(m.at)}
          </span>
          <span style={{ whiteSpace: 'pre-wrap' }}>{m.text}</span>
        </div>
      ))}

      <form className="stack" onSubmit={reply}>
        <textarea className="textarea" value={text} onChange={(e) => setText(e.target.value)} placeholder="উত্তর লিখুন" maxLength={2000} />
        {err && <span className="error-text">{err}</span>}
        <div className="row">
          <button type="submit" className="btn btn-primary grow" disabled={busy || !text.trim()}>
            {busy ? '…' : 'উত্তর পাঠান'}
          </button>
          {t.status !== 'closed' && (
            <button type="button" className="btn grow" disabled={busy} onClick={close}>
              বন্ধ করুন
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

export default function Support() {
  const [status, setStatus] = useState('open');
  const [items, setItems] = useState(null);
  const [err, setErr] = useState('');
  const [openId, setOpenId] = useState(null);

  const load = useCallback(() => {
    setErr('');
    adm
      .get('/support' + (status ? '?status=' + status : ''))
      .then((r) => setItems(r.items))
      .catch((e) => setErr(admErr(e)));
  }, [status]);

  useEffect(() => {
    if (openId) return undefined;
    setItems(null);
    load();
    const id = setInterval(load, 60000);
    return () => clearInterval(id);
  }, [load, openId]);

  if (openId) return <Thread id={openId} onBack={() => setOpenId(null)} />;

  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="row between">
        <h1>সাপোর্ট</h1>
        <HelpHint>ক্রেতার নতুন বা নতুন রিপ্লাই আসা মেসেজ "খোলা" তে থাকে। উত্তর দিলে "উত্তর দেওয়া" হয়ে যায়। সমস্যা মিটে গেলে "বন্ধ করুন"।</HelpHint>
      </div>
      <div className="chips">
        {FILTERS.map(([k, label]) => (
          <button key={k || 'all'} type="button" className={'chip' + (status === k ? ' active' : '')} onClick={() => setStatus(k)}>
            {label}
          </button>
        ))}
      </div>

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
      {items && items.length === 0 && <div className="empty">কোনো মেসেজ নেই</div>}
      {(items || []).map((t) => {
        const [st, color] = STATUS[t.status] || [t.status, 'var(--accent)'];
        return (
          <button key={t.id} type="button" className="panel stack" style={{ textAlign: 'left', gap: 4 }} onClick={() => setOpenId(t.id)}>
            <div className="row between">
              <b style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.subject}</b>
              <span className="badge" style={{ background: color }}>
                {st}
              </span>
            </div>
            <span className="small muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {t.lastFrom === 'admin' ? 'আপনি: ' : ''}
              {t.lastMessage}
            </span>
            <span className="small muted">
              {t.contactEmail || (t.userId ? 'অ্যাকাউন্ট ইউজার' : '')} · {when(t.updatedAt)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
