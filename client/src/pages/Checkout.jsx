// FILE: Checkout.jsx
// PATH: client/src/pages/Checkout.jsx (রিপোতে client/src/pages ফোল্ডারের ভেতরে)
// কাজ: পেমেন্ট ও অর্ডার জমা। বাংলাদেশ: bKash/Nagad নম্বরে টাকা পাঠিয়ে TrxID; বিদেশ: USDT (BEP20/ERC20) ঠিকানায় পাঠিয়ে TXID (0x + ৬৪ হেক্স)।
// নম্বর/ঠিকানা Render env থেকে সার্ভার দেয় (/api/orders/payment-info)। স্ক্রিনশট ঐচ্ছিক: ছবি ব্রাউজারে ছোট করে সার্ভারের মাধ্যমে আপলোড হয়।
// অর্ডারের দাম সার্ভারে আবার হিসাব হয়; এখানের দাম শুধু দেখানোর জন্য। সফল হলে কার্ট খালি করে /order-success-এ যায়।

import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { api, orders } from '../api.js';
import { useI18n } from '../i18n/index.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import { toast } from '../components/Toast.jsx';

const NETWORK = { usdt_bep20: 'BEP20', usdt_erc20: 'ERC20' };
const TX_INT = /^0x[a-fA-F0-9]{64}$/;

// ছবি ছোট করে JPEG base64 (data: ছাড়া) বানায়। ১২০০px এর বেশি হলে কমায়।
function shrink(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const max = 1200;
        const k = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * k);
        c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        const data = c.toDataURL('image/jpeg', 0.8);
        URL.revokeObjectURL(url);
        resolve({ base64: data.split(',')[1], preview: data });
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('bad image'));
    };
    img.src = url;
  });
}

async function copy(text, msg) {
  try {
    await navigator.clipboard.writeText(text);
    toast(msg, 'ok');
  } catch {
    toast(text);
  }
}

export default function Checkout() {
  const { t, fmtMoney, errMsg } = useI18n();
  const nav = useNavigate();
  const { user, loggedIn } = useAuth();
  const cart = useCart();
  const fileRef = useRef(null);

  const [info, setInfo] = useState(null); // { market, methods, note }
  const [infoErr, setInfoErr] = useState(null);
  const [method, setMethod] = useState('');
  const [trx, setTrx] = useState('');
  const [touched, setTouched] = useState(false);
  const [email, setEmail] = useState('');
  const [shot, setShot] = useState({ state: 'none' }); // none | uploading | done | failed
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    let live = true;
    setInfo(null);
    setInfoErr(null);
    orders
      .paymentInfo()
      .then((r) => live && setInfo(r))
      .catch((e) => live && setInfoErr(e));
    return () => {
      live = false;
    };
  }, [cart.currency]);

  useEffect(() => {
    if (user && user.email && !email) setEmail(user.email);
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const available = info ? Object.keys(info.methods).filter((k) => info.methods[k]) : [];
  useEffect(() => {
    if (available.length && !available.includes(method)) setMethod(available[0]);
  }, [info]); // eslint-disable-line react-hooks/exhaustive-deps

  if (cart.count === 0) return <Navigate to="/cart" replace />;

  const isBD = info ? info.market === 'BD' : cart.currency === 'BDT';
  const trxClean = trx.trim();
  const trxOk = isBD ? trxClean.length >= 6 && trxClean.length <= 120 && !/\s/.test(trxClean) : TX_INT.test(trxClean);
  const value = info && method ? info.methods[method] : '';

  async function pickFile(e) {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    setShot({ state: 'uploading' });
    try {
      const { base64, preview } = await shrink(f);
      const r = await api.post('/api/orders/screenshot', { image: base64 }, { auth: 'none' });
      setShot({ state: 'done', url: r.url, preview });
    } catch {
      setShot({ state: 'failed' });
    }
  }

  async function submit(e) {
    e.preventDefault();
    setTouched(true);
    setErr('');
    if (!trxOk || !method || busy || shot.state === 'uploading') return;
    setBusy(true);
    try {
      const body = { items: cart.orderItems, method, trxId: trxClean };
      if (shot.state === 'done') body.screenshotUrl = shot.url;
      if (email.trim()) body.email = email.trim();
      const res = await orders.create(body);
      const total = res.total != null ? res.total : cart.total;
      const currency = res.currency || cart.currency;
      cart.clear();
      nav('/order-success', { replace: true, state: { orderCode: res.orderCode, secret: res.secret || null, total, currency } });
    } catch (ex) {
      setErr(errMsg(ex));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="stack" onSubmit={submit} style={{ gap: 16 }}>
      <h1>{t('checkout.title')}</h1>

      <section className="panel stack">
        <b>{t('checkout.orderSummary')}</b>
        {cart.items.map((i) => (
          <div key={i.id} className="row between">
            <span className="grow" style={{ minWidth: 0 }}>{i.title}</span>
            <span>{fmtMoney(i.price.final, i.price.currency)}</span>
          </div>
        ))}
        <div className="divider" />
        <div className="row between">
          <b>{t('cart.total')}</b>
          <b style={{ fontSize: 20 }}>{fmtMoney(cart.total, cart.currency)}</b>
        </div>
        <Link to="/cart" className="small">
          {t('cart.title')}
        </Link>
      </section>

      {!loggedIn && (
        <div className="alert small">
          {t('checkout.guestNote')}
          <div style={{ marginTop: 6 }}>
            <Link to="/login?next=/checkout">{t('checkout.loginForLibrary')}</Link>
          </div>
        </div>
      )}

      {infoErr && (
        <div className="alert danger">
          {errMsg(infoErr)}
        </div>
      )}
      {info && available.length === 0 && <div className="alert warn">{t('checkout.noMethod')}</div>}

      {available.length > 0 && (
        <>
          <section className="stack">
            <b>{t('checkout.payMethod')}</b>
            <div className="row wrap">
              {available.map((m) => (
                <button key={m} type="button" className={'chip' + (m === method ? ' active' : '')} onClick={() => setMethod(m)}>
                  {t('checkout.method.' + m)}
                </button>
              ))}
            </div>
          </section>

          <section className="panel stack">
            <b>{t('checkout.step1')}</b>
            <div className="row between">
              <span className="muted">{t('checkout.amount')}</span>
              <b style={{ fontSize: 20 }}>{fmtMoney(cart.total, cart.currency)}</b>
            </div>
            <span className="muted small">{isBD ? t('checkout.number') : t('checkout.address') + ' · ' + t('checkout.network') + ': ' + NETWORK[method]}</span>
            <div className="code-box">{value}</div>
            <button type="button" className="btn btn-sm" onClick={() => copy(value, t('common.copied'))}>
              {isBD ? t('checkout.copyNumber') : t('checkout.copyAddress')}
            </button>
            <p className="small muted">
              {isBD
                ? t('checkout.bdHow', { method: t('checkout.method.' + method) })
                : t('checkout.intHow', { amount: fmtMoney(cart.total, cart.currency), network: NETWORK[method] })}
            </p>
            {!isBD && <div className="alert warn small">{t('checkout.networkWarn')}</div>}
            {info && info.note && <div className="alert small" style={{ whiteSpace: 'pre-wrap' }}>{info.note}</div>}
            <span className="hint">{t('checkout.noFee')}</span>
          </section>

          <section className="panel stack">
            <b>{t('checkout.step2')}</b>
            <div className="field">
              <label htmlFor="trx">{isBD ? t('checkout.trxBD') : t('checkout.trxINT')}</label>
              <input
                id="trx"
                className="input"
                value={trx}
                onChange={(e) => setTrx(e.target.value)}
                onBlur={() => setTouched(true)}
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                style={{ fontFamily: 'ui-monospace, Menlo, monospace' }}
              />
              <span className="hint">{isBD ? t('checkout.trxBDHint') : t('checkout.trxINTHint')}</span>
              {touched && !trxOk && <span className="error-text">{isBD ? t('checkout.trxInvalid') : t('checkout.trxInvalidINT')}</span>}
            </div>

            <div className="field">
              <label>{t('checkout.screenshot')}</label>
              <span className="hint">{t('checkout.screenshotHint')}</span>
              <input ref={fileRef} type="file" accept="image/*" onChange={pickFile} className="hidden" />
              {shot.state === 'done' && shot.preview && (
                <img src={shot.preview} alt="" style={{ maxHeight: 180, width: 'auto', borderRadius: 'var(--radius-s)', border: '1px solid var(--border)' }} />
              )}
              <div className="row wrap">
                <button type="button" className="btn btn-sm" onClick={() => fileRef.current && fileRef.current.click()} disabled={shot.state === 'uploading'}>
                  {shot.state === 'uploading' ? t('checkout.uploading') : t('checkout.chooseImage')}
                </button>
                {shot.state === 'done' && (
                  <button type="button" className="btn btn-sm btn-ghost" onClick={() => setShot({ state: 'none' })}>
                    {t('checkout.removeImage')}
                  </button>
                )}
              </div>
              {shot.state === 'failed' && <span className="error-text">{t('checkout.uploadFailed')}</span>}
            </div>

            <div className="field">
              <label htmlFor="em">{t('checkout.email')}</label>
              <input id="em" className="input" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              <span className="hint">{t('checkout.emailHint')}</span>
            </div>
          </section>

          <p className="small muted">{t('checkout.manualNote')}</p>
          {err && <div className="alert danger">{err}</div>}

          <button type="submit" className="btn btn-primary btn-block" disabled={busy || shot.state === 'uploading'}>
            {busy ? t('checkout.submitting') : t('checkout.submit')}
          </button>
        </>
      )}
    </form>
  );
}
