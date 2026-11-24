// FILE: EbookReader.jsx
// PATH: client/src/pages/EbookReader.jsx (রিপোতে client/src/pages ফোল্ডারের ভেতরে)
// কাজ: ই-বুক পড়ার পেজ (পেজ ধরে, ~২৫০–৩০০ শব্দ/পেজ)। App.jsx /read/:productId-এ কনটেন্টের সূচি এনে এটা খোলে (প্রপ index)।
// সুবিধা: অধ্যায় তালিকা, পেজ বদল (ট্যাপ বাঁ/ডান, সোয়াইপ, কিবোর্ডের তীর), লেখার আকার, থিম (ডার্ক/লাইট/সেপিয়া), পড়ার ভাষা, শেষ পড়া জায়গা মনে রাখা,
// PDF/EPUB ডাউনলোড (ব্রাউজারেই তৈরি)। মাঝখানে ট্যাপ করলে মেনু দেখা/লুকানো যায়। কনটেন্ট সার্ভার কনফার্ম ছাড়া দেয় না।

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { content } from '../api.js';
import { useI18n, LANG_NAMES } from '../i18n/index.js';
import { toast } from '../components/Toast.jsx';
import { buildEpub, saveBlob, safeFileName } from '../utils/epub.js';
import { buildPdf } from '../utils/pdf.js';

const THEMES = {
  dark: { bg: '#0b0b10', fg: '#dcdce6', bar: '#12121a' },
  light: { bg: '#fafafa', fg: '#1b1b1f', bar: '#ececf0' },
  sepia: { bg: '#f4ecd8', fg: '#433422', bar: '#e8dcc0' },
};
const PREF_KEY = 'mb_reader_prefs';
const lsGet = (k, d) => {
  try {
    const v = JSON.parse(window.localStorage.getItem(k));
    return v == null ? d : v;
  } catch {
    return d;
  }
};
const lsSet = (k, v) => {
  try {
    window.localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* ignore */
  }
};
const pickTitle = (obj, lang) => {
  if (!obj) return '';
  if (typeof obj === 'string') return obj;
  return obj[lang] || obj.en || obj.bn || Object.values(obj).find(Boolean) || '';
};

const CSS = `
.rd{position:fixed;inset:0;z-index:60;display:flex;flex-direction:column}
.rd-bar{display:flex;align-items:center;gap:6px;padding:calc(var(--safe-top) + 6px) 10px 6px;min-height:52px;transition:transform .2s}
.rd-bar.bottom{padding:6px 10px calc(var(--safe-bottom) + 6px)}
.rd-hide-top{transform:translateY(-110%);position:absolute;left:0;right:0;top:0;z-index:2}
.rd-hide-bottom{transform:translateY(110%);position:absolute;left:0;right:0;bottom:0;z-index:2}
.rd-body{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch}
.rd-text{max-width:680px;margin:0 auto;padding:22px 22px 60px;white-space:pre-wrap;word-break:break-word;font-family:var(--font-read)}
.rd-btn{min-width:42px;height:42px;border:0;border-radius:10px;background:transparent;color:inherit;font-size:18px;display:grid;place-items:center;padding:0 8px}
.rd-btn:active{background:rgba(127,127,127,.25)}
.rd-title{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:600;font-size:15px}
.rd-sheet-back{position:absolute;inset:0;z-index:5;background:rgba(0,0,0,.55);display:flex;align-items:flex-end;justify-content:center}
.rd-sheet{width:100%;max-width:680px;max-height:80%;overflow:auto;border-radius:18px 18px 0 0;padding:16px 18px calc(var(--safe-bottom) + 18px)}
.rd-row{display:flex;align-items:center;gap:10px;margin:12px 0;flex-wrap:wrap}
.rd-opt{border:1px solid currentColor;opacity:.85;background:transparent;color:inherit;border-radius:999px;padding:6px 14px;font-size:14px}
.rd-opt.on{opacity:1;font-weight:700;background:rgba(127,127,127,.25)}
.rd-ch{display:block;width:100%;text-align:left;border:0;background:transparent;color:inherit;padding:12px 6px;border-bottom:1px solid rgba(127,127,127,.25);font-size:15px}
.rd-ch.on{font-weight:700}
`;

export default function EbookReader({ index }) {
  const { t, lang: uiLang, errMsg } = useI18n();
  const pid = index.productId;
  const chapters = useMemo(() => [...(index.chapterIndex || [])].sort((a, b) => (a.number || 0) - (b.number || 0)), [index]);
  const saved = useMemo(() => lsGet('mb_read_' + pid, {}), [pid]);
  const prefs0 = useMemo(() => lsGet(PREF_KEY, { fs: 19, theme: 'dark' }), []);

  const [fs, setFs] = useState(prefs0.fs || 19);
  const [theme, setTheme] = useState(THEMES[prefs0.theme] ? prefs0.theme : 'dark');
  const [lang, setLang] = useState(prefs0.lang || uiLang);
  const [ci, setCi] = useState(() => {
    const i = chapters.findIndex((c) => c.id === saved.cid);
    return i >= 0 ? i : 0;
  });
  const [pi, setPi] = useState(saved.page || 0);
  const [data, setData] = useState(null); // { pages, lang, availableLangs }
  const [err, setErr] = useState(null);
  const [menu, setMenu] = useState(true);
  const [sheet, setSheet] = useState(null); // 'toc' | 'settings'
  const [busy, setBusy] = useState('');
  const cache = useRef(new Map());
  const bodyRef = useRef(null);
  const touch = useRef(null);

  const ch = chapters[ci];
  const th = THEMES[theme];

  const load = useCallback(async () => {
    if (!ch) return;
    const key = ch.id + '|' + lang;
    if (cache.current.has(key)) {
      setData(cache.current.get(key));
      return;
    }
    setData(null);
    setErr(null);
    try {
      const r = await content.chapter(pid, ch.id, { lang });
      cache.current.set(key, r);
      setData(r);
    } catch (e) {
      setErr(e);
    }
  }, [pid, ch, lang]);
  useEffect(() => {
    load();
  }, [load]);

  const pages = data ? data.pages : [];
  const pageCount = pages.length;
  const pageSafe = Math.min(pi, Math.max(0, pageCount - 1));

  // শেষ পড়া জায়গা ও পছন্দ মনে রাখা
  useEffect(() => {
    if (ch && data) lsSet('mb_read_' + pid, { cid: ch.id, page: pageSafe });
  }, [pid, ch, data, pageSafe]);
  useEffect(() => {
    lsSet(PREF_KEY, { fs, theme, lang });
  }, [fs, theme, lang]);
  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
  }, [ci, pageSafe, data]);

  const next = useCallback(() => {
    if (!data) return;
    if (pageSafe < pageCount - 1) setPi(pageSafe + 1);
    else if (ci < chapters.length - 1) {
      setCi(ci + 1);
      setPi(0);
    } else toast(t('reader.theEnd'));
  }, [data, pageSafe, pageCount, ci, chapters.length, t]);
  const prev = useCallback(() => {
    if (pageSafe > 0) setPi(pageSafe - 1);
    else if (ci > 0) {
      setCi(ci - 1);
      setPi(9999); // আগের অধ্যায়ের শেষ পেজ (লোডের পর ছাঁটা হয়)
    } else toast(t('reader.firstPage'));
  }, [pageSafe, ci, t]);

  useEffect(() => {
    const onKey = (e) => {
      if (sheet) return;
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, prev, sheet]);

  function onTap(e) {
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    if (x < 0.28) prev();
    else if (x > 0.72) next();
    else setMenu((m) => !m);
  }
  const onTouchStart = (e) => {
    const p = e.touches[0];
    touch.current = { x: p.clientX, y: p.clientY };
  };
  const onTouchEnd = (e) => {
    const s = touch.current;
    touch.current = null;
    if (!s) return;
    const p = e.changedTouches[0];
    const dx = p.clientX - s.x;
    const dy = p.clientY - s.y;
    if (Math.abs(dx) > 70 && Math.abs(dy) < 50) {
      if (dx < 0) next();
      else prev();
    }
  };

  async function download(kind) {
    if (busy) return;
    setSheet(null);
    try {
      const out = [];
      let used = lang;
      for (let i = 0; i < chapters.length; i++) {
        setBusy(`${t('reader.preparing')} ${i + 1}/${chapters.length}`);
        const key = chapters[i].id + '|' + lang;
        const r = cache.current.get(key) || (await content.chapter(pid, chapters[i].id, { lang }));
        cache.current.set(key, r);
        if (i === 0 && r.lang) used = r.lang;
        out.push({ title: pickTitle(chapters[i].title, used) || t('reader.chapter', { n: chapters[i].number }), pages: r.pages || [] });
      }
      const title = index.title || t('app.name');
      let blob;
      let ext;
      if (kind === 'epub') {
        blob = buildEpub({ title, lang: used, chapters: out });
        ext = 'epub';
      } else {
        blob = await buildPdf({ title, chapters: out, onProgress: (d, n) => setBusy(`${t('reader.preparing')} ${d}/${n}`) });
        ext = 'pdf';
      }
      saveBlob(blob, safeFileName(title) + '.' + ext);
      toast(t('reader.downloadReady'), 'ok');
    } catch {
      toast(t('reader.downloadFailed'), 'error');
    } finally {
      setBusy('');
    }
  }

  const langs = Array.from(new Set([...(index.textLangs || []), ...((data && data.availableLangs) || [])]));
  const chTitle = ch ? pickTitle(ch.title, data && data.lang ? data.lang : lang) || t('reader.chapter', { n: ch.number }) : '';
  const denied = err && (err.status === 403 || err.status === 401);

  return (
    <div className="rd" style={{ background: th.bg, color: th.fg }}>
      <style>{CSS}</style>

      <div className={'rd-bar' + (menu ? '' : ' rd-hide-top')} style={{ background: th.bar }}>
        <Link to="/library" className="rd-btn" aria-label={t('nav.library')} style={{ color: 'inherit' }}>
          ←
        </Link>
        <span className="rd-title">{index.title}</span>
        <button type="button" className="rd-btn" onClick={() => setSheet('toc')} aria-label={t('reader.contents')}>
          ☰
        </button>
        <button type="button" className="rd-btn" onClick={() => setSheet('settings')} aria-label={t('reader.theme')}>
          Aa
        </button>
      </div>

      <div className="rd-body" ref={bodyRef} onClick={onTap} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        {err ? (
          <div className="rd-text" style={{ textAlign: 'center', paddingTop: 80, whiteSpace: 'normal' }}>
            <p>{denied ? t('reader.noAccess') : t('reader.loadFailed') + ' — ' + errMsg(err)}</p>
            {!denied && (
              <button type="button" className="rd-opt" onClick={(e) => { e.stopPropagation(); load(); }}>
                {t('common.retry')}
              </button>
            )}
          </div>
        ) : !data ? (
          <div className="rd-text" style={{ textAlign: 'center', paddingTop: 80 }}>
            <div className="spinner" style={{ margin: '0 auto' }} />
          </div>
        ) : (
          <div className="rd-text" style={{ fontSize: fs, lineHeight: 1.85 }}>
            {pageSafe === 0 && <div style={{ fontWeight: 700, fontSize: fs + 4, marginBottom: 18, whiteSpace: 'normal' }}>{chTitle}</div>}
            {pages[pageSafe] || ''}
          </div>
        )}
      </div>

      <div className={'rd-bar bottom' + (menu ? '' : ' rd-hide-bottom')} style={{ background: th.bar, justifyContent: 'space-between' }}>
        <button type="button" className="rd-btn" onClick={prev} aria-label={t('reader.prev')}>
          ‹
        </button>
        <span style={{ fontSize: 13, opacity: 0.85, textAlign: 'center' }}>
          {busy || (data ? `${chTitle} · ${t('reader.page', { a: pageSafe + 1, b: pageCount })}` : '')}
        </span>
        <button type="button" className="rd-btn" onClick={next} aria-label={t('reader.next')}>
          ›
        </button>
      </div>

      {sheet && (
        <div className="rd-sheet-back" onClick={() => setSheet(null)}>
          <div className="rd-sheet" style={{ background: th.bar }} onClick={(e) => e.stopPropagation()}>
            {sheet === 'toc' && (
              <>
                <b>{t('reader.contents')}</b>
                {chapters.map((c, i) => (
                  <button
                    key={c.id}
                    type="button"
                    className={'rd-ch' + (i === ci ? ' on' : '')}
                    onClick={() => {
                      setCi(i);
                      setPi(0);
                      setSheet(null);
                    }}
                  >
                    {pickTitle(c.title, lang) || t('reader.chapter', { n: c.number })}
                  </button>
                ))}
              </>
            )}
            {sheet === 'settings' && (
              <>
                <div className="rd-row">
                  <span>{t('reader.fontSize')}</span>
                  <button type="button" className="rd-opt" onClick={() => setFs((v) => Math.max(14, v - 1))}>
                    A−
                  </button>
                  <span>{fs}</span>
                  <button type="button" className="rd-opt" onClick={() => setFs((v) => Math.min(30, v + 1))}>
                    A+
                  </button>
                </div>
                <div className="rd-row">
                  <span>{t('reader.theme')}</span>
                  {Object.keys(THEMES).map((k) => (
                    <button key={k} type="button" className={'rd-opt' + (k === theme ? ' on' : '')} onClick={() => setTheme(k)}>
                      {t('reader.themes.' + k)}
                    </button>
                  ))}
                </div>
                {langs.length > 1 && (
                  <div className="rd-row">
                    <span>{t('reader.language')}</span>
                    {langs.map((l) => (
                      <button
                        key={l}
                        type="button"
                        className={'rd-opt' + (l === (data && data.lang ? data.lang : lang) ? ' on' : '')}
                        onClick={() => {
                          setLang(l);
                          setSheet(null);
                        }}
                      >
                        {LANG_NAMES[l] || l}
                      </button>
                    ))}
                  </div>
                )}
                <div className="rd-row">
                  <span>{t('reader.download')}</span>
                  <button type="button" className="rd-opt" onClick={() => download('pdf')}>
                    {t('reader.downloadPdf')}
                  </button>
                  <button type="button" className="rd-opt" onClick={() => download('epub')}>
                    {t('reader.downloadEpub')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
          }
