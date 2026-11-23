// FILE: Toast.jsx
// PATH: client/src/components/Toast.jsx (রিপোতে client/src/components ফোল্ডারের ভেতরে)
// কাজ: ছোট বার্তা (নিচে, ৩ সেকেন্ড পর মুছে যায়)। App.jsx একবার বসায়।
// ব্যবহার (যেকোনো জায়গা থেকে): import { toast } from '../components/Toast.jsx'; toast('কপি হয়েছে', 'ok');   type: 'ok' | 'error' | ''
// ফাইল না থাকলেও চলে: window.dispatchEvent(new CustomEvent('mb-toast', { detail: { message, type } }))

import { useEffect, useState } from 'react';

export function toast(message, type = '') {
  window.dispatchEvent(new CustomEvent('mb-toast', { detail: { message, type } }));
}

let nextId = 1;

export default function ToastHost() {
  const [list, setList] = useState([]);

  useEffect(() => {
    const timers = new Set();
    const onToast = (e) => {
      const d = (e && e.detail) || {};
      if (!d.message) return;
      const id = nextId++;
      setList((cur) => [...cur.slice(-2), { id, message: String(d.message), type: d.type || '' }]);
      const tm = setTimeout(() => {
        timers.delete(tm);
        setList((cur) => cur.filter((x) => x.id !== id));
      }, 3000);
      timers.add(tm);
    };
    window.addEventListener('mb-toast', onToast);
    return () => {
      window.removeEventListener('mb-toast', onToast);
      timers.forEach(clearTimeout);
    };
  }, []);

  return (
    <div className="toasts" aria-live="polite">
      {list.map((x) => (
        <div key={x.id} className={'toast ' + x.type}>
          {x.message}
        </div>
      ))}
    </div>
  );
      }
