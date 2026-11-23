// FILE: ProductGrid.jsx
// PATH: client/src/components/ProductGrid.jsx (রিপোতে client/src/components ফোল্ডারের ভেতরে)
// কাজ: ৩ কলামের গ্রিড + ইনফিনিট স্ক্রল (নিচে পৌঁছালে আরও আনে) + লোডিং স্কেলিটন + ফাঁকা/ত্রুটির অবস্থা।
// দুটি জিনিস দেয়:
//   1) default <ProductGrid items loading hasMore onLoadMore error onRetry />   (শুধু দেখানো)
//   2) useProductList({ type, category, q, sort })  => { items, total, loading, error, hasMore, loadMore, retry }
//      (শপ পেজে ব্যবহার: প্যারামিটার বা ভাষা/দেশ বদলালে নিজে নতুন করে শুরু করে)
// সাধারণ ব্যবহার (শপ পেজে): const list = useProductList({ type:'manga', sort }); <ProductGrid {...list} onLoadMore={list.loadMore} onRetry={list.retry} />

import { useCallback, useEffect, useRef, useState } from 'react';
import { catalog } from '../api.js';
import { useI18n } from '../i18n/index.js';
import { useMarket } from '../context/MarketContext.jsx';
import ProductCard from './ProductCard.jsx';
import { SkeletonGrid } from './Skeleton.jsx';

export function useProductList(params = {}, limit = 12) {
  const { lang } = useI18n();
  const { market, country } = useMarket();
  const [state, setState] = useState({ items: [], total: 0, cursor: null, loading: true, error: null, started: false });
  const seq = useRef(0);
  const key = JSON.stringify(params);
  const busy = useRef(false);

  const fetchPage = useCallback(
    (cursor, reset) => {
      const my = reset ? ++seq.current : seq.current;
      busy.current = true;
      setState((s) => ({ ...s, loading: true, error: null, ...(reset ? { items: [], cursor: null } : {}) }));
      catalog
        .products({ ...params, limit, cursor: cursor || undefined })
        .then((r) => {
          if (my !== seq.current) return;
          setState((s) => ({
            items: reset ? r.items : [...s.items, ...r.items.filter((x) => !s.items.some((y) => y.id === x.id))],
            total: r.total,
            cursor: r.nextCursor,
            loading: false,
            error: null,
            started: true,
          }));
        })
        .catch((e) => {
          if (my !== seq.current) return;
          setState((s) => ({ ...s, loading: false, error: e, started: true }));
        })
        .finally(() => {
          if (my === seq.current) busy.current = false;
        });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key, limit]
  );

  // প্যারামিটার, ভাষা বা বাজার বদলালে শুরু থেকে
  useEffect(() => {
    fetchPage(null, true);
  }, [fetchPage, lang, market, country]);

  const loadMore = useCallback(() => {
    if (busy.current || state.cursor == null) return;
    fetchPage(state.cursor, false);
  }, [fetchPage, state.cursor]);

  const retry = useCallback(() => fetchPage(state.cursor, state.items.length === 0), [fetchPage, state.cursor, state.items.length]);

  return {
    items: state.items,
    total: state.total,
    loading: state.loading,
    error: state.error,
    started: state.started,
    hasMore: state.cursor != null,
    loadMore,
    retry,
  };
}

export default function ProductGrid({ items = [], loading = false, hasMore = false, error = null, started = true, onLoadMore, onRetry, emptyText, showEnd = true }) {
  const { t, errMsg } = useI18n();
  const sentinel = useRef(null);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasMore || loading || !onLoadMore || !('IntersectionObserver' in window)) return undefined;
    const io = new IntersectionObserver(
      (ents) => {
        if (ents.some((e) => e.isIntersecting)) onLoadMore();
      },
      { rootMargin: '400px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loading, onLoadMore, items.length]);

  if (items.length === 0) {
    if (error) {
      return (
        <div className="empty">
          <span>{errMsg(error)}</span>
          {onRetry && (
            <button type="button" className="btn" onClick={onRetry}>
              {t('common.retry')}
            </button>
          )}
        </div>
      );
    }
    if (loading || !started) return <SkeletonGrid count={9} />;
    return <div className="empty">{emptyText || t('shop.empty')}</div>;
  }

  return (
    <>
      <div className="grid">
        {items.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
      {loading && (
        <div style={{ marginTop: 10 }}>
          <SkeletonGrid count={3} />
        </div>
      )}
      {error && (
        <div className="empty">
          <span>{errMsg(error)}</span>
          {onRetry && (
            <button type="button" className="btn" onClick={onRetry}>
              {t('common.retry')}
            </button>
          )}
        </div>
      )}
      {hasMore && !loading && !error && (
        <>
          <div ref={sentinel} style={{ height: 1 }} />
          {!('IntersectionObserver' in window) && onLoadMore && (
            <button type="button" className="btn btn-block" onClick={onLoadMore}>
              {t('common.loadMore')}
            </button>
          )}
        </>
      )}
      {!hasMore && showEnd && !loading && !error && items.length > 9 && <p className="muted small center" style={{ marginTop: 16 }}>{t('shop.endOfList')}</p>}
    </>
  );
        }
