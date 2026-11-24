// FILE: MyOrders.jsx
// PATH: client/src/pages/MyOrders.jsx (রিপোতে client/src/pages ফোল্ডারের ভেতরে)
// কাজ: আমার অর্ডার। লগইন থাকলে নিজের অ্যাকাউন্টের অর্ডার (সাথে এই ডিভাইসের গেস্ট অর্ডার "অ্যাকাউন্টে নিন" বাটনসহ);
// লগইন না থাকলে এই ডিভাইসের গেস্ট অর্ডারের নতুন অবস্থা। যেকোনো সময় অর্ডার কোড + সিক্রেট দিয়ে ট্র্যাক করা যায়।
// অর্ডার নাকচ হলে কারণ দেখায়; কনফার্ম হলে "পড়ুন" বাটন।

import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { guest, orders } from '../api.js';
import { useI18n } from '../i18n/index.js';
import { useAuth } from '../context/AuthContext.jsx';
import { toast } from '../components/Toast.jsx';

const STATUS_COLOR = { pending: 'var(--warn)', confirmed: 'var(--ok)', rejected: 'var(--danger)' };

function OrderCard({ o, onClaim }) {
  const { t, fmtMoney, fmtDate } = useI18n();
  return (
    <div className="panel stack">
      <div className="row between">
        <b style={{ fontFamily: 'ui-monospace, Menlo, monospace' }}>{o.orderCode}</b>
        <span className="badge" style={{ background: STATUS_COLOR[o.status] || 'var(--accent)' }}>
          {t('order.status.' + o.status)}
        </span>
      </div>
      <span className="muted small">{t('order.statusHelp.' + o.status)}</span>
      {o.status === 'rejected' && o.rejectReason && (
        <div className="alert danger small">
          {t('order.reason')}: {o.rejectReason}
        </div>
      )}

      {(o.items || []).map((i) => (
        <div key={i.productId} className="row between">
          {i.slug ? <Link to={'/p/' + i.slug}>{i.title || i.productId}</Link> : <span>{i.title || i.productId}</span>}
          {o.status === 'confirmed' && (
            <Link to={'/read/' + i.productId} className="btn btn-sm btn-primary">
              {t('order.readNow')}
            </Link>
          )}
        </div>
      ))}

      {(o.total != null || o.createdAt) && (
        <div className="row between small muted">
          <span>{o.createdAt ? fmtDate(o.createdAt, true) : ''}</span>
          {o.total != null && o.currency && <b style={{ color: 'var(--text)' }}>{fmtMoney(o.total, o.currency)}</b>}
        </div>
      )}
      {o.method && (
        <span className="small muted">
          {t('checkout.method.' + o.method)}
          {o.trxId ? ' · ' + o.trxId : ''}
        </span>
      )}
      {onClaim && (
        <button type="button" className="btn btn-sm" onClick={() => onClaim(o)}>
          {t('order.claimBtn')}
        </button>
      )}
    </div>
  );
}

export default function MyOrders() {
  const { t, errMsg } = useI18n();
  const { ready, loggedIn } = useAuth();
  const [mine, setMine] = useState(null);
  const [local, setLocal] = useState(() => guest.orders());
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [code, setCode] = useState('');
  const [secret, setSecret] = useState('');
  const [trackErr, setTrackErr] = useState('');
  const [found, setFound] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      if (loggedIn) {
        const r = await orders.mine();
        setMine(r.orders || r.items || []);
      } else {
        setMine(null);
      }
      setLocal(await orders.refreshGuest());
    } catch (e) {
      setErr(e);
    } finally {
      setLoading(false);
    }
  }, [loggedIn]);

  useEffect(() => {
    if (ready) load();
  }, [ready, load]);

  async function track(e) {
    e.preventDefault();
    setTrackErr('');
    setFound(null);
    try {
      const v = await orders.track(code.trim(), secret.trim(), { remember: true });
      setFound(v);
      setLocal(guest.orders());
    } catch (ex) {
      setTrackErr(ex.status === 404 || ex.status === 403 ? t('order.notFound') : errMsg(ex));
    }
  }

  async function claim(o) {
    try {
      await orders.claim(o.orderCode, o.secret);
      toast(t('order.claimOk'), 'ok');
      // এই ডিভাইসের গেস্ট তালিকা থেকে সরানো (এখন অ্যাকাউন্টে আছে)
      try {
        const rest = guest.orders().filter((x) => x.orderCode !== o.orderCode);
        window.localStorage.setItem('mb_guest_orders', JSON.stringify(rest));
      } catch {
        /* ignore */
      }
      load();
    } catch (ex) {
      toast(errMsg(ex), 'error');
    }
  }

  const mineCodes = new Set((mine || []).map((o) => o.orderCode));
  const guestList = local.filter((o) => !mineCodes.has(o.orderCode));
  const nothing = !loading && !err && (mine || []).length === 0 && guestList.length === 0;

  return (
    <div className="stack" style={{ gap: 16 }}>
      <h1>{t('order.myOrders')}</h1>

      {!loggedIn && ready && (
        <div className="alert small">
          <Link to="/login?next=/orders">{t('checkout.loginForLibrary')}</Link>
        </div>
      )}

      {loading && (
        <div className="page-loading" style={{ minHeight: 120 }}>
          <div className="spinner" />
        </div>
      )}
      {err && (
        <div className="empty">
          <span>{errMsg(err)}</span>
          <button type="button" className="btn" onClick={load}>
            {t('common.retry')}
          </button>
        </div>
      )}
      {nothing && <div className="empty">{t('order.noOrders')}</div>}

      {(mine || []).map((o) => (
        <OrderCard key={o.id || o.orderCode} o={o} />
      ))}

      {guestList.length > 0 && loggedIn && <b className="muted small">{t('order.claimTitle')}</b>}
      {guestList.map((o) => (
        <OrderCard key={o.orderCode} o={o} onClaim={loggedIn ? claim : null} />
      ))}

      <form className="panel stack" onSubmit={track}>
        <b>{t('order.trackTitle')}</b>
        <div className="field">
          <label htmlFor="oc">{t('library.orderCode')}</label>
          <input id="oc" className="input" value={code} onChange={(e) => setCode(e.target.value)} autoCapitalize="characters" autoComplete="off" placeholder="MB-XXXXXX" required />
        </div>
        <div className="field">
          <label htmlFor="os">{t('library.secret')}</label>
          <input id="os" className="input" value={secret} onChange={(e) => setSecret(e.target.value)} autoComplete="off" required />
        </div>
        {trackErr && <span className="error-text">{trackErr}</span>}
        <button type="submit" className="btn btn-primary">
          {t('order.trackBtn')}
        </button>
        {found && <OrderCard o={found} />}
      </form>
    </div>
  );
                }
