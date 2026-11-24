// FILE: MangaShop.jsx
// PATH: client/src/pages/MangaShop.jsx (রিপোতে client/src/pages ফোল্ডারের ভেতরে)
// কাজ: মাঙ্গা শপ। একই শপ পেজের কাঠামো (ShopPage) এখানে, EbookShop.jsx সেটা নিয়ে ই-বুকের জন্য চালায়।
// ShopPage: খোঁজার বক্স, ক্যাটাগরি চিপ, সাজানোর বাছাই, ৩ কলামের গ্রিড (ইনফিনিট স্ক্রল)।

import { useEffect, useState } from 'react';
import { useI18n } from '../i18n/index.js';
import { useMarket } from '../context/MarketContext.jsx';
import ProductGrid, { useProductList } from '../components/ProductGrid.jsx';

const SORTS = ['default', 'new', 'popular', 'price_asc', 'price_desc'];

export function ShopPage({ type }) {
  const { t, fmtNumber } = useI18n();
  const { config } = useMarket();
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [sort, setSort] = useState('default');

  // টাইপ করা শেষ হওয়ার একটু পরে খোঁজা
  useEffect(() => {
    const id = setTimeout(() => setQ(text.trim()), 350);
    return () => clearTimeout(id);
  }, [text]);

  // ভাষা বদলালেও ক্যাটাগরির key একই থাকে, তাই বাছাই ঠিক থাকে
  const cats = ((config && config.categories) || []).filter((c) => c.type === type);

  const params = { type };
  if (q) params.q = q;
  if (category) params.category = category;
  if (sort !== 'default') params.sort = sort;
  const list = useProductList(params);

  return (
    <div className="stack">
      <h1 className="page-title">{t(type === 'manga' ? 'shop.mangaTitle' : 'shop.ebookTitle')}</h1>

      <input className="input" type="search" value={text} onChange={(e) => setText(e.target.value)} placeholder={t('common.searchPlaceholder')} aria-label={t('common.search')} />

      {cats.length > 0 && (
        <div className="chips">
          <button type="button" className={'chip' + (!category ? ' active' : '')} onClick={() => setCategory('')}>
            {t('shop.all')}
          </button>
          {cats.map((c) => (
            <button key={c.key} type="button" className={'chip' + (category === c.key ? ' active' : '')} onClick={() => setCategory(c.key)}>
              {c.name}
            </button>
          ))}
        </div>
      )}

      <div className="row between">
        <span className="muted small">{list.started && !list.error ? t('shop.count', { n: fmtNumber(list.total) }) : ''}</span>
        <select className="select" style={{ width: 'auto', minHeight: 38 }} value={sort} onChange={(e) => setSort(e.target.value)} aria-label={t('shop.sortBy')}>
          {SORTS.map((s) => (
            <option key={s} value={s}>
              {t('shop.sort.' + s)}
            </option>
          ))}
        </select>
      </div>

      <ProductGrid {...list} onLoadMore={list.loadMore} onRetry={list.retry} />
    </div>
  );
}

export default function MangaShop() {
  return <ShopPage type="manga" />;
                    }
