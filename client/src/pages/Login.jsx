// FILE: Login.jsx
// PATH: client/src/pages/Login.jsx (রিপোতে client/src/pages ফোল্ডারের ভেতরে)
// কাজ: ইমেইল/পাসওয়ার্ড লগইন + পাসওয়ার্ড রিসেট। লগইন ঐচ্ছিক (গেস্টও কিনতে পারে)। ?next=/পাথ থাকলে লগইনের পর সেখানে যায়।

import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useI18n } from '../i18n/index.js';
import { useAuth } from '../context/AuthContext.jsx';

export const safeNext = (v) => (typeof v === 'string' && /^\/(?!\/)/.test(v) ? v : '/');

export default function Login() {
  const { t } = useI18n();
  const { loggedIn, ready, firebaseReady, login, reset, authMessage } = useAuth();
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const next = safeNext(sp.get('next'));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [info, setInfo] = useState('');

  if (ready && loggedIn) return <Navigate to={next} replace />;

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setErr('');
    setInfo('');
    try {
      await login(email, password);
      nav(next, { replace: true });
    } catch (ex) {
      setErr(authMessage(ex));
    } finally {
      setBusy(false);
    }
  }

  async function forgot() {
    setErr('');
    setInfo('');
    try {
      await reset(email);
      setInfo(t('auth.resetSent'));
    } catch (ex) {
      setErr(authMessage(ex));
    }
  }

  return (
    <form className="stack" onSubmit={submit} style={{ gap: 16 }}>
      <h1>{t('auth.login')}</h1>
      <p className="muted small">{t('auth.optionalNote')}</p>
      {!firebaseReady && <div className="alert warn">{t('auth.errors.notConfigured')}</div>}

      <div className="field">
        <label htmlFor="email">{t('auth.email')}</label>
        <input id="email" className="input" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <div className="field">
        <label htmlFor="pw">{t('auth.password')}</label>
        <input id="pw" className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </div>

      {err && <div className="error-text">{err}</div>}
      {info && <div className="alert ok">{info}</div>}

      <button type="submit" className="btn btn-primary btn-block" disabled={busy || !firebaseReady}>
        {busy ? t('common.loading') : t('auth.login')}
      </button>
      <button type="button" className="btn btn-ghost btn-block" onClick={forgot} disabled={!firebaseReady || !email}>
        {t('auth.forgot')}
      </button>
      <p className="center muted">
        {t('auth.noAccount')}{' '}
        <Link to={'/register' + (next !== '/' ? '?next=' + encodeURIComponent(next) : '')}>{t('auth.register')}</Link>
      </p>
    </form>
  );
}
