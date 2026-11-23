// FILE: ShareButton.jsx
// PATH: client/src/components/ShareButton.jsx (রিপোতে client/src/components ফোল্ডারের ভেতরে)
// কাজ: শেয়ার। ফোনে হলে ফোনের নিজের শেয়ার মেনু, না থাকলে লিংক কপি। কপি হলে বাটনে "লিংক কপি হয়েছে" দেখায় ও টোস্ট ছোড়ে।
// ব্যবহার: <ShareButton url={shareUrl} title={product.title} text={product.headline} compact />
//   url না দিলে বর্তমান পেজের লিংক। compact = শুধু আইকন।

import { useState } from 'react';
import { useI18n } from '../i18n/index.js';

const Icon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="18" cy="5" r="3" />
    <circle cx="6" cy="12" r="3" />
    <circle cx="18" cy="19" r="3" />
    <path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
  </svg>
);

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

export default function ShareButton({ url, title, text, compact = false, className = '' }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  async function onClick() {
    const link = url || window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: title || t('app.name'), text: text || '', url: link });
        return;
      } catch (e) {
        if (e && e.name === 'AbortError') return; // ক্রেতা নিজে বন্ধ করেছে
      }
    }
    if (await copyText(link)) {
      setCopied(true);
      window.dispatchEvent(new CustomEvent('mb-toast', { detail: { message: t('product.linkCopied'), type: 'ok' } }));
      setTimeout(() => setCopied(false), 2000);
    }
  }

  if (compact) {
    return (
      <button type="button" className={'icon-btn ' + className} onClick={onClick} aria-label={t('common.share')}>
        <Icon />
      </button>
    );
  }
  return (
    <button type="button" className={'btn btn-ghost ' + className} onClick={onClick}>
      <Icon />
      {copied ? t('product.linkCopied') : t('product.share')}
    </button>
  );
  }
