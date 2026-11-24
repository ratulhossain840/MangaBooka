// FILE: Register.jsx
// PATH: client/src/pages/Register.jsx (রিপোতে client/src/pages ফোল্ডারের ভেতরে)
// কাজ: ইমেইল/পাসওয়ার্ড দিয়ে অ্যাকাউন্ট খোলা (ঐচ্ছিক; সব ডিভাইসে লাইব্রেরি পাওয়ার জন্য)। ?next= মানে।

import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useI18n } from '../i18n/index.js';
import { useAuth } from '../context/AuthContext.jsx';
import { safeNext } from './Login.jsx';

export default function Register() {
  const { t } = useI18n();
  const { loggedIn, ready, firebaseReady, register, authMessage } = useAuth();
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const next = safeNext(sp.get('next'));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  if (ready && loggedIn) return <Navigate to={next} replace />;

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setErr('');
    if (password !== confirm) {
      setErr(t('auth.errors.passwordMismatch'));
      return;
    }
    setBusy(true);
    try {
      await register(email, password);
      nav(next, { replace: true });
    } catch (ex) {
      setErr(authMessage(ex));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="stack" onSubmit={submit} style={{ gap: 16 }}>
      <h1>{t('auth.register')}</h1>
      <p className="muted small">{t('auth.optionalNote')}</p>
      {!firebaseReady && <div className="alert warn">{t('auth.errors.notConfigured')}</div>}

      <div className="field">
        <label htmlFor="email">{t('auth.email')}</label>
        <input id="email" className="input" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <div className="field">
        <label htmlFor="pw">{t('auth.password')}</label>
        <input id="pw" className="input" type="password" autoComplete="new-password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required />
      </div>
      <div className="field">
        <label htmlFor="pw2">{t('auth.confirmPassword')}</label>
        <input id="pw2" className="input" type="password" autoComplete="new-password" minLength={6} value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
      </div>

      {err && <div className="error-text">{err}</div>}

      <button type="submit" className="btn btn-primary btn-block" disabled={busy || !firebaseReady}>
        {busy ? t('common.loading') : t('auth.register')}
      </button>
      <p className="center muted">
        {t('auth.haveAccount')}{' '}
        <Link to={'/login' + (next !== '/' ? '?next=' + encodeURIComponent(next) : '')}>{t('auth.login')}</Link>
      </p>
    </form>
  );
      }
