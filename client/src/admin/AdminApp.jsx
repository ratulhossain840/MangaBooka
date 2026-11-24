// FILE: AdminApp.jsx
// PATH: client/src/admin/AdminApp.jsx (রিপোতে client/src/admin ফোল্ডারের ভেতরে)
// কাজ: অ্যাডমিন অ্যাপের কাঠামো: লগইন না থাকলে লগইন পেজ; লগইন থাকলে সার্ভারকে জিজ্ঞাসা (GET /api/admin/me) সে অ্যাডমিন কিনা।
// অ্যাডমিন না হলে নিজের UID দেখায় (কপি করে Render এ ADMIN_UIDS এ বসাতে হবে)। অ্যাডমিন হলে সব রুট।
// পেজ ও লেআউট এখনো না থাকলেও বিল্ড ভাঙে না: না থাকলে "শীঘ্রই আসছে" ও সাধারণ মেনু দেখায়। ফাইল আসলে নিজে চালু হয় (ব্যাচ ১৬-১৮)।
//
// ফাইলের নাম-চুক্তি (পরের ব্যাচ মানবে), সব default export:
//   components/Layout.jsx  — Layout({ user, onLogout }) ভেতরে <Outlet />; HelpHint.jsx, Charts.jsx, ImageUploader.jsx, ChapterUploader.jsx, EbookEditor.jsx
//   pages/: Dashboard, Orders, Support, Products, ProductForm, Offers, LinksAds, Settings, TranslateStatus
// রুট (ঠিকানা /admin/...): / Dashboard, /orders, /support, /products, /products/new ও /products/:id → ProductForm, /offers, /links, /settings, /translate

import { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Outlet, NavLink, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '../context/AuthContext.jsx';
import { adm, admErr } from './adminApi.js';
import AdminLogin from './AdminLogin.jsx';

const pageLoaders = import.meta.glob('./pages/*.jsx');
const comps = import.meta.glob('./components/Layout.jsx', { eager: true });
const ExtLayout = comps['./components/Layout.jsx']?.default;

function Soon({ name }) {
  return (
    <div className="empty">
      <b>{name}</b>
      <span className="muted small">শীঘ্রই আসছে</span>
    </div>
  );
}
function page(name) {
  const load = pageLoaders[`./pages/${name}.jsx`];
  if (load) return lazy(load);
  return function Missing() {
    return <Soon name={name} />;
  };
}
const Dashboard = page('Dashboard');
const Orders = page('Orders');
const Support = page('Support');
const Products = page('Products');
const ProductForm = page('ProductForm');
const Offers = page('Offers');
const LinksAds = page('LinksAds');
const Settings = page('Settings');
const TranslateStatus = page('TranslateStatus');

const NAV = [
  ['/', 'ড্যাশবোর্ড', true],
  ['/orders', 'অর্ডার'],
  ['/products', 'প্রোডাক্ট'],
  ['/support', 'সাপোর্ট'],
  ['/offers', 'অফার'],
  ['/links', 'লিংক ও বিজ্ঞাপন'],
  ['/settings', 'সেটিংস'],
  ['/translate', 'অনুবাদ'],
];

const Loading = () => (
  <div className="page-loading">
    <div className="spinner" />
  </div>
);

// Layout.jsx (ব্যাচ ১৬) না আসা পর্যন্ত সাধারণ মেনু
function FallbackLayout({ user, onLogout }) {
  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-in">
          <b className="brand grow">Admin</b>
          <span className="muted small" style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.email}</span>
          <button type="button" className="btn btn-sm btn-ghost" onClick={onLogout}>
            লগআউট
          </button>
        </div>
      </header>
      <nav className="chips" style={{ padding: '10px 16px 0', maxWidth: 'var(--max-w)', margin: '0 auto', width: '100%' }}>
        {NAV.map(([to, label, end]) => (
          <NavLink key={to} to={to} end={!!end} className={({ isActive }) => 'chip' + (isActive ? ' active' : '')}>
            {label}
          </NavLink>
        ))}
      </nav>
      <main className="app-main" style={{ paddingBottom: 'var(--pad)' }}>
        <Suspense fallback={<Loading />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}

function NotAdmin({ user, onLogout }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(user.uid);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }
  return (
    <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 16 }}>
      <div className="panel stack" style={{ width: '100%', maxWidth: 420 }}>
        <h2>আপনি অ্যাডমিন হিসেবে যুক্ত নন</h2>
        <p className="muted small">
          নিজেকে অ্যাডমিন করতে নিচের UID কপি করে Render → আপনার সার্ভিস → Environment এ <b>ADMIN_UIDS</b> এর মানে বসান (একাধিক হলে কমা দিয়ে), সেভ করে ডিপ্লয় শেষ হলে আবার লগইন করুন।
        </p>
        <div className="code-box">{user.uid}</div>
        <button type="button" className="btn" onClick={copy}>
          {copied ? 'কপি হয়েছে' : 'UID কপি করুন'}
        </button>
        <span className="hint">{user.email}</span>
        <button type="button" className="btn btn-ghost" onClick={onLogout}>
          লগআউট
        </button>
      </div>
    </div>
  );
}

function Gate() {
  const { user, ready, logout } = useAuth();
  const [state, setState] = useState({ s: 'checking' }); // checking | ok | denied | error

  const check = useCallback(async () => {
    setState({ s: 'checking' });
    try {
      await adm.get('/me');
      setState({ s: 'ok' });
    } catch (e) {
      if (e.status === 403) setState({ s: 'denied' });
      else setState({ s: 'error', msg: admErr(e) });
    }
  }, []);

  useEffect(() => {
    if (user) check();
  }, [user && user.uid]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!ready) return <Loading />;
  if (!user) return <AdminLogin />;
  if (state.s === 'checking') return <Loading />;
  if (state.s === 'denied') return <NotAdmin user={user} onLogout={logout} />;
  if (state.s === 'error') {
    return (
      <div className="empty" style={{ minHeight: '100dvh', justifyContent: 'center' }}>
        <span>{state.msg}</span>
        <button type="button" className="btn btn-primary" onClick={check}>
          আবার চেষ্টা করুন
        </button>
        <button type="button" className="btn btn-ghost" onClick={logout}>
          লগআউট
        </button>
      </div>
    );
  }

  const Layout = ExtLayout || FallbackLayout;
  return (
    <Routes>
      <Route element={<Layout user={user} onLogout={logout} />}>
        <Route index element={<Dashboard />} />
        <Route path="orders" element={<Orders />} />
        <Route path="support" element={<Support />} />
        <Route path="products" element={<Products />} />
        <Route path="products/new" element={<ProductForm />} />
        <Route path="products/:id" element={<ProductForm />} />
        <Route path="offers" element={<Offers />} />
        <Route path="links" element={<LinksAds />} />
        <Route path="settings" element={<Settings />} />
        <Route path="translate" element={<TranslateStatus />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default function AdminApp() {
  return (
    <AuthProvider>
      <BrowserRouter basename="/admin">
        <Gate />
      </BrowserRouter>
    </AuthProvider>
  );
      }
