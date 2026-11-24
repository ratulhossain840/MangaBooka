// FILE: NotFound.jsx
// PATH: client/src/pages/NotFound.jsx (রিপোতে client/src/pages ফোল্ডারের ভেতরে)
// কাজ: ভুল লিংকে "এই পেজটি নেই" দেখায়।

import { Link } from 'react-router-dom';
import { useI18n } from '../i18n/index.js';

export default function NotFound() {
  const { t } = useI18n();
  return (
    <div className="empty">
      <div style={{ fontSize: 48, fontWeight: 800 }}>404</div>
      <b>{t('errors.pageNotFound')}</b>
      <Link to="/" className="btn btn-primary">
        {t('errors.goHome')}
      </Link>
    </div>
  );
}
