// FILE: PushToggle.jsx
// PATH: client/src/components/PushToggle.jsx (রিপোতে client/src/components ফোল্ডারের ভেতরে)
// কাজ: প্রোফাইল পেজে "নোটিফিকেশন চালু/বন্ধ" বাটন। শুধু লগইন করা ইউজারের জন্য এবং শুধু যখন ব্রাউজার ও সার্ভার সেটআপ থাকে; নাহলে কিছুই দেখায় না।

import { useCallback, useEffect, useState } from 'react';
import { useI18n } from '../i18n/index.js';
import { useAuth } from '../context/AuthContext.jsx';
import { pushStatus, enablePush, disablePush } from '../utils/notifications.js';
import { toast } from './Toast.jsx';

const TXT = {
  bn: { on: 'নোটিফিকেশন বন্ধ করুন', off: 'নোটিফিকেশন চালু করুন', hint: 'অর্ডার কনফার্ম ও সাপোর্টের উত্তর ফোনে জানাবে', denied: 'নোটিফিকেশন ব্রাউজারে বন্ধ করা আছে', fail: 'চালু করা যায়নি' },
  en: { on: 'Turn off notifications', off: 'Turn on notifications', hint: 'Get told when your order is confirmed or support replies', denied: 'Notifications are blocked in your browser', fail: 'Could not turn on' },
};

export default function PushToggle() {
  const { lang } = useI18n();
  const { loggedIn } = useAuth();
  const [st, setSt] = useState(null);
  const [busy, setBusy] = useState(false);
  const x = TXT[lang] || TXT.en;

  const load = useCallback(() => {
    pushStatus().then(setSt).catch(() => setSt('unsupported'));
  }, []);
  useEffect(load, [load]);

  if (!loggedIn || !st || st === 'unsupported' || st === 'unconfigured') return null;

  async function click() {
    if (busy || st === 'denied') return;
    setBusy(true);
    try {
      if (st === 'on') await disablePush();
      else await enablePush();
    } catch (e) {
      toast(e.message || x.fail, 'error');
    } finally {
      setBusy(false);
      load();
    }
  }

  return (
    <div className="stack" style={{ gap: 4 }}>
      <button type="button" className="btn" disabled={busy || st === 'denied'} onClick={click}>
        {st === 'denied' ? x.denied : st === 'on' ? x.on : x.off}
      </button>
      <span className="small muted">{x.hint}</span>
    </div>
  );
        }
