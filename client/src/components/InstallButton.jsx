// FILE: InstallButton.jsx
// PATH: client/src/components/InstallButton.jsx (রিপোতে client/src/components ফোল্ডারের ভেতরে)
// কাজ: "অ্যাপ ইনস্টল করুন" বাটন। Android/Chrome-এ সরাসরি ইনস্টল পপআপ (main.jsx যে প্রম্পট ধরে রেখেছে তা ব্যবহার করে);
// iPhone-এ পপআপ নেই, তাই ছোট নির্দেশ (Share > Add to Home Screen) দেখায়; ইনস্টল করা থাকলে বা সুযোগ না থাকলে কিছুই আঁকে না।
// ব্যবহার: <InstallButton />  (হোম ও প্রোফাইলে)

import { useEffect, useState } from 'react';
import { useI18n } from '../i18n/index.js';

const isStandalone = () => {
  try {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  } catch {
    return false;
  }
};
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent || '') && !window.MSStream;

export default function InstallButton({ className = '' }) {
  const { t } = useI18n();
  const [can, setCan] = useState(!!window.__installPrompt);
  const [done, setDone] = useState(isStandalone());
  const [showIos, setShowIos] = useState(false);

  useEffect(() => {
    const ready = () => setCan(!!window.__installPrompt);
    const installed = () => {
      setDone(true);
      setCan(false);
    };
    window.addEventListener('mb-install-ready', ready);
    window.addEventListener('mb-installed', installed);
    return () => {
      window.removeEventListener('mb-install-ready', ready);
      window.removeEventListener('mb-installed', installed);
    };
  }, []);

  if (done) return null;
  const ios = isIOS();
  if (!can && !ios) return null;

  async function onClick() {
    if (can && window.__installPrompt) {
      const p = window.__installPrompt;
      window.__installPrompt = null;
      setCan(false);
      try {
        await p.prompt();
        await p.userChoice;
      } catch {
        /* ignore */
      }
      return;
    }
    setShowIos((v) => !v);
  }

  return (
    <div className={'stack ' + className} style={{ gap: 8 }}>
      <button type="button" className="btn btn-primary btn-block" onClick={onClick}>
        {t('install.button')}
      </button>
      {showIos && <p className="alert small">{t('install.ios')}</p>}
    </div>
  );
                               }
