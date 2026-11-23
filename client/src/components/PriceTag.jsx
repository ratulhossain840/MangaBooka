// FILE: PriceTag.jsx
// PATH: client/src/components/PriceTag.jsx (রিপোতে client/src/components ফোল্ডারের ভেতরে)
// কাজ: দাম দেখায়। ছাড় থাকলে পুরনো দাম কাটা + ছাড়ের শতাংশ; চাইলে অফার শেষের কাউন্টডাউন (শুধু আসল অফারের, ভুয়া নয়)।
// ব্যবহার: <PriceTag price={card.price} size="sm|md|lg" countdown />
//   price = ক্যাটালগের { currency, base, final, percentOff, onSale, endsAt(ISO) }

import { useEffect, useState } from 'react';
import { useI18n, splitDuration } from '../i18n/index.js';

const SIZES = { sm: 13, md: 16, lg: 24 };

function Countdown({ endsAt }) {
  const { t, fmtNumber } = useI18n();
  const end = Date.parse(endsAt);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const left = end - now;
  if (!end || left <= 0) return null;
  const { d, h, m, s } = splitDuration(left);
  const parts = [];
  if (d > 0) parts.push([d, 'd']);
  if (d > 0 || h > 0) parts.push([h, 'h']);
  parts.push([m, 'm']);
  if (d === 0) parts.push([s, 's']);
  return (
    <span className="small" style={{ color: 'var(--sale)' }}>
      {t('product.offerEndsIn')}{' '}
      <b>{parts.map(([n, u]) => `${fmtNumber(n)}${t('product.countdown.' + u)}`).join(' ')}</b>
    </span>
  );
}

export default function PriceTag({ price, size = 'md', countdown = false }) {
  const { t, fmtMoney } = useI18n();
  if (!price) return null;
  const sale = price.onSale && price.base > price.final;
  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 2 }}>
      <span className="price" style={{ fontSize: SIZES[size] || SIZES.md }}>
        <span>{fmtMoney(price.final, price.currency)}</span>
        {sale && <span className="old">{fmtMoney(price.base, price.currency)}</span>}
        {sale && price.percentOff > 0 && <span className="off">{t('card.off', { n: price.percentOff })}</span>}
      </span>
      {countdown && sale && price.endsAt && <Countdown endsAt={price.endsAt} />}
    </span>
  );
}
