// FILE: OrderSuccess.jsx
// PATH: client/src/pages/OrderSuccess.jsx (রিপোতে client/src/pages ফোল্ডারের ভেতরে)
// কাজ: অর্ডার জমার পর দেখায়: অর্ডার কোড ও (গেস্টের জন্য) সিক্রেট কোড, সেভ করার সতর্কতা। ডাটা আসে location.state থেকে
// ({ orderCode, secret, total, currency }); রিফ্রেশেও ব্রাউজার হিস্ট্রিতে থাকে। সিক্রেট কোড সার্ভার আর দেখাবে না, তাই কপি করে রাখতে বলা হয়।

import { Link, Navigate, useLocation } from 'react-router-dom';
import { useI18n } from '../i18n/index.js';
import { toast } from '../components/Toast.jsx';

async function copy(text, msg) {
  try {
    await navigator.clipboard.writeText(text);
    toast(msg, 'ok');
  } catch {
    toast(text);
  }
}

export default function OrderSuccess() {
  const { t, fmtMoney } = useI18n();
  const { state } = useLocation();
  if (!state || !state.orderCode) return <Navigate to="/orders" replace />;
  const { orderCode, secret, total, currency } = state;

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="center stack" style={{ gap: 6 }}>
        <div style={{ fontSize: 44 }}>✅</div>
        <h1>{t('order.successTitle')}</h1>
        <p className="muted">{t('order.successSub')}</p>
        {total != null && currency && <b>{fmtMoney(total, currency)}</b>}
      </div>

      <div className="panel stack">
        <span className="muted small">{t('order.code')}</span>
        <div className="code-box">{orderCode}</div>
        <button type="button" className="btn btn-sm" onClick={() => copy(orderCode, t('common.copied'))}>
          {t('order.copyCode')}
        </button>

        {secret && (
          <>
            <div className="divider" />
            <span className="muted small">{t('order.secret')}</span>
            <div className="code-box">{secret}</div>
            <button type="button" className="btn btn-sm" onClick={() => copy(secret, t('common.copied'))}>
              {t('order.copySecret')}
            </button>
            <div className="alert warn small">{t('order.saveWarn')}</div>
            <span className="hint">{t('order.savedOnDevice')}</span>
          </>
        )}
      </div>

      <Link to="/orders" className="btn btn-primary btn-block">
        {t('nav.orders')}
      </Link>
      <Link to="/library" className="btn btn-block">
        {t('order.openLibrary')}
      </Link>
    </div>
  );
}
