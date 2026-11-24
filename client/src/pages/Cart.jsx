// FILE: Cart.jsx
// PATH: client/src/pages/Cart.jsx (রিপোতে client/src/pages ফোল্ডারের ভেতরে)
// কাজ: কার্ট পেজ: প্রোডাক্টের তালিকা, সরানো, মোট দাম, চেকআউটে যাওয়া। দেশ/ভাষা বদলে দাম বদলালে সতর্কতা দেখায়।
// যেটা আগে থেকেই লাইব্রেরিতে আছে তাতে "আপনার লাইব্রেরিতে আগেই আছে" লেখা আসে (কিনতে হবে না, সরিয়ে দিন)।

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { content, guest } from '../api.js';
import { useI18n } from '../i18n/index.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import PriceTag from '../components/PriceTag.jsx';

export default function Cart() {
  const { t, fmtMoney, fmtNumber } = useI18n();
  const { ready, loggedIn } = useAuth();
  const cart = useCart();
  const [ownedIds, setOwnedIds] = useState([]);

  useEffect(() => {
    if (!ready) return undefined;
    let live = true;
    if (loggedIn) {
      content
        .library()
        .then((r) => live && setOwnedIds((r.items || []).map((i) => i.productId)))
        .catch(() => {});
    } else {
      setOwnedIds(
        guest
          .orders()
          .filter((o) => o.status === 'confirmed')
          .flatMap((o) => (o.items || []).map((i) => i.productId))
      );
    }
    return () => {
      live = false;
    };
  }, [ready, loggedIn]);

  if (cart.count === 0) {
    return (
      <div className="empty">
        <h2>{t('cart.empty')}</h2>
        <span>{t('cart.emptySub')}</span>
        <div className="row">
          <Link to="/manga" className="btn btn-primary">
            {t('nav.manga')}
          </Link>
          <Link to="/ebook" className="btn">
            {t('nav.ebook')}
          </Link>
        </div>
      </div>
    );
  }

  const hasOwned = cart.items.some((i) => ownedIds.includes(i.id));
  const sale = cart.baseTotal > cart.total;

  return (
    <div className="stack">
      <h1 className="page-title">
        {t('cart.title')} <span className="muted small">({t('cart.items', { n: fmtNumber(cart.count) })})</span>
      </h1>

      {cart.notice === 'marketChanged' && (
        <div className="alert warn row between">
          <span>{t('cart.marketChanged')}</span>
          <button type="button" className="btn btn-sm btn-ghost" onClick={cart.dismissNotice}>
            {t('common.ok')}
          </button>
        </div>
      )}

      {cart.items.map((i) => (
        <div key={i.id} className="panel row" style={{ alignItems: 'flex-start' }}>
          <Link to={'/p/' + i.slug} className="pcard-cover" style={{ width: 72, flexShrink: 0 }}>
            {i.coverUrl && <img src={i.coverUrl} alt="" loading="lazy" />}
          </Link>
          <div className="stack grow" style={{ gap: 6 }}>
            <Link to={'/p/' + i.slug} style={{ color: 'var(--text)', fontWeight: 600 }}>
              {i.title}
            </Link>
            <span className="muted small">{t('card.type.' + i.type)}</span>
            <PriceTag price={i.price} size="md" />
            {ownedIds.includes(i.id) && <span className="small" style={{ color: 'var(--warn)' }}>{t('cart.alreadyOwned')}</span>}
          </div>
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => cart.remove(i.id)} aria-label={t('cart.remove')}>
            {t('cart.remove')}
          </button>
        </div>
      ))}

      <div className="panel stack">
        <div className="row between">
          <b>{t('cart.total')}</b>
          <span className="price" style={{ fontSize: 22 }}>
            {sale && <span className="old">{fmtMoney(cart.baseTotal, cart.currency)}</span>}
            <span>{fmtMoney(cart.total, cart.currency)}</span>
          </span>
        </div>
        <span className="hint">{t('cart.digitalNote')}</span>
        {hasOwned ? (
          <div className="alert warn small">{t('cart.alreadyOwned')}</div>
        ) : (
          <Link to="/checkout" className={'btn btn-primary btn-block' + (cart.syncing ? ' hidden' : '')}>
            {t('cart.checkout')}
          </Link>
        )}
        {cart.syncing && <div className="spinner" style={{ alignSelf: 'center' }} />}
      </div>

      <Link to="/manga" className="btn btn-ghost btn-block">
        {t('cart.keepShopping')}
      </Link>
    </div>
  );
      }
