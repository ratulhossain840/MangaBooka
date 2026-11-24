// FILE: MangaReader.jsx
// PATH: client/src/pages/MangaReader.jsx (রিপোতে client/src/pages ফোল্ডারের ভেতরে)
// কাজ: মাঙ্গা পড়ার পেজ: অধ্যায়ের ছবিগুলো উপর থেকে নিচে একটানা স্ক্রল (ফোনে সবচেয়ে সহজ), ছবি লেজি-লোড। অধ্যায় তালিকা, আগের/পরের অধ্যায়,
// শেষ পড়া অধ্যায় মনে রাখা। ছবির ভেতরের লেখা অনুবাদ হয় না। মাঝখানে ট্যাপ করলে উপরের বার দেখা/লুকানো যায়।
// App.jsx /read/:productId-এ সূচি এনে এটা খোলে (প্রপ index)।

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { content } from '../api.js';
import { useI18n } from '../i18n/index.js';

// অধ্যায়ের নাম (ভাষা অনুযায়ী, না থাকলে en/bn)
const pickTitle = (obj, lang) => {
  if (!obj) return '';
  if (typeof obj === 'string') return obj;
  return obj[lang] || obj.en || obj.bn || Object.values(obj).find(Boolean) || '';
};

const lsGet = (k) => {
  try {
    return JSON.parse(window.localStorage.getItem(k)) || {};
  } catch {
    return {};
  }
};

const CSS = `
.mr{position:fixed;inset:0;z-index:60;background:#000;color:#eee;display:flex;flex-direction:column}
.mr-bar{display:flex;align-items:center;gap:6px;padding:calc(var(--safe-top) + 6px) 10px 6px;min-height:52px;background:rgba(18,18,26,.96);transition:transform .2s;position:absolute;left:0;right:0;top:0;z-index:3}
.mr-bar.hide{transform:translateY(-110%)}
.mr-btn{min-width:42px;height:42px;border:0;border-radius:10px;background:transparent;color:inherit;font-size:18px;display:grid;place-items:center;padding:0 8px}
.mr-title{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:600;font-size:15px}
.mr-scroll{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch}
.mr-pages{max-width:820px;margin:0 auto}
.mr-pages img{width:100%;height:auto;display:block;min-height:240px;background:#111}
.mr-end{max-width:820px;margin:0 auto;padding:28px 18px calc(var(--safe-bottom) + 40px);display:flex;gap:10px}
.mr-end>*{flex:1}
.mr-sheet-back{position:absolute;inset:0;z-index:5;background:rgba(0,0,0,.6);display:flex;align-items:flex-end;justify-content:center}
.mr-sheet{width:100%;max-width:680px;max-height:78%;overflow:auto;background:#14141c;border-radius:18px 18px 0 0;padding:16px 18px calc(var(--safe-bottom) + 18px)}
.mr-ch{display:block;width:100%;text-align:left;border:0;background:transparent;color:inherit;padding:12px 6px;border-bottom:1px solid #2a2a3b;font-size:15px}
.mr-ch.on{color:var(--accent);font-weight:700}
`;

export default function MangaReader({ index }) {
  const { t, lang, errMsg } = useI18n();
  const pid = index.productId;
  const chapters = useMemo(() => [...(index.chapterIndex || [])].sort((a, b) => (a.number || 0) - (b.number || 0)), [index]);
  const [ci, setCi] = useState(() => {
    const s = lsGet('mb_read_' + pid);
    const i = chapters.findIndex((c) => c.id === s.cid);
    return i >= 0 ? i : 0;
  });
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [bar, setBar] = useState(true);
  const [toc, setToc] = useState(false);
  const scrollRef = useRef(null);
  const ch = chapters[ci];

  const load = useCallback(async () => {
    if (!ch) return;
    setData(null);
    setErr(null);
    try {
      setData(await content.chapter(pid, ch.id));
    } catch (e) {
      setErr(e);
    }
  }, [pid, ch]);
  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (ch) {
      try {
        window.localStorage.setItem('mb_read_' + pid, JSON.stringify({ cid: ch.id }));
      } catch {
        /* ignore */
      }
    }
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [pid, ch]);

  const go = (i) => {
    if (i >= 0 && i < chapters.length) {
      setCi(i);
      setToc(false);
    }
  };
  const title = (c) => pickTitle(c.title, lang) || t('reader.chapter', { n: c.number });
  const denied = err && (err.status === 403 || err.status === 401);

  return (
    <div className="mr">
      <style>{CSS}</style>
      <div className={'mr-bar' + (bar ? '' : ' hide')}>
        <Link to="/library" className="mr-btn" aria-label={t('nav.library')} style={{ color: 'inherit' }}>
          ←
        </Link>
        <span className="mr-title">{index.title}{ch ? ' · ' + title(ch) : ''}</span>
        <button type="button" className="mr-btn" onClick={() => setToc(true)} aria-label={t('reader.contents')}>
          ☰
        </button>
      </div>

      <div className="mr-scroll" ref={scrollRef} onClick={() => setBar((b) => !b)}>
        {err ? (
          <div style={{ textAlign: 'center', padding: '120px 20px' }}>
            <p>{denied ? t('reader.noAccess') : t('reader.loadFailed') + ' — ' + errMsg(err)}</p>
            {!denied && (
              <button type="button" className="btn" onClick={(e) => { e.stopPropagation(); load(); }}>
                {t('common.retry')}
              </button>
            )}
          </div>
        ) : !data ? (
          <div style={{ padding: '120px 0', display: 'grid', placeItems: 'center' }}>
            <div className="spinner" />
          </div>
        ) : (
          <>
            <div className="mr-pages" style={{ paddingTop: bar ? 0 : 0 }}>
              {(data.pages || []).map((src, i) => (
                <img key={i} src={src} alt="" loading={i < 2 ? 'eager' : 'lazy'} decoding="async" />
              ))}
            </div>
            <div className="mr-end" onClick={(e) => e.stopPropagation()}>
              <button type="button" className="btn" disabled={ci === 0} onClick={() => go(ci - 1)}>
                {t('reader.prevChapter')}
              </button>
              {ci < chapters.length - 1 ? (
                <button type="button" className="btn btn-primary" onClick={() => go(ci + 1)}>
                  {t('reader.nextChapter')}
                </button>
              ) : (
                <Link to="/library" className="btn btn-primary">
                  {t('reader.theEnd')}
                </Link>
              )}
            </div>
          </>
        )}
      </div>

      {toc && (
        <div className="mr-sheet-back" onClick={() => setToc(false)}>
          <div className="mr-sheet" onClick={(e) => e.stopPropagation()}>
            <b>{t('reader.contents')}</b>
            {chapters.map((c, i) => (
              <button key={c.id} type="button" className={'mr-ch' + (i === ci ? ' on' : '')} onClick={() => go(i)}>
                {title(c)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
    }
