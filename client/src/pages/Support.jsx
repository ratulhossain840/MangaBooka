// FILE: Support.jsx
// PATH: client/src/pages/Support.jsx (রিপোতে client/src/pages ফোল্ডারের ভেতরে)
// কাজ: সাপোর্ট: নতুন মেসেজ (বিষয়, মেসেজ, গেস্টের জন্য ইমেইল, ঐচ্ছিক অর্ডার কোড), আমার মেসেজের তালিকা, একটি খুলে অ্যাডমিনের উত্তর দেখা ও আবার রিপ্লাই।
// লগইন থাকলে অ্যাকাউন্টের টিকিট; গেস্টের টিকিট এই ডিভাইসে সিক্রেট দিয়ে সেভ থাকে (মুছে গেলে আর খোলা যাবে না)।

import { useCallback, useEffect, useState } from 'react';
import { guest, support } from '../api.js';
import { useI18n } from '../i18n/index.js';
import { useAuth } from '../context/AuthContext.jsx';
import { toast } from '../components/Toast.jsx';

const STATUS_COLOR = { open: 'var(--warn)', answered: 'var(--ok)', closed: 'var(--text-3)' };

function Thread({ id, onBack }) {
  const { t, fmtDate, errMsg } = useI18n();
  const [tk, setTk] = useState(null);
  const [err, setErr] = useState(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    support.get(id).then(setTk).catch(setErr);
  }, [id]);
  useEffect(load, [load]);

  async function send(e) {
    e.preventDefault();
    const m = text.trim();
    if (!m || busy) return;
    setBusy(true);
    try {
      await support.reply(id, m);
      setText('');
      load();
    } catch (ex) {
      toast(ex.status === 409 ? t('support.limit') : errMsg(ex), 'error');
    } finally {
      setBusy(false);
    }
  }

  if (err) {
    return (
      <div className="empty">
        <span>{errMsg(err)}</span>
        <button type="button" className="btn" onClick={onBack}>
          {t('common.back')}
        </button>
      </div>
    );
  }
  if (!tk) {
    return (
      <div className="page-loading">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="stack">
      <button type="button" className="btn btn-sm btn-ghost" style={{ alignSelf: 'flex-start' }} onClick={onBack}>
        ← {t('common.back')}
      </button>
      <div className="row between">
        <h2>{tk.subject}</h2>
        <span className="badge" style={{ background: STATUS_COLOR[tk.status] || 'var(--accent)' }}>
          {t('support.status.' + tk.status)}
        </span>
      </div>
      {tk.orderCode && <span className="muted small">{tk.orderCode}</span>}

      {tk.messages.map((m, i) => (
        <div
          key={i}
          className="panel stack"
          style={{ gap: 4, alignSelf: m.from === 'user' ? 'flex-end' : 'flex-start', maxWidth: '88%', borderColor: m.from === 'user' ? 'var(--accent)' : 'var(--border)' }}
        >
          <span className="small muted">
            {m.from === 'user' ? t('support.you') : t('support.team')} · {fmtDate(m.at, true)}
          </span>
          <span style={{ whiteSpace: 'pre-wrap' }}>{m.text}</span>
        </div>
      ))}

      {tk.status !== 'closed' && (
        <form className="stack" onSubmit={send}>
          <textarea className="textarea" value={text} onChange={(e) => setText(e.target.value)} placeholder={t('support.replyPlaceholder')} maxLength={2000} />
          <button type="submit" className="btn btn-primary" disabled={busy || !text.trim()}>
            {busy ? t('support.sending') : t('support.reply')}
          </button>
        </form>
      )}
    </div>
  );
}

export default function Support() {
  const { t, fmtDate, errMsg } = useI18n();
  const { ready, loggedIn, user } = useAuth();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState(null);
  const [form, setForm] = useState({ subject: '', message: '', email: '', orderCode: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [sent, setSent] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let items = [];
      if (loggedIn) {
        items = (await support.mine()).items || [];
      } else {
        const res = await Promise.allSettled(guest.ticketIds().map((id) => support.get(id)));
        items = res.filter((r) => r.status === 'fulfilled').map((r) => r.value);
        items.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      }
      setList(items);
    } catch {
      setList([]);
    } finally {
      setLoading(false);
    }
  }, [loggedIn]);

  useEffect(() => {
    if (ready) load();
  }, [ready, load]);

  useEffect(() => {
    if (user && user.email) setForm((f) => (f.email ? f : { ...f, email: user.email }));
  }, [user]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setErr('');
    setSent(false);
    try {
      const body = { subject: form.subject.trim(), message: form.message.trim() };
      if (form.email.trim()) body.email = form.email.trim();
      if (form.orderCode.trim()) body.orderCode = form.orderCode.trim();
      await support.create(body);
      setForm((f) => ({ ...f, subject: '', message: '', orderCode: '' }));
      setSent(true);
      load();
    } catch (ex) {
      setErr(errMsg(ex));
    } finally {
      setBusy(false);
    }
  }

  if (openId) {
    return <Thread id={openId} onBack={() => { setOpenId(null); load(); }} />;
  }

  return (
    <div className="stack" style={{ gap: 16 }}>
      <h1>{t('support.title')}</h1>
      <p className="muted">{t('support.intro')}</p>

      <form className="panel stack" onSubmit={submit}>
        <b>{t('support.newTicket')}</b>
        <div className="field">
          <label htmlFor="ss">{t('support.subject')}</label>
          <input id="ss" className="input" value={form.subject} onChange={set('subject')} maxLength={120} required />
        </div>
        <div className="field">
          <label htmlFor="sm">{t('support.message')}</label>
          <textarea id="sm" className="textarea" value={form.message} onChange={set('message')} maxLength={2000} required />
        </div>
        <div className="field">
          <label htmlFor="se">{t('support.email')}{loggedIn ? ` (${t('common.optional')})` : ''}</label>
          <input id="se" className="input" type="email" inputMode="email" value={form.email} onChange={set('email')} required={!loggedIn} />
          {!loggedIn && <span className="hint">{t('support.emailHintGuest')}</span>}
        </div>
        <div className="field">
          <label htmlFor="so">{t('support.orderCode')}</label>
          <input id="so" className="input" value={form.orderCode} onChange={set('orderCode')} autoCapitalize="characters" placeholder="MB-XXXXXX" />
        </div>
        {err && <span className="error-text">{err}</span>}
        {sent && <div className="alert ok small">{t('support.sent')}</div>}
        {!loggedIn && <span className="hint">{t('support.guestNote')}</span>}
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? t('support.sending') : t('support.send')}
        </button>
      </form>

      <section className="stack">
        <h2>{t('support.mine')}</h2>
        {loading && (
          <div className="page-loading" style={{ minHeight: 80 }}>
            <div className="spinner" />
          </div>
        )}
        {!loading && list.length === 0 && <div className="empty" style={{ padding: 24 }}>{t('support.empty')}</div>}
        {list.map((tk) => (
          <button key={tk.id} type="button" className="panel row between" style={{ textAlign: 'left' }} onClick={() => setOpenId(tk.id)}>
            <span className="stack grow" style={{ gap: 2, minWidth: 0 }}>
              <b style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{tk.subject}</b>
              <span className="muted small">{tk.updatedAt ? fmtDate(tk.updatedAt, true) : ''}</span>
            </span>
            <span className="badge" style={{ background: STATUS_COLOR[tk.status] || 'var(--accent)' }}>
              {t('support.status.' + tk.status)}
            </span>
          </button>
        ))}
      </section>
    </div>
  );
                  }
