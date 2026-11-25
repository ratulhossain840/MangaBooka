// FILE: Layout.jsx
// PATH: client/src/admin/components/Layout.jsx (রিপোতে client/src/admin/components ফোল্ডারের ভেতরে; ফোল্ডার না থাকলে components/.gitkeep দিয়ে বানান)
// কাজ: অ্যাডমিনের কাঠামো: উপরে নাম ও লগআউট, নিচে ৪টি প্রধান ট্যাব (ড্যাশবোর্ড, অর্ডার, প্রোডাক্ট, সাপোর্ট) + "আরও" (অফার, লিংক, সেটিংস, অনুবাদ)।
// অপেক্ষার অর্ডার ও খোলা সাপোর্টের সংখ্যা ব্যাজে দেখায় (প্রতি ৬০ সেকেন্ডে নতুন করে আনে)।
// AdminApp.jsx এটা নিজে ব্যবহার করে (প্রপ: user, onLogout)।

import { Suspense, useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { adm } from '../adminApi.js';

const S = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };
const ICON = {
  home: <path d="M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10" />,
  orders: (
    <>
      <path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" />
      <path d="M9 8h6M9 12h6" />
    </>
  ),
  products: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M9 3v18" />
    </>
  ),
  support: <path d="M4 5h16v11H9l-5 4z" />,
  more: (
    <>
      <circle cx="5" cy="12" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="19" cy="12" r="1.5" />
    </>
  ),
};

const TABS = [
  ['/', 'ড্যাশবোর্ড', 'home', true],
  ['/orders', 'অর্ডার', 'orders'],
  ['/products', 'প্রোডাক্ট', 'products'],
  ['/support', 'সাপোর্ট', 'support'],
];
const MORE = [
  ['/offers', 'অফার ও ছাড়'],
  ['/links', 'লিংক ও বিজ্ঞাপন'],
  ['/settings', 'সেটিংস'],
  ['/translate', 'অনুবাদের অবস্থা'],
];

const CSS = `
.adm-bn{position:fixed;left:0;right:0;bottom:0;z-index:40;height:calc(var(--bottom-nav-h) + var(--safe-bottom));padding-bottom:var(--safe-bottom);background:var(--bg-2);border-top:1px solid var(--border);display:flex}
.adm-bn a,.adm-bn button{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;font-size:11px;color:var(--text-3);background:transparent;border:0;position:relative}
.adm-bn a.active,.adm-bn button.on{color:var(--accent)}
.adm-bn svg{width:22px;height:22px}
.adm-badge{position:absolute;top:6px;left:calc(50% + 6px);min-width:17px;height:17px;padding:0 4px;border-radius:999px;background:var(--sale);color:#fff;font-size:11px;display:grid;place-items:center}
.adm-back{position:fixed;inset:0;z-index:80;background:rgba(0,0,0,.55);display:flex;align-items:flex-end;justify-content:center}
.adm-sheet{width:100%;max-width:var(--max-w);background:var(--bg-2);border:1px solid var(--border);border-bottom:0;border-radius:var(--radius-l) var(--radius-l) 0 0;padding:16px var(--pad) calc(var(--pad) + var(--safe-bottom));display:flex;flex-direction:column;gap:8px}
.adm-sheet a{display:block;padding:14px;border-radius:var(--radius);background:var(--surface);color:var(--text);font-weight:600}
`;

export default function Layout({ user, onLogout }) {
  const [counts, setCounts] = useState({ orders: 0, tickets: 0 });
  const [more, setMore] = useState(false);
  const loc = useLocation();

  useEffect(() => {
    let live = true;
    const pull = () =>
      adm
        .get('/dashboard')
        .then((d) => live && setCounts({ orders: d.pendingOrders || 0, tickets: d.openTickets || 0 }))
        .catch(() => {});
    pull();
    const id = setInterval(pull, 60000);
    return () => {
      live = false;
      clearInterval(id);
    };
  }, []);

  useEffect(() => setMore(false), [loc.pathname]);
  const moreActive = MORE.some(([to]) => loc.pathname.startsWith('/' + to.slice(1)) && to !== '/');
  const badge = { '/orders': counts.orders, '/support': counts.tickets };

  return (
    <div className="app">
      <style>{CSS}</style>
      <header className="topbar">
        <div className="topbar-in">
          <b className="brand grow">MangaBooka Admin</b>
          <span className="muted small" style={{ maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user && user.email}
          </span>
          <button type="button" className="btn btn-sm btn-ghost" onClick={onLogout}>
            লগআউট
          </button>
        </div>
      </header>

      <main className="app-main">
        <Suspense fallback={<div className="page-loading"><div className="spinner" /></div>}>
          <Outlet />
        </Suspense>
      </main>

      <nav className="adm-bn" aria-label="অ্যাডমিন মেনু">
        {TABS.map(([to, label, icon, end]) => (
          <NavLink key={to} to={to} end={!!end} className={({ isActive }) => (isActive ? 'active' : '')}>
            <svg viewBox="0 0 24 24" {...S} aria-hidden="true">
              {ICON[icon]}
            </svg>
            <span>{label}</span>
            {badge[to] > 0 && <b className="adm-badge">{badge[to]}</b>}
          </NavLink>
        ))}
        <button type="button" className={moreActive || more ? 'on' : ''} onClick={() => setMore(true)}>
          <svg viewBox="0 0 24 24" {...S} aria-hidden="true">
            {ICON.more}
          </svg>
          <span>আরও</span>
        </button>
      </nav>

      {more && (
        <div className="adm-back" onClick={() => setMore(false)}>
          <div className="adm-sheet" onClick={(e) => e.stopPropagation()}>
            {MORE.map(([to, label]) => (
              <NavLink key={to} to={to}>
                {label}
              </NavLink>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
