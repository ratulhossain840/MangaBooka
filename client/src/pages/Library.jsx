// FILE: Library.jsx
// PATH: client/src/pages/Library.jsx (রিপোতে client/src/pages ফোল্ডারের ভেতরে)
// কাজ: লাইব্রেরি: কেনা (কনফার্ম হওয়া) প্রোডাক্ট। লগইন থাকলে অ্যাকাউন্টের লাইব্রেরি + এই ডিভাইসের কনফার্ম হওয়া গেস্ট অর্ডার;
// গেস্ট হলে অর্ডার কোড + সিক্রেট দিয়ে খোলার ফর্ম। কনফার্মের অপেক্ষায় থাকা অর্ডারও আলাদা দেখায় (কনফার্মের আগে কিছুই পড়া যায় না)।

import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { content, orders } from '../api.js';
import { useI18n } from '../i18n/index.js';
import { useAuth } from '../context/AuthContext.jsx';
import { SkeletonGrid } from '../components/Skeleton.jsx';

function Cover({ it }) {
  const { t, fmtNumber } = useI18n();
  return (
    <div className="pcard">
      <Link to={'/read/' + it.productId} className="pcard-cover">
        {it.coverUrl && <img src={it.coverUrl} alt="" loading="lazy" />}
      </Link>
      <div className="pcard-title">{it.title}</div>
      <div className="pcard-meta">{it.chapterCount > 0 ? t('library.chaptersCount', { n: fmtNumber(it.chapterCount) }) : t('card.type.' + it.type)}</div>
      <Link to={'/read/' + it.productId} className="btn btn-sm btn-primary">
        {t('library.read')}
      </Link>
    </div>
  );
}

export default function Library() {
  const { t, errMsg } = useI18n();
  const { ready, loggedIn } = useAuth();
  const [items, setItems] = useState([]);
  const [waiting, setWaiting] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [code, setCode] = useState('');
  const [secret, setSecret] = useState('');
  const [formErr, setFormErr] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      let acc = [];
      if (loggedIn) {
        const r = await content.library();
        acc = r.items || [];
      }
      // এই ডিভাইসের গেস্ট অর্ডার (নতুন অবস্থা এনে)
      const g = await orders.refreshGuest();
      const have = new Set(acc.map((i) => i.productId));
      for (const o of g) {
        if (o.status !== 'confirmed') continue;
        for (const i of o.items || []) {
          if (i.productId && !have.has(i.productId)) {
            have.add(i.productId);
            acc.push({ productId: i.productId, type: i.type, slug: i.slug, title: i.title, coverUrl: i.coverUrl, chapterCount: 0 });
          }
        }
      }
      setItems(acc);
      setWaiting(g.filter((o) => o.status === 'pending'));
    } catch (e) {
      setErr(e);
    } finally {
      setLoading(false);
    }
  }, [loggedIn]);

  useEffect(() => {
    if (ready) load();
  }, [ready, load]);

  async function openWithCode(e) {
    e.preventDefault();
    setFormErr('');
    setBusy(true);
    try {
      const v = await orders.track(code.trim(), secret.trim(), { remember: true });
      if (v.status !== 'confirmed') setFormErr(t('order.statusHelp.' + v.status));
      setCode('');
      setSecret('');
      await load();
    } catch (ex) {
      setFormErr(ex.status === 404 || ex.status === 403 ? t('order.notFound') : errMsg(ex));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack" style={{ gap: 16 }}>
      <h1>{t('library.title')}</h1>

      {!loggedIn && ready && <div className="alert small">{t('library.loginHint')} · <Link to="/login?next=/library">{t('auth.login')}</Link></div>}

      {loading && <SkeletonGrid count={3} />}
      {err && !loading && (
        <div className="empty">
          <span>{errMsg(err)}</span>
          <button type="button" className="btn" onClick={load}>
            {t('common.retry')}
          </button>
        </div>
      )}

      {!loading && !err && items.length === 0 && (
        <div className="empty">
          <b>{t('library.empty')}</b>
          <span>{t('library.emptySub')}</span>
        </div>
      )}

      {items.length > 0 && (
        <div className="grid">
          {items.map((it) => (
            <Cover key={it.productId} it={it} />
          ))}
        </div>
      )}

      {waiting.length > 0 && (
        <section className="stack">
          <h2>{t('library.waiting')}</h2>
          {waiting.map((o) => (
            <div key={o.orderCode} className="panel stack" style={{ gap: 6 }}>
              <b style={{ fontFamily: 'ui-monospace, Menlo, monospace' }}>{o.orderCode}</b>
              {(o.items || []).map((i) => (
                <span key={i.productId} className="small">
                  {i.title || i.productId}
                </span>
              ))}
              <span className="muted small">{t('order.statusHelp.pending')}</span>
            </div>
          ))}
          <Link to="/orders" className="btn btn-sm">
            {t('nav.orders')}
          </Link>
        </section>
      )}

      <form className="panel stack" onSubmit={openWithCode}>
        <b>{t('library.guestTitle')}</b>
        <span className="muted small">{t('library.guestSub')}</span>
        <div className="field">
          <label htmlFor="lc">{t('library.orderCode')}</label>
          <input id="lc" className="input" value={code} onChange={(e) => setCode(e.target.value)} autoCapitalize="characters" autoComplete="off" placeholder="MB-XXXXXX" required />
        </div>
        <div className="field">
          <label htmlFor="ls">{t('library.secret')}</label>
          <input id="ls" className="input" value={secret} onChange={(e) => setSecret(e.target.value)} autoComplete="off" required />
        </div>
        {formErr && <span className="error-text">{formErr}</span>}
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? t('common.loading') : t('library.openWithCode')}
        </button>
      </form>
    </div>
  );
}
