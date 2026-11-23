// FILE: App.jsx
// PATH: client/src/App.jsx (রিপোতে client/src ফোল্ডারের ভেতরে)
// কাজ: ক্রেতার অ্যাপের মূল কাঠামো: Provider গুলো (দেশ/বাজার, লগইন, কার্ট), রাউটার, সব রুট, উপরের বার ও নিচের নেভ বার।
// পেজ ও কম্পোনেন্ট এখনো না থাকলেও বিল্ড ভাঙে না: না পেলে "শীঘ্রই আসছে" দেখায়। ফাইল এলে নিজে থেকেই চালু হয় (ব্যাচ ৯-১৪)।
//
// ফাইলের নাম-চুক্তি (পরের ব্যাচগুলো এটা মানবে):
//   components/Navbar.jsx, BottomNav.jsx, Toast.jsx (default = টোস্ট হোস্ট; named export toast(message, type)), InstallButton.jsx
//   pages/: Home, MangaShop, EbookShop, ProductDetail, Cart, Checkout, OrderSuccess, MyOrders, Login, Register,
//           Library, Profile, Support, StaticPages (prop page="howto|about|faq|terms|privacy|refund|contact"), NotFound,
//           EbookReader, MangaReader (prop index = /content/:id/index এর উত্তর)
// প্রতিটি ফাইলের default export কম্পোনেন্ট। useMarket(), useAuth(), useCart(), useI18n() দিয়ে ডাটা পায়।

import { Suspense, lazy, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation, useParams, Link } from 'react-router-dom';
import { MarketProvider } from './context/MarketContext.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { CartProvider } from './context/CartContext.jsx';
import { content } from './api.js';
import { useI18n } from './i18n/index.js';

// ---- ঐচ্ছিক লোড: ফাইল থাকলে আসে, না থাকলে বাদ ----
const pageLoaders = import.meta.glob('./pages/*.jsx');
const chrome = import.meta.glob('./components/{Navbar,BottomNav,Toast}.jsx', { eager: true });
const pick = (name) => chrome[`./components/${name}.jsx`]?.default;
const Navbar = pick('Navbar');
const BottomNav = pick('BottomNav');
const ToastHost = pick('Toast');

function Soon({ name }) {
  return (
    <div className="empty">
      <b>{name}</b>
      <span className="muted small">Coming soon</span>
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

const Home = page('Home');
const MangaShop = page('MangaShop');
const EbookShop = page('EbookShop');
const ProductDetail = page('ProductDetail');
const Cart = page('Cart');
const Checkout = page('Checkout');
const OrderSuccess = page('OrderSuccess');
const MyOrders = page('MyOrders');
const Login = page('Login');
const Register = page('Register');
const Library = page('Library');
const Profile = page('Profile');
const Support = page('Support');
const StaticPages = page('StaticPages');
const NotFound = page('NotFound');
const EbookReader = page('EbookReader');
const MangaReader = page('MangaReader');

const Loading = () => (
  <div className="page-loading">
    <div className="spinner" />
  </div>
);

// রুট বদলালে উপরে স্ক্রল
function ScrollTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

// কাঠামো: পড়ার পেজে (/read/...) উপরের বার ও নিচের নেভ থাকে না
function Layout() {
  const { pathname } = useLocation();
  const reading = pathname.startsWith('/read/');
  const buybar = /^\/(p|product)\//.test(pathname);
  return (
    <div className="app">
      {!reading && Navbar && <Navbar />}
      <main className={'app-main' + (reading ? ' bare' : '') + (buybar ? ' has-buybar' : '')}>
        <Suspense fallback={<Loading />}>
          <Outlet />
        </Suspense>
      </main>
      {!reading && BottomNav && <BottomNav />}
      {ToastHost && <ToastHost />}
    </div>
  );
}

// /read/:productId — কনটেন্টের ধরন (মাঙ্গা/ই-বুক) দেখে সঠিক রিডার খোলে। এক্সেস না থাকলে সার্ভার 403 দেয়।
function ReadRoute() {
  const { productId } = useParams();
  const { t, errMsg } = useI18n();
  const [state, setState] = useState({ loading: true });

  useEffect(() => {
    let live = true;
    setState({ loading: true });
    content
      .index(productId)
      .then((index) => live && setState({ index }))
      .catch((err) => live && setState({ err }));
    return () => {
      live = false;
    };
  }, [productId]);

  if (state.loading) return <Loading />;
  if (state.err) {
    const denied = state.err.status === 403 || state.err.status === 401;
    return (
      <div className="empty">
        <b>{denied ? t('reader.noAccess') : errMsg(state.err)}</b>
        <Link className="btn btn-primary" to="/library">
          {t('nav.library')}
        </Link>
      </div>
    );
  }
  const Reader = state.index.type === 'manga' ? MangaReader : EbookReader;
  return (
    <Suspense fallback={<Loading />}>
      <Reader index={state.index} />
    </Suspense>
  );
}

export default function App() {
  return (
    <MarketProvider>
      <AuthProvider>
        <CartProvider>
          <BrowserRouter>
            <ScrollTop />
            <Routes>
              <Route element={<Layout />}>
                <Route index element={<Home />} />
                <Route path="manga" element={<MangaShop />} />
                <Route path="ebook" element={<EbookShop />} />
                <Route path="p/:slug" element={<ProductDetail />} />
                <Route path="product/:slug" element={<ProductDetail />} />
                <Route path="cart" element={<Cart />} />
                <Route path="checkout" element={<Checkout />} />
                <Route path="order-success" element={<OrderSuccess />} />
                <Route path="orders" element={<MyOrders />} />
                <Route path="login" element={<Login />} />
                <Route path="register" element={<Register />} />
                <Route path="library" element={<Library />} />
                <Route path="profile" element={<Profile />} />
                <Route path="support" element={<Support />} />
                <Route path="how-to" element={<StaticPages page="howto" />} />
                <Route path="about" element={<StaticPages page="about" />} />
                <Route path="faq" element={<StaticPages page="faq" />} />
                <Route path="terms" element={<StaticPages page="terms" />} />
                <Route path="privacy" element={<StaticPages page="privacy" />} />
                <Route path="refund" element={<StaticPages page="refund" />} />
                <Route path="contact" element={<StaticPages page="contact" />} />
                <Route path="read/:productId" element={<ReadRoute />} />
                <Route path="home" element={<Navigate to="/" replace />} />
                <Route path="*" element={<NotFound />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </CartProvider>
      </AuthProvider>
    </MarketProvider>
  );
        }
