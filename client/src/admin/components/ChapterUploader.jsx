// FILE: ChapterUploader.jsx
// PATH: client/src/admin/components/ChapterUploader.jsx (রিপোতে client/src/admin/components ফোল্ডারের ভেতরে)
// কাজ: মাঙ্গার চ্যাপ্টার: নতুন চ্যাপ্টারে অনেক পেজের ছবি একসাথে বাছলে ফাইলের নামের ক্রমে (১,২,৩… বা 001,002…) আপলোড হয়ে সাজে।
// পরে পেজ উপরে/নিচে সরানো, মুছা, আরও পেজ যোগ করা যায়। চ্যাপ্টার মুছাও যায়।
// ব্যবহার: <ChapterUploader productId={id} />

import { useCallback, useEffect, useRef, useState } from 'react';
import { adm, admErr } from '../adminApi.js';
import { uploadMany, sortFiles } from '../../utils/imgbb.js';
import HelpHint from './HelpHint.jsx';

function Editor({ productId, chapter, nextNumber, onClose, onSaved }) {
  const isNew = !chapter;
  const [number, setNumber] = useState(chapter ? chapter.number : nextNumber);
  const [titleBn, setTitleBn] = useState((chapter && chapter.title && chapter.title.bn) || '');
  const [titleEn, setTitleEn] = useState((chapter && chapter.title && chapter.title.en) || '');
  const [pages, setPages] = useState((chapter && chapter.pages) || []);
  const [prog, setProg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const ref = useRef(null);

  async function addFiles(e) {
    const files = sortFiles(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    setBusy(true);
    setErr('');
    setProg([0, files.length]);
    try {
      const urls = await uploadMany(files, { maxW: 1600, onProgress: (d, t) => setProg([d, t]) });
      setPages((p) => [...p, ...urls]);
    } catch (ex) {
      setErr(ex.message || 'আপলোড হয়নি');
    } finally {
      setBusy(false);
      setProg(null);
    }
  }
  const move = (i, d) =>
    setPages((p) => {
      const a = [...p];
      const j = i + d;
      if (j < 0 || j >= a.length) return a;
      [a[i], a[j]] = [a[j], a[i]];
      return a;
    });

  async function save() {
    if (busy) return;
    if (!pages.length) {
      setErr('অন্তত একটি পেজ দিন');
      return;
    }
    setBusy(true);
    setErr('');
    const body = { number: Number(number) || 0, title: { bn: titleBn.trim(), en: titleEn.trim() }, pages };
    try {
      if (isNew) await adm.post(`/products/${productId}/chapters`, body);
      else await adm.put(`/products/${productId}/chapters/${chapter.id}`, body);
      onSaved();
    } catch (ex) {
      setErr(admErr(ex));
      setBusy(false);
    }
  }

  return (
    <div className="panel stack">
      <b>{isNew ? 'নতুন চ্যাপ্টার' : 'চ্যাপ্টার এডিট'}</b>
      <div className="row">
        <div className="field" style={{ width: 90 }}>
          <label>নম্বর</label>
          <input className="input" type="number" min="0" value={number} onChange={(e) => setNumber(e.target.value)} />
        </div>
        <div className="field grow">
          <label>নাম (বাংলা)</label>
          <input className="input" value={titleBn} onChange={(e) => setTitleBn(e.target.value)} maxLength={200} />
        </div>
      </div>
      <div className="field">
        <label>নাম (English, ঐচ্ছিক)</label>
        <input className="input" value={titleEn} onChange={(e) => setTitleEn(e.target.value)} maxLength={200} />
      </div>

      <input ref={ref} type="file" accept="image/*" multiple hidden onChange={addFiles} />
      <div className="row">
        <button type="button" className="btn btn-primary grow" disabled={busy} onClick={() => ref.current && ref.current.click()}>
          {prog ? `আপলোড ${prog[0]}/${prog[1]}…` : '+ পেজের ছবি যোগ করুন'}
        </button>
        <HelpHint title="কীভাবে">
          একসাথে অনেক ছবি বাছুন। ফাইলের নাম 1.jpg, 2.jpg… বা 001.jpg, 002.jpg… হলে নিজে থেকে ঠিক ক্রমে বসবে। বসার পর ক্রম ভুল হলে ↑ ↓ দিয়ে ঠিক করুন। প্রতিটি ছবি ১৬০০px এ ছোট হয়ে যায়, তাই পেজ দ্রুত খোলে।
        </HelpHint>
      </div>

      {pages.length > 0 && <span className="small muted">মোট {pages.length} পেজ</span>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(96px,1fr))', gap: 8 }}>
        {pages.map((u, i) => (
          <div key={u + i} className="stack" style={{ gap: 4 }}>
            <img src={u} alt={'পেজ ' + (i + 1)} loading="lazy" style={{ width: '100%', aspectRatio: '2/3', objectFit: 'cover', borderRadius: 'var(--radius-s)', border: '1px solid var(--border)' }} />
            <div className="row between" style={{ gap: 2 }}>
              <button type="button" className="btn btn-sm" style={{ padding: '4px 8px' }} onClick={() => move(i, -1)} aria-label="উপরে">
                ↑
              </button>
              <span className="small">{i + 1}</span>
              <button type="button" className="btn btn-sm" style={{ padding: '4px 8px' }} onClick={() => move(i, 1)} aria-label="নিচে">
                ↓
              </button>
            </div>
            <button type="button" className="btn btn-sm btn-danger" style={{ padding: '4px 8px' }} onClick={() => setPages((p) => p.filter((_, k) => k !== i))}>
              মুছুন
            </button>
          </div>
        ))}
      </div>

      {err && <span className="error-text">{err}</span>}
      <div className="row">
        <button type="button" className="btn btn-primary grow" disabled={busy} onClick={save}>
          সেভ করুন
        </button>
        <button type="button" className="btn grow" disabled={busy} onClick={onClose}>
          বাতিল
        </button>
      </div>
    </div>
  );
}

export default function ChapterUploader({ productId }) {
  const [list, setList] = useState(null);
  const [err, setErr] = useState('');
  const [edit, setEdit] = useState(null); // 'new' | chapter doc
  const [loadingId, setLoadingId] = useState('');

  const load = useCallback(() => {
    adm.get(`/products/${productId}/chapters`).then((r) => setList(r.items)).catch((e) => setErr(admErr(e)));
  }, [productId]);
  useEffect(load, [load]);

  async function open(c) {
    setLoadingId(c.id);
    setErr('');
    try {
      setEdit(await adm.get(`/products/${productId}/chapters/${c.id}`));
    } catch (e) {
      setErr(admErr(e));
    } finally {
      setLoadingId('');
    }
  }
  async function remove(c) {
    if (!window.confirm(`"${(c.title && (c.title.bn || c.title.en)) || 'চ্যাপ্টার ' + c.number}" মুছে ফেলবেন?`)) return;
    try {
      await adm.del(`/products/${productId}/chapters/${c.id}`);
      load();
    } catch (e) {
      setErr(admErr(e));
    }
  }

  if (edit) {
    return (
      <Editor
        productId={productId}
        chapter={edit === 'new' ? null : edit}
        nextNumber={(list || []).reduce((m, c) => Math.max(m, c.number || 0), 0) + 1}
        onClose={() => setEdit(null)}
        onSaved={() => {
          setEdit(null);
          load();
        }}
      />
    );
  }

  return (
    <div className="stack">
      <div className="row between">
        <h2>চ্যাপ্টার</h2>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setEdit('new')}>
          + নতুন চ্যাপ্টার
        </button>
      </div>
      {err && <span className="error-text">{err}</span>}
      {!list && !err && <div className="spinner" />}
      {list && list.length === 0 && <div className="empty">এখনো চ্যাপ্টার নেই</div>}
      {(list || []).map((c) => (
        <div key={c.id} className="panel row between">
          <span style={{ minWidth: 0 }}>
            <b>{c.number}.</b> {(c.title && (c.title.bn || c.title.en)) || 'নামহীন'} <span className="muted small">({c.pageCount} পেজ)</span>
          </span>
          <span className="row" style={{ gap: 6, flex: 'none' }}>
            <button type="button" className="btn btn-sm" disabled={loadingId === c.id} onClick={() => open(c)}>
              {loadingId === c.id ? '…' : 'এডিট'}
            </button>
            <button type="button" className="btn btn-sm btn-danger" onClick={() => remove(c)}>
              মুছুন
            </button>
          </span>
        </div>
      ))}
    </div>
  );
                                      }
