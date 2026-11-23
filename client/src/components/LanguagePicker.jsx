// FILE: LanguagePicker.jsx
// PATH: client/src/components/LanguagePicker.jsx (রিপোতে client/src/components ফোল্ডারের ভেতরে)
// কাজ: নিচ থেকে ওঠা শিট: ভাষা বাছা (৬টি) ও দেশ বাছা (৬টি + অন্য দেশ)। দেশ/ভাষা বদলালে দাম ও মুদ্রা নিজে বদলায়
// (দেশ BD + ভাষা bn/en = ৳ টাকা, বাকি সব = $ ডলার)।
// ব্যবহার: <LanguagePicker open={bool} onClose={fn} />  (Navbar এটা খোলে; প্রোফাইল পেজেও ব্যবহার করা যাবে)

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '../i18n/index.js';
import { useMarket } from '../context/MarketContext.jsx';

const CSS = `
.lp-back{position:fixed;inset:0;z-index:90;background:rgba(0,0,0,.6);display:flex;align-items:flex-end;justify-content:center;animation:lp-fade .2s}
.lp-sheet{width:100%;max-width:var(--max-w);max-height:86dvh;overflow:auto;background:var(--bg-2);border:1px solid var(--border);border-bottom:0;border-radius:var(--radius-l) var(--radius-l) 0 0;padding:16px var(--pad) calc(var(--pad) + var(--safe-bottom));animation:lp-up .25s var(--ease)}
.lp-grab{width:40px;height:4px;border-radius:4px;background:var(--border);margin:0 auto 12px}
.lp-sec{margin-top:16px;display:flex;flex-direction:column;gap:8px}
.lp-sec h3{font-size:14px;color:var(--text-2);font-weight:600}
.lp-list{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.lp-opt{min-height:46px;padding:0 14px;border-radius:var(--radius);border:1px solid var(--border);background:var(--surface);text-align:left;display:flex;align-items:center;justify-content:space-between;gap:8px}
.lp-opt.on{border-color:var(--accent);background:color-mix(in srgb,var(--accent) 16%,var(--surface));font-weight:600}
@keyframes lp-up{from{transform:translateY(40px);opacity:0}}
@keyframes lp-fade{from{opacity:0}}
`;

export default function LanguagePicker({ open, onClose }) {
  const { t, lang, setLang, languages } = useI18n();
  const { countries, countryKey, setCountry, currency } = useMarket();

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;
  const codes = [...countries, 'OTHER'];

  // portal: উপরের বারে backdrop-filter থাকায় ভেতরে fixed ঠিকমতো কাজ করে না, তাই body-তে আঁকি
  return createPortal(
    <div className="lp-back" onClick={onClose} role="dialog" aria-modal="true" aria-label={t('language.title')}>
      <style>{CSS}</style>
      <div className="lp-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="lp-grab" />
        <div className="row between">
          <h2>{t('language.title')}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label={t('common.close')}>
            ✕
          </button>
        </div>

        <div className="lp-sec">
          <div className="lp-list">
            {languages.map((l) => (
              <button key={l.code} type="button" className={'lp-opt' + (l.code === lang ? ' on' : '')} onClick={() => setLang(l.code)}>
                <span>{l.name}</span>
                {l.code === lang && <span>✓</span>}
              </button>
            ))}
          </div>
        </div>

        <div className="lp-sec">
          <h3>{t('market.chooseCountry')}</h3>
          <div className="lp-list">
            {codes.map((c) => (
              <button key={c} type="button" className={'lp-opt' + (c === countryKey ? ' on' : '')} onClick={() => setCountry(c)}>
                <span>{t('market.countries.' + c)}</span>
                {c === countryKey && <span>✓</span>}
              </button>
            ))}
          </div>
          <p className="hint">{t('market.priceCurrency', { currency })}</p>
        </div>

        <button type="button" className="btn btn-primary btn-block" style={{ marginTop: 16 }} onClick={onClose}>
          {t('common.done')}
        </button>
      </div>
    </div>,
    document.body
  );
                }
