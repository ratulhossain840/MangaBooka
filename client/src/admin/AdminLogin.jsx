// FILE: AdminLogin.jsx
// PATH: client/src/admin/AdminLogin.jsx (রিপোতে client/src/admin ফোল্ডারের ভেতরে)
// কাজ: অ্যাডমিন লগইন (ইমেইল + পাসওয়ার্ড, Firebase)। নতুন অ্যাকাউন্ট এখানে খোলা যায় না: Firebase Console → Authentication → Users থেকে বানাতে হয়।
// লগইনের পর কেউ অ্যাডমিন কিনা সার্ভার ঠিক করে (ADMIN_UIDS), এই পেজ শুধু লগইন করায়।

import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { authErrorKey } from '../firebase.js';

const MSG = {
  'auth.errors.invalidEmail': 'ইমেইল ঠিক নয়',
  'auth.errors.wrongCredentials': 'ইমেইল বা পাসওয়ার্ড ভুল',
  'auth.errors.tooMany': 'অনেকবার চেষ্টা হয়েছে, একটু অপেক্ষা করুন',
  'auth.errors.network': 'ইন্টারনেট সংযোগ নেই',
  'auth.errors.disabled': 'এই অ্যাকাউন্ট বন্ধ করা আছে',
  'auth.errors.notConfigured': 'Firebase কনফিগার করা নেই (Render এ VITE_FIREBASE_* দিন)',
};

export default function AdminLogin() {
  const { login, firebaseReady } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setErr('');
    try {
      await login(email, password);
    } catch (ex) {
      setErr(MSG[authErrorKey(ex)] || 'লগইন করা যায়নি, আবার চেষ্টা করুন');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 16 }}>
      <form className="panel stack" onSubmit={submit} style={{ width: '100%', maxWidth: 380, gap: 16 }}>
        <div className="stack" style={{ gap: 4 }}>
          <h1>MangaBooka</h1>
          <span className="muted">অ্যাডমিন লগইন</span>
        </div>

        {!firebaseReady && <div className="alert warn">{MSG['auth.errors.notConfigured']}</div>}

        <div className="field">
          <label htmlFor="ae">ইমেইল</label>
          <input id="ae" className="input" type="email" autoComplete="username" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="ap">পাসওয়ার্ড</label>
          <input id="ap" className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>

        {err && <div className="error-text">{err}</div>}

        <button type="submit" className="btn btn-primary btn-block" disabled={busy || !firebaseReady}>
          {busy ? 'লগইন হচ্ছে…' : 'লগইন'}
        </button>
      </form>
    </div>
  );
    }
