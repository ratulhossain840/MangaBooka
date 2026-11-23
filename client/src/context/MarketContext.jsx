// FILE: MarketContext.jsx
// PATH: client/src/context/MarketContext.jsx (রিপোতে client/src/context ফোল্ডারের ভেতরে)
// কাজ: ক্রেতার দেশ ঠিক করা (বাছা > ?country > ঢাকা সময় অঞ্চল হলে BD > সার্ভারের ধরা দেশ), বাজার (BD/INT) ও মুদ্রা (BDT/USD) হিসাব,
// সব API কলে ?country ও ?lang পাঠানো, /api/catalog/config (ক্যাটাগরি, ব্যানার, ঘোষণা) নামানো, ভিজিট ট্র্যাক।
// বাজার নিয়ম সার্ভারের সাথে হুবহু এক: দেশ BD এবং ভাষা bn/en হলে BD (৳, bKash/Nagad), নইলে INT ($, USDT)।
//
// ব্যবহার: const { country, market, currency, setCountry, config, ready } = useMarket();

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { catalog, setApiContext, captureUtm, trackVisit } from '../api.js';
import { useI18n } from '../i18n/index.js';
import { setAuthLanguage } from '../firebase.js';

export const COUNTRIES = ['BD', 'JP', 'CN', 'SG', 'MY', 'CL'];
const KEY = 'mb_country';
const RE = /^[A-Za-z]{2}$/;

export const marketFor = (country, lang) => (country === 'BD' && (lang === 'bn' || lang === 'en') ? 'BD' : 'INT');
export const currencyOf = (market) => (market === 'BD' ? 'BDT' : 'USD');

// ক্রেতা নিজে যে দেশ বেছেছে বা শুরুর অনুমান (সার্ভারের ধরা দেশ এখানে নেই)
function initialChosen() {
  try {
    const stored = window.localStorage.getItem(KEY);
    if (RE.test(stored || '')) return stored.toUpperCase();
  } catch {
    /* ignore */
  }
  try {
    const q = new URLSearchParams(window.location.search).get('country');
    if (RE.test(q || '')) return q.toUpperCase();
    if (Intl.DateTimeFormat().resolvedOptions().timeZone === 'Asia/Dhaka') return 'BD';
  } catch {
    /* ignore */
  }
  return null;
}

const Ctx = createContext(null);

export function MarketProvider({ children }) {
  const { lang } = useI18n();
  const [chosen, setChosen] = useState(initialChosen);
  const [detected, setDetected] = useState(null);
  const [config, setConfig] = useState(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);
  const [tick, setTick] = useState(0);

  const country = chosen || detected || null;

  // রেন্ডারের সময়ই সেট, যাতে নিচের কম্পোনেন্টের প্রথম API কলেও সঠিক দেশ/ভাষা যায়
  setApiContext({ lang, country });

  useEffect(() => {
    setAuthLanguage(lang);
  }, [lang]);

  // কনফিগ: ভাষা বা বাছা দেশ বদলালে আবার (ক্যাটাগরির নাম ভাষা অনুযায়ী আসে)
  const seq = useRef(0);
  useEffect(() => {
    const my = ++seq.current;
    catalog
      .config()
      .then((c) => {
        if (my !== seq.current) return;
        setConfig(c);
        setDetected(c.detectedCountry || null);
        setError(null);
        setReady(true);
      })
      .catch((e) => {
        if (my !== seq.current) return;
        setError(e);
        setReady(true); // কনফিগ না এলেও অ্যাপ চলবে
      });
  }, [lang, chosen, tick]);

  // সেশনে একবার ভিজিট গোনা (UTM সহ)
  useEffect(() => {
    captureUtm();
    trackVisit();
  }, []);

  const setCountry = useCallback((code) => {
    const c = String(code || '').toUpperCase();
    if (!RE.test(c) && c !== 'OTHER') return;
    const v = c === 'OTHER' ? 'XX' : c;
    try {
      window.localStorage.setItem(KEY, v);
    } catch {
      /* ignore */
    }
    setChosen(v);
  }, []);

  const retry = useCallback(() => setTick((n) => n + 1), []);

  const value = useMemo(() => {
    const market = marketFor(country, lang);
    return {
      country, // ধরা দেশ বা null
      countryKey: COUNTRIES.includes(country) ? country : country ? 'OTHER' : null, // market.countries.* কী
      countries: COUNTRIES,
      market, // 'BD' | 'INT'
      currency: currencyOf(market),
      setCountry,
      config, // { categories, banners, announcement, suggestedLang, ... } বা null
      ready,
      error,
      retry,
    };
  }, [country, lang, config, ready, error, setCountry, retry]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useMarket() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useMarket must be used inside <MarketProvider>');
  return v;
        }
