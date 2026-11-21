// FILE: main.jsx
// PATH: client/src/main.jsx (রিপোতে client/src ফোল্ডারের ভেতরে)
// কাজ: ক্রেতার অ্যাপ চালু করে। সার্ভিস ওয়ার্কার রেজিস্টার করে, ইনস্টল বাটনের ইভেন্ট আগেই ধরে রাখে,
// ত্রুটি হলে সাদা পর্দার বদলে "আবার চেষ্টা" পর্দা দেখায়।
//
// গুরুত্বপূর্ণ: ব্যাচ ৬-৮ এর ফাইলগুলো (i18n, styles, App) আসার আগেও যেন Render-এর বিল্ড না ভাঙে,
// তাই সেগুলো import.meta.glob দিয়ে "থাকলে লোড" পদ্ধতিতে আনা হয়েছে। ব্যাচ ৮ শেষ হলে এগুলো নিজে থেকেই চালু হবে।

import React from 'react';
import { createRoot } from 'react-dom/client';

// ---- ব্যাচ ৬-৮ এর ফাইল (থাকলে লোড হবে, না থাকলে চুপচাপ বাদ) ----
import.meta.glob('./i18n/index.js', { eager: true }); // ব্যাচ ৬
import.meta.glob('./styles/theme.css', { eager: true }); // ব্যাচ ৮
import.meta.glob('./styles/global.css', { eager: true }); // ব্যাচ ৮
const appModules = import.meta.glob('./App.jsx', { eager: true }); // ব্যাচ ৮
const App = Object.values(appModules)[0]?.default;

// ---- ইনস্টল (Add to Home screen) ইভেন্ট ----
// ব্রাউজার এটা একবারই ছোড়ে, কম্পোনেন্ট লোডের আগেই আসতে পারে, তাই এখানেই ধরে রাখা হয়।
// InstallButton (ব্যাচ ১০) window.__installPrompt পড়বে এবং 'mb-install-ready' ইভেন্ট শুনবে।
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  window.__installPrompt = e;
  window.dispatchEvent(new Event('mb-install-ready'));
});
window.addEventListener('appinstalled', () => {
  window.__installPrompt = null;
  window.dispatchEvent(new Event('mb-installed'));
});

// ---- ত্রুটি হলে ফাঁকা পর্দা নয় ----
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error, info) {
    console.error('[app]', error, info && info.componentStack);
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div style={boxStyle}>
        <b style={{ fontSize: 20 }}>কিছু একটা ভুল হয়েছে</b>
        <span style={{ opacity: 0.7 }}>Something went wrong</span>
        <button style={btnStyle} onClick={() => window.location.reload()}>
          আবার চেষ্টা করুন
        </button>
      </div>
    );
  }
}

const boxStyle = {
  minHeight: '100dvh',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 12,
  background: '#0b0b10',
  color: '#e8e8f0',
  fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans Bengali", sans-serif',
  textAlign: 'center',
  padding: 24,
};
const btnStyle = {
  marginTop: 8,
  padding: '10px 20px',
  borderRadius: 10,
  border: 0,
  background: '#8b8bff',
  color: '#0b0b10',
  fontWeight: 700,
  fontSize: 16,
};

// App এখনো না থাকলে (ব্যাচ ৮-এর আগে) এই সাময়িক পর্দা দেখাবে
function ComingSoon() {
  return (
    <div style={boxStyle}>
      <b style={{ fontSize: 26 }}>MangaBooka</b>
      <span style={{ opacity: 0.75 }}>সাইট তৈরি হচ্ছে, শীঘ্রই আসছে</span>
    </div>
  );
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>{App ? <App /> : <ComingSoon />}</ErrorBoundary>
  </React.StrictMode>
);

// ---- সার্ভিস ওয়ার্কার (শুধু প্রোডাকশনে; sw.js ব্যাচ ১৯-এ আসবে, না থাকলে চুপচাপ বাদ) ----
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {});
  });
  }
