// FILE: main.jsx
// PATH: client/src/admin/main.jsx (রিপোতে client/src/admin ফোল্ডারের ভেতরে; ফোল্ডার না থাকলে client/src/admin/.gitkeep দিয়ে বানান)
// কাজ: অ্যাডমিন প্যানেলের শুরু: স্টাইল লোড, ত্রুটি হলে ফাঁকা পর্দার বদলে বার্তা, AdminApp চালানো।

import React from 'react';
import { createRoot } from 'react-dom/client';
import '../styles/theme.css';
import '../styles/global.css';
import AdminApp from './AdminApp.jsx';

document.documentElement.lang = 'bn';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error, info) {
    console.error('[admin]', error, info && info.componentStack);
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="empty" style={{ minHeight: '100dvh', justifyContent: 'center' }}>
        <b style={{ fontSize: 20 }}>কিছু একটা ভুল হয়েছে</b>
        <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
          আবার চেষ্টা করুন
        </button>
      </div>
    );
  }
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <AdminApp />
    </ErrorBoundary>
  </React.StrictMode>
);
