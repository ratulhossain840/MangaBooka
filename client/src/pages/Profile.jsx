// FILE: Profile.jsx
// PATH: client/src/pages/Profile.jsx (রিপোতে client/src/pages ফোল্ডারের ভেতরে)
// কাজ: প্রোফাইল: লগইন/রেজিস্টার বা (লগইনে) ইমেইল + লগআউট; ভাষা ও দেশ; অ্যাপ ইনস্টল; আমার অর্ডার, সাপোর্ট; তথ্যের পেজের লিংক।

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n, LANG_NAMES } from '../i18n/index.js';
import { useMarket } from '../context/MarketContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import LanguagePicker from '../components/LanguagePicker.jsx';
import InstallButton from '../components/InstallButton.jsx';
import PushToggle from '../components/PushToggle.jsx';

const INFO = [
  ['/how-to', 'pages.howto.title'],
  ['/faq', 'pages.faq.title'],
  ['/about', 'pages.about.title'],
  ['/terms', 'pages.terms.title'],
  ['/privacy', 'pages.privacy.title'],
  ['/refund', 'pages.refund.title'],
  ['/contact', 'pages.contact.title'],
];

export default function Profile() {
  const { t, lang } = useI18n();
  const { countryKey } = useMarket();
  const { user, loggedIn, ready, logout } = useAuth();
  const [pick, setPick] = useState(false);

  return (
    <div className="stack" style={{ gap: 16 }}>
      <h1>{t('profile.title')}</h1>

      <div className="panel stack">
        {!ready ? null : loggedIn ? (
          <>
            <b style={{ wordBreak: 'break-all' }}>{user.email}</b>
            <button type="button" className="btn btn-sm" onClick={() => logout()}>
              {t('nav.logout')}
            </button>
          </>
        ) : (
          <>
            <b>{t('profile.loggedOutTitle')}</b>
            <span className="muted small">{t('profile.loggedOutSub')}</span>
            <div className="row">
              <Link to="/login" className="btn btn-primary grow">
                {t('auth.login')}
              </Link>
              <Link to="/register" className="btn grow">
                {t('auth.register')}
              </Link>
            </div>
          </>
        )}
      </div>

      <section className="panel stack">
        <b>{t('profile.settings')}</b>
        <button type="button" className="btn row between" onClick={() => setPick(true)}>
          <span>{t('nav.language')}: {LANG_NAMES[lang]}</span>
          <span className="muted">{countryKey ? t('market.countries.' + countryKey) : t('nav.country')}</span>
        </button>
        <InstallButton />
        <PushToggle />
      </section>

      <section className="stack">
        <Link to="/orders" className="btn">
          {t('nav.orders')}
        </Link>
        <Link to="/support" className="btn">
          {t('nav.support')}
        </Link>
      </section>

      <section className="stack">
        <b>{t('profile.help')}</b>
        <div className="row wrap">
          {INFO.map(([to, label]) => (
            <Link key={to} to={to} className="chip">
              {t(label)}
            </Link>
          ))}
        </div>
      </section>

      <LanguagePicker open={pick} onClose={() => setPick(false)} />
    </div>
  );
      }
