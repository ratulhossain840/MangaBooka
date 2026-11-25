// FILE: HelpHint.jsx
// PATH: client/src/admin/components/HelpHint.jsx (রিপোতে client/src/admin/components ফোল্ডারের ভেতরে)
// কাজ: ফর্ম বা সেকশনের পাশে ছোট "?" বাটন; চাপলে সহজ বাংলায় ব্যাখ্যা খোলে। অ্যাডমিন পেজে কোনো কিছু বুঝতে অসুবিধা হলে এটা বসানো হয়।
// ব্যবহার: <HelpHint>এখানে ব্যাখ্যা</HelpHint>   বা   <HelpHint title="ছাড় কীভাবে কাজ করে">...</HelpHint>

import { useState } from 'react';

export default function HelpHint({ title, children }) {
  const [open, setOpen] = useState(false);
  return (
    <span style={{ display: 'inline-block', verticalAlign: 'middle' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="ব্যাখ্যা দেখুন"
        style={{
          width: 24,
          height: 24,
          borderRadius: '50%',
          border: '1px solid var(--accent)',
          background: open ? 'var(--accent)' : 'transparent',
          color: open ? 'var(--on-accent)' : 'var(--accent)',
          fontSize: 14,
          fontWeight: 700,
          lineHeight: 1,
          padding: 0,
        }}
      >
        ?
      </button>
      {open && (
        <span className="alert small" style={{ display: 'block', marginTop: 8, whiteSpace: 'pre-wrap', textAlign: 'left', fontWeight: 400 }}>
          {title && <b style={{ display: 'block', marginBottom: 4 }}>{title}</b>}
          {children}
        </span>
      )}
    </span>
  );
          }
