// FILE: ProductCard.jsx
// PATH: client/src/components/ProductCard.jsx (রিপোতে client/src/components ফোল্ডারের ভেতরে)
// কাজ: গ্রিডের একটি প্রোডাক্ট (কভার, ব্যাজ, নাম, দাম, আসল বিক্রি/অধ্যায় সংখ্যা)। চাপলে /p/:slug-এ যায়।
// ব্যবহার: <ProductCard product={card} />   (card = /api/catalog থেকে পাওয়া কার্ড)
// বিক্রির সংখ্যা শুধু আসল ধাপে (soldTier null হলে কিছুই দেখায় না)।

import { Link } from 'react-router-dom';
import { useI18n } from '../i18n/index.js';
import PriceTag from './PriceTag.jsx';

export default function ProductCard({ product: p }) {
  const { t, fmtNumber } = useI18n();
  if (!p) return null;

  const meta = p.soldTier
    ? t('card.sold', { n: fmtNumber(p.soldTier) })
    : p.chapterCount > 0
      ? t('card.chapters', { n: fmtNumber(p.chapterCount) })
      : t('card.type.' + p.type);

  return (
    <Link to={'/p/' + p.slug} className="pcard">
      <div className="pcard-cover">
        {p.coverUrl && <img src={p.coverUrl} alt="" loading="lazy" decoding="async" />}
        {p.badges && p.badges.length > 0 && (
          <div className="badges">
            {p.badges.slice(0, 2).map((b) => (
              <span key={b} className={'badge ' + b}>
                {t('card.badge.' + b)}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="pcard-title">{p.title}</div>
      <PriceTag price={p.price} size="sm" />
      <div className="pcard-meta">{meta}</div>
      {p.textReady === false && <div className="pcard-meta" style={{ color: 'var(--warn)' }}>{t('card.textNotReady')}</div>}
    </Link>
  );
}
