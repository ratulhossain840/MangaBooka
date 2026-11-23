// FILE: CartContext.jsx
// PATH: client/src/context/CartContext.jsx (রিপোতে client/src/context ফোল্ডারের ভেতরে)
// কাজ: কার্ট (প্রতিটি প্রোডাক্ট একটাই, সংখ্যা নেই)। ব্রাউজারে সেভ থাকে (localStorage mb_cart)।
// দেশ/ভাষা বদলালে (বাজার বদলালে দামও বদলায়) প্রতিটি প্রোডাক্ট সার্ভার থেকে আবার এনে দাম নতুন করে বসায়;
// যেটা ওই বাজারে পাওয়া যায় না সেটা সরে যায়, আর notice = 'marketChanged' হয় (পেজ cart.marketChanged দেখাবে)।
// সার্ভার অর্ডারের দাম নিজে হিসাব করে, কার্টের দাম শুধু দেখানোর জন্য।
//
// ব্যবহার: const { items, count, has, add, remove, clear, total, currency, orderItems, notice, dismissNotice, syncing } = useCart();
//   add(card)   card = ক্যাটালগের কার্ড বা প্রোডাক্ট (id, slug, type, title, coverUrl, price দরকার)
//   total       সব দামের যোগফল (একই বাজার, তাই একই মুদ্রা); currency = 'BDT' | 'USD'
//   orderItems  orders.create-এ দেওয়ার জন্য [{ productId }]

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { catalog } from '../api.js';
import { useMarket } from './MarketContext.jsx';
import { useI18n } from '../i18n/index.js';

const KEY = 'mb_cart';
const Ctx = createContext(null);

const snap = (c) => ({
  id: c.id,
  slug: c.slug,
  type: c.type,
  title: c.title || '',
  coverUrl: c.coverUrl || '',
  price: c.price ? { currency: c.price.currency, base: c.price.base, final: c.price.final, percentOff: c.price.percentOff || 0, onSale: !!c.price.onSale } : null,
});

function load() {
  try {
    const a = JSON.parse(window.localStorage.getItem(KEY) || '[]');
    return Array.isArray(a) ? a.filter((x) => x && x.id && x.slug && x.price) : [];
  } catch {
    return [];
  }
}

export function CartProvider({ children }) {
  const { market, currency } = useMarket();
  const { lang } = useI18n();
  const [items, setItems] = useState(load);
  const [notice, setNotice] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const first = useRef(true);

  useEffect(() => {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(items));
    } catch {
      /* ignore */
    }
  }, [items]);

  // অন্য ট্যাবে কার্ট বদলালে এখানেও নেওয়া
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === KEY) setItems(load());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const add = useCallback((card) => {
    if (!card || !card.id || !card.price) return;
    setItems((cur) => (cur.some((x) => x.id === card.id) ? cur : [...cur, snap(card)]));
  }, []);
  const remove = useCallback((id) => setItems((cur) => cur.filter((x) => x.id !== id)), []);
  const clear = useCallback(() => setItems([]), []);
  const has = useCallback((id) => items.some((x) => x.id === id), [items]);

  // বাজার বা ভাষা বদলালে দাম ও নাম নতুন করে আনা (প্রথমবার শুধু তখনই, যদি সেভ করা দামের মুদ্রা এখনকার বাজারের সাথে না মেলে)
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const seq = useRef(0);
  useEffect(() => {
    const cur = itemsRef.current;
    if (!cur.length) {
      first.current = false;
      return;
    }
    const stale = cur.some((x) => x.price.currency !== currency);
    if (first.current && !stale) {
      first.current = false;
      return;
    }
    first.current = false;
    const my = ++seq.current;
    setSyncing(true);
    Promise.all(
      cur.map((x) =>
        catalog
          .product(x.slug)
          .then((r) => ({ old: x, p: r.product }))
          .catch((e) => ({ old: x, p: null, gone: e && (e.status === 404 || e.status === 403) }))
      )
    ).then((res) => {
      if (my !== seq.current) return;
      let changed = false;
      const next = [];
      for (const r of res) {
        if (r.p) {
          const n = snap(r.p);
          if (!r.old.price || r.old.price.currency !== n.price.currency || r.old.price.final !== n.price.final) changed = true;
          next.push(n);
        } else if (r.gone) {
          changed = true; // এই বাজারে নেই, বাদ
        } else {
          next.push(r.old); // নেট সমস্যা: পুরনোটাই রাখি
        }
      }
      setItems(next);
      if (changed) setNotice('marketChanged');
      setSyncing(false);
    });
  }, [market, currency, lang]);

  const dismissNotice = useCallback(() => setNotice(null), []);

  const value = useMemo(() => {
    const cur = items.find((x) => x.price)?.price.currency || currency;
    return {
      items,
      count: items.length,
      has,
      add,
      remove,
      clear,
      total: items.reduce((s, x) => s + (Number(x.price.final) || 0), 0),
      baseTotal: items.reduce((s, x) => s + (Number(x.price.base) || 0), 0),
      currency: cur,
      orderItems: items.map((x) => ({ productId: x.id })),
      notice,
      dismissNotice,
      syncing,
    };
  }, [items, has, add, remove, clear, currency, notice, dismissNotice, syncing]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useCart must be used inside <CartProvider>');
  return v;
      }
