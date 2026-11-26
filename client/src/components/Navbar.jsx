// FILE: Navbar.jsx
// PATH: client/src/components/Navbar.jsx (রিপোতে client/src/components ফোল্ডারের ভেতরে)
// কাজ: উপরের বার: লোগো/নাম (হোমে যায়), ভাষা-দেশ বাটন (শিট খোলে), কার্ট (সংখ্যাসহ)। App.jsx নিজে বসায় (পড়ার পেজে লুকানো)।
// ইনস্টল বাটন ব্যাচ ১০-এ এসে প্রোফাইল ও হোমে বসবে।

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n/index.js';
import { useCart } from '../context/CartContext.jsx';
import LanguagePicker from './LanguagePicker.jsx';

const S = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };

export default function Navbar() {
  const { t, lang } = useI18n();
  const { count } = useCart();
  const [pick, setPick] = useState(false);

  return (
    <header className="topbar">
      <div className="topbar-in">
        <Link to="/" className="brand grow">
          <img src="/icons/logo.svg" alt="" width="30" height="30" />
          {t('app.name')}
        </Link>

        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPick(true)} aria-label={t('nav.language')}>
          <svg width="18" height="18" viewBox="0 0 24 24" {...S} aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" />
          </svg>
          {lang.toUpperCase()}
        </button>

        <Link to="/cart" className="icon-btn" aria-label={t('nav.cart')}>
          <span className="cart-dot">
            <svg width="24" height="24" viewBox="0 0 24 24" {...S} aria-hidden="true">
              <path d="M3 4h2l2.4 11.2a2 2 0 002 1.6h7.6a2 2 0 002-1.5L20.5 8H6" />
              <circle cx="10" cy="20" r="1.3" />
              <circle cx="17" cy="20" r="1.3" />
            </svg>
            {count > 0 && <b>{count}</b>}
          </span>
        </Link>
      </div>
      <LanguagePicker open={pick} onClose={() => setPick(false)} />
    </header>
  );
            }
