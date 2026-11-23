// FILE: BottomNav.jsx
// PATH: client/src/components/BottomNav.jsx (রিপোতে client/src/components ফোল্ডারের ভেতরে)
// কাজ: নিচের ফিক্সড বার: হোম, মাঙ্গা, ই-বুক, লাইব্রেরি, প্রোফাইল। App.jsx নিজে বসায় (পড়ার পেজে লুকানো)।

import { NavLink } from 'react-router-dom';
import { useI18n } from '../i18n/index.js';

const S = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };
const ICONS = {
  home: <path d="M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10" />,
  manga: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M9 3v18M13 8h4M13 12h4" />
    </>
  ),
  ebook: (
    <>
      <path d="M4 4.5A2.5 2.5 0 016.5 2H20v17H6.5A2.5 2.5 0 004 21.5z" />
      <path d="M4 21.5V4.5M9 7h7" />
    </>
  ),
  library: <path d="M4 4v16M9 4v16M14 6l4 13.5M19 5l-3 .8" />,
  profile: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 3.5-6 8-6s8 2 8 6" />
    </>
  ),
};

const TABS = [
  ['/', 'home', 'nav.home', true],
  ['/manga', 'manga', 'nav.manga', false],
  ['/ebook', 'ebook', 'nav.ebook', false],
  ['/library', 'library', 'nav.library', false],
  ['/profile', 'profile', 'nav.profile', false],
];

export default function BottomNav() {
  const { t } = useI18n();
  return (
    <nav className="bottom-nav" aria-label="Main">
      {TABS.map(([to, icon, label, end]) => (
        <NavLink key={to} to={to} end={end} className={({ isActive }) => (isActive ? 'active' : '')}>
          <svg viewBox="0 0 24 24" {...S} aria-hidden="true">
            {ICONS[icon]}
          </svg>
          <span>{t(label)}</span>
        </NavLink>
      ))}
    </nav>
  );
}
