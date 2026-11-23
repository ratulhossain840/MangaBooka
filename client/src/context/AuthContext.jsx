// FILE: AuthContext.jsx
// PATH: client/src/context/AuthContext.jsx (রিপোতে client/src/context ফোল্ডারের ভেতরে)
// কাজ: লগইন করা ইউজার (ঐচ্ছিক লগইন, গেস্ট কেনাকাটাও চলে)। লগইন/রেজিস্টার/লগআউট/পাসওয়ার্ড রিসেট।
// ব্যবহার: const { user, ready, loggedIn, login, register, logout, reset, authMessage, firebaseReady } = useAuth();
//   ready = Firebase প্রথমবার জানিয়েছে ইউজার আছে কিনা (তার আগে "লগইন নেই" ধরে নিয়ে পেজ আঁকলে ঝলকানি হয়, তাই ready দেখে নিও)
//   authMessage(err) = ত্রুটি থেকে বর্তমান ভাষার বার্তা (auth.errors.*)

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { firebaseReady, onUser, login as fbLogin, register as fbRegister, logout as fbLogout, resetPassword, authErrorKey } from '../firebase.js';
import { t } from '../i18n/index.js';

const Ctx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const off = onUser((u) => {
      setUser(u ? { uid: u.uid, email: u.email || '' } : null);
      setReady(true);
    });
    return off;
  }, []);

  const login = useCallback((email, password) => fbLogin(email, password), []);
  const register = useCallback((email, password) => fbRegister(email, password), []);
  const logout = useCallback(() => fbLogout(), []);
  const reset = useCallback((email) => resetPassword(email), []);
  const authMessage = useCallback((err) => t(authErrorKey(err)), []);

  const value = useMemo(
    () => ({ user, ready, loggedIn: !!user, firebaseReady, login, register, logout, reset, authMessage }),
    [user, ready, login, register, logout, reset, authMessage]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth must be used inside <AuthProvider>');
  return v;
  }
