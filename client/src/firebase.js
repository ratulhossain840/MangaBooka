// FILE: firebase.js
// PATH: client/src/firebase.js (রিপোতে client/src ফোল্ডারের ভেতরে)
// কাজ: Firebase Auth (শুধু ইমেইল/পাসওয়ার্ড লগইন)। ডাটাবেস ব্রাউজার থেকে কখনো ছোঁয়া হয় না, সব ডাটা সার্ভারের API দিয়ে আসে।
// VITE_FIREBASE_* না থাকলে অ্যাপ ভাঙে না: firebaseReady = false হয়ে লগইন বন্ধ থাকে, গেস্ট কেনাকাটা চলে।

import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
} from 'firebase/auth';

const cfg = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const firebaseReady = !!(cfg.apiKey && cfg.authDomain && cfg.projectId && cfg.appId);

const app = firebaseReady ? getApps()[0] || initializeApp(cfg) : null;
export const auth = app ? getAuth(app) : null;

if (!firebaseReady) {
  console.warn('[firebase] VITE_FIREBASE_* সেট নেই, লগইন বন্ধ থাকবে');
}

// বর্তমান ইউজার (লগইন না থাকলে null)
export const currentUser = () => (auth ? auth.currentUser : null);

// লগইন অবস্থা বদলালে cb(user | null) ডাকে। ফেরত দেয় বন্ধ করার ফাংশন।
// Firebase না থাকলে সাথে সাথে একবার cb(null) ডেকে ছেড়ে দেয়।
export function onUser(cb) {
  if (!auth) {
    cb(null);
    return () => {};
  }
  return onAuthStateChanged(auth, (u) => cb(u || null));
}

// সার্ভারে পাঠানোর ID টোকেন (Firebase নিজে মেয়াদ ফুরালে নতুন করে নেয়)। লগইন না থাকলে null।
export async function getIdToken(forceRefresh = false) {
  if (!auth || !auth.currentUser) return null;
  try {
    return await auth.currentUser.getIdToken(forceRefresh);
  } catch {
    return null;
  }
}

function need() {
  if (!auth) {
    const e = new Error('firebase_not_configured');
    e.code = 'app/not-configured';
    throw e;
  }
  return auth;
}

export async function login(email, password) {
  const cred = await signInWithEmailAndPassword(need(), String(email).trim(), password);
  return cred.user;
}

export async function register(email, password) {
  const cred = await createUserWithEmailAndPassword(need(), String(email).trim(), password);
  return cred.user;
}

export async function logout() {
  if (auth) await signOut(auth);
}

export async function resetPassword(email) {
  await sendPasswordResetEmail(need(), String(email).trim());
}

// Firebase-এর ইমেইল (পাসওয়ার্ড রিসেট ইত্যাদি) কোন ভাষায় যাবে
export function setAuthLanguage(code) {
  if (auth && code) auth.languageCode = code;
}

// ত্রুটির কোড -> i18n কী (auth.errors.*)
export function authErrorKey(err) {
  const c = (err && err.code) || '';
  if (c === 'app/not-configured') return 'auth.errors.notConfigured';
  if (c === 'auth/invalid-email') return 'auth.errors.invalidEmail';
  if (c === 'auth/weak-password') return 'auth.errors.weakPassword';
  if (c === 'auth/email-already-in-use') return 'auth.errors.emailInUse';
  if (c === 'auth/too-many-requests') return 'auth.errors.tooMany';
  if (c === 'auth/network-request-failed') return 'auth.errors.network';
  if (c === 'auth/user-disabled') return 'auth.errors.disabled';
  if (
    c === 'auth/invalid-credential' ||
    c === 'auth/wrong-password' ||
    c === 'auth/user-not-found' ||
    c === 'auth/invalid-login-credentials'
  )
    return 'auth.errors.wrongCredentials';
  return 'auth.errors.generic';
  }
