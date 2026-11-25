// FILE: ImageUploader.jsx
// PATH: client/src/admin/components/ImageUploader.jsx (রিপোতে client/src/admin/components ফোল্ডারের ভেতরে)
// কাজ: একটি ছবি (যেমন কভার) আপলোড বা লিংক বসানো। ছবি imgbb তে যায়, লিংক onChange এ ফেরত আসে।
// ব্যবহার: <ImageUploader value={url} onChange={setUrl} label="কভার" maxW={800} />

import { useRef, useState } from 'react';
import { uploadImage } from '../../utils/imgbb.js';

export default function ImageUploader({ value, onChange, label = 'ছবি', maxW = 800 }) {
  const ref = useRef(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function pick(e) {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    setBusy(true);
    setErr('');
    try {
      onChange(await uploadImage(f, { maxW }));
    } catch (ex) {
      setErr(ex.message || 'আপলোড হয়নি');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="field">
      <label>{label}</label>
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <div style={{ width: 90, height: 120, flex: 'none', borderRadius: 'var(--radius-s)', border: '1px dashed var(--border)', overflow: 'hidden', display: 'grid', placeItems: 'center', background: 'var(--surface)' }}>
          {value ? <img src={value} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span className="small muted">নেই</span>}
        </div>
        <div className="stack grow" style={{ gap: 8 }}>
          <input ref={ref} type="file" accept="image/*" hidden onChange={pick} />
          <button type="button" className="btn btn-sm" disabled={busy} onClick={() => ref.current && ref.current.click()}>
            {busy ? 'আপলোড হচ্ছে…' : value ? 'বদলান' : 'ছবি বাছুন'}
          </button>
          <input className="input" placeholder="অথবা ছবির লিংক বসান" value={value || ''} onChange={(e) => onChange(e.target.value.trim())} />
          {value && (
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => onChange('')}>
              মুছুন
            </button>
          )}
          {err && <span className="error-text">{err}</span>}
        </div>
      </div>
    </div>
  );
             }
