// FILE: StaticPages.jsx
// PATH: client/src/pages/StaticPages.jsx (রিপোতে client/src/pages ফোল্ডারের ভেতরে)
// কাজ: তথ্যের পেজ: কীভাবে কিনবেন, আমাদের সম্পর্কে, প্রশ্নোত্তর, শর্ত, গোপনীয়তা, টাকা ফেরত, যোগাযোগ।
// লেখা সব i18n ফাইলের pages.* থেকে আসে (৬ ভাষায়)। App.jsx প্রতিটি রুটে page="howto|about|faq|terms|privacy|refund|contact" দেয়।
// শর্ত/গোপনীয়তা/ফেরতের লেখা ডিফল্ট খসড়া, মালিককে দেখে ঠিক করতে হবে (ভাষা ফাইলে)।

import { Link } from 'react-router-dom';
import { useI18n } from '../i18n/index.js';
import NotFound from './NotFound.jsx';

const PAGES = ['howto', 'about', 'faq', 'terms', 'privacy', 'refund', 'contact'];
const PATHS = { howto: '/how-to', about: '/about', faq: '/faq', terms: '/terms', privacy: '/privacy', refund: '/refund', contact: '/contact' };
const asList = (v) => (Array.isArray(v) ? v : []);

export default function StaticPages({ page }) {
  const { t } = useI18n();
  if (!PAGES.includes(page)) return <NotFound />;
  const key = 'pages.' + page;

  let body;
  if (page === 'howto') {
    body = (
      <ol className="stack" style={{ margin: 0, paddingLeft: 22, gap: 10 }}>
        {asList(t(key + '.steps')).map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ol>
    );
  } else if (page === 'faq') {
    body = (
      <div className="stack">
        {asList(t(key + '.items')).map((it, i) => (
          <details key={i} className="panel">
            <summary style={{ fontWeight: 600, cursor: 'pointer' }}>{it.q}</summary>
            <p className="muted" style={{ marginTop: 8 }}>
              {it.a}
            </p>
          </details>
        ))}
      </div>
    );
  } else if (page === 'terms' || page === 'privacy' || page === 'refund') {
    body = (
      <ul className="stack" style={{ margin: 0, paddingLeft: 20, gap: 10 }}>
        {asList(t(key + '.items')).map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ul>
    );
  } else {
    body = (
      <div className="stack">
        <p>{t(key + '.body')}</p>
        {page === 'contact' && (
          <Link to="/support" className="btn btn-primary">
            {t('nav.support')}
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="stack" style={{ gap: 18 }}>
      <h1>{t(key + '.title')}</h1>
      {body}
      <div className="divider" />
      <div className="row wrap">
        {PAGES.filter((p) => p !== page).map((p) => (
          <Link key={p} to={PATHS[p]} className="chip">
            {t('pages.' + p + '.title')}
          </Link>
        ))}
      </div>
    </div>
  );
}
