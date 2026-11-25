// FILE: ProductForm.jsx
// PATH: client/src/admin/pages/ProductForm.jsx (রিপোতে client/src/admin/pages ফোল্ডারের ভেতরে)
// কাজ: নতুন প্রোডাক্ট বানানো (/products/new) ও পুরনোটা এডিট (/products/:id)। কভার, দাম (৳ ও $), ছাড়, ৬ ভাষায় নাম/বিবরণ, ফরম্যাট।
// সেভের পর নিচে চ্যাপ্টার অংশ আসে: মাঙ্গা হলে ছবি আপলোড, ই-বুক হলে লেখা পেস্ট।

import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { adm, admErr } from '../adminApi.js';
import HelpHint from '../components/HelpHint.jsx';
import ImageUploader from '../components/ImageUploader.jsx';
import ChapterUploader from '../components/ChapterUploader.jsx';
import EbookEditor from '../components/EbookEditor.jsx';

const LANGS = [
  ['bn', 'বাংলা'],
  ['en', 'English'],
  ['ja', '日本語'],
  ['zh', '中文'],
  ['ms', 'Melayu'],
  ['es', 'Español'],
];
const EMPTY_L = { title: '', headline: '', caption: '', description: '', bulletsText: '', tocText: '' };

const lines = (s) => String(s || '').split('\n').map((x) => x.trim()).filter(Boolean);
const pad = (n) => String(n).padStart(2, '0');
const toLocal = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const toIso = (v) => (v ? new Date(v).toISOString() : null);
const numOrNull = (v) => (v === '' || v == null ? null : Number(v));
const slugify = (s) =>
  String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

function blank() {
  const i18n = {};
  for (const [l] of LANGS) i18n[l] = { ...EMPTY_L };
  return {
    type: 'manga', slug: '', status: 'draft', category: '', featured: false, sortOrder: 100,
    coverUrl: '', priceBDT: '', priceUSD: '', textLangs: ['bn', 'en'], formats: ['pdf', 'epub'],
    dPercent: '', dBDT: '', dUSD: '', dStart: '', dEnd: '', i18n,
  };
}

function fromDoc(p) {
  const f = blank();
  f.type = p.type;
  f.slug = p.slug || '';
  f.status = p.status || 'draft';
  f.category = p.category || '';
  f.featured = !!p.featured;
  f.sortOrder = p.sortOrder ?? 100;
  f.coverUrl = p.coverUrl || '';
  f.priceBDT = p.priceBDT ?? '';
  f.priceUSD = p.priceUSD ?? '';
  f.textLangs = p.textLangs || [];
  f.formats = p.formats || [];
  const d = p.discount;
  if (d) {
    f.dPercent = d.percent ?? '';
    f.dBDT = d.fixedBDT ?? '';
    f.dUSD = d.fixedUSD ?? '';
    f.dStart = toLocal(d.start);
    f.dEnd = toLocal(d.end);
  }
  for (const [l] of LANGS) {
    const x = (p.i18n && p.i18n[l]) || {};
    f.i18n[l] = { title: x.title || '', headline: x.headline || '', caption: x.caption || '', description: x.description || '', bulletsText: (x.bullets || []).join('\n'), tocText: (x.toc || []).join('\n') };
  }
  return f;
}

function toBody(f, isNew) {
  const i18n = {};
  for (const [l] of LANGS) {
    const x = f.i18n[l];
    if (!(x.title || x.headline || x.caption || x.description || x.bulletsText || x.tocText)) continue;
    i18n[l] = { title: x.title, headline: x.headline, caption: x.caption, description: x.description, bullets: lines(x.bulletsText), toc: lines(x.tocText) };
  }
  const hasDisc = f.dPercent !== '' || f.dBDT !== '' || f.dUSD !== '';
  const body = {
    slug: f.slug.trim(), status: f.status, category: f.category.trim(), featured: f.featured, sortOrder: Number(f.sortOrder) || 0,
    coverUrl: f.coverUrl, priceBDT: numOrNull(f.priceBDT), priceUSD: numOrNull(f.priceUSD),
    discount: hasDisc ? { percent: numOrNull(f.dPercent), fixedBDT: numOrNull(f.dBDT), fixedUSD: numOrNull(f.dUSD), start: toIso(f.dStart), end: toIso(f.dEnd) } : null,
    i18n,
  };
  if (f.type === 'ebook') {
    body.textLangs = f.textLangs;
    body.formats = f.formats;
  }
  if (isNew) body.type = f.type;
  return body;
}

const Field = ({ label, children, hint }) => (
  <div className="field">
    <div className="row between">
      <label>{label}</label>
      {hint}
    </div>
    {children}
  </div>
);

export default function ProductForm() {
  const { id } = useParams();
  const nav = useNavigate();
  const isNew = !id;
  const [f, setF] = useState(blank);
  const [loading, setLoading] = useState(!isNew);
  const [lang, setLang] = useState('bn');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [warn, setWarn] = useState([]);
  const [slugTouched, setSlugTouched] = useState(!isNew);

  useEffect(() => {
    if (isNew) {
      setF(blank());
      setLoading(false);
      return undefined;
    }
    let live = true;
    setLoading(true);
    adm
      .get('/products/' + id)
      .then((p) => live && setF(fromDoc(p)))
      .catch((e) => live && setErr(admErr(e)))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [id, isNew]);

  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const setL = (k, v) =>
    setF((x) => {
      const next = { ...x, i18n: { ...x.i18n, [lang]: { ...x.i18n[lang], [k]: v } } };
      if (isNew && !slugTouched && lang === 'en' && k === 'title') next.slug = slugify(v);
      return next;
    });
  const toggle = (k, v) => setF((x) => ({ ...x, [k]: x[k].includes(v) ? x[k].filter((i) => i !== v) : [...x[k], v] }));

  async function save(e) {
    e.preventDefault();
    if (busy) return;
    setErr('');
    setOk('');
    if (!f.i18n.bn.title.trim()) {
      setLang('bn');
      setErr('বাংলা নাম (title) লিখুন');
      return;
    }
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(f.slug.trim())) {
      setErr('slug ইংরেজি ছোট হাতের অক্ষর, সংখ্যা ও ড্যাশ দিয়ে লিখুন (যেমন: dark-psychology)');
      return;
    }
    setBusy(true);
    try {
      const body = toBody(f, isNew);
      if (isNew) {
        const r = await adm.post('/products', body);
        nav('/products/' + r.id, { replace: true, state: { created: true } });
      } else {
        const r = await adm.put('/products/' + id, body);
        setWarn(r.warnings || []);
        setOk('সেভ হয়েছে ✔');
      }
    } catch (ex) {
      setErr(admErr(ex));
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="page-loading">
        <div className="spinner" />
      </div>
    );
  }
  if (!isNew && err && !f.slug) {
    return (
      <div className="empty">
        <span>{err}</span>
        <Link to="/products" className="btn">
          পিছনে
        </Link>
      </div>
    );
  }

  const L = f.i18n[lang];
  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="row between">
        <h1>{isNew ? 'নতুন প্রোডাক্ট' : 'প্রোডাক্ট এডিট'}</h1>
        <Link to="/products" className="btn btn-sm btn-ghost">
          ← তালিকা
        </Link>
      </div>

      <form className="stack" style={{ gap: 14 }} onSubmit={save}>
        <section className="panel stack">
          <b>মূল তথ্য</b>
          {isNew ? (
            <Field label="ধরন">
              <div className="chips">
                {[['manga', 'মাঙ্গা'], ['ebook', 'ই-বুক']].map(([k, n]) => (
                  <button key={k} type="button" className={'chip' + (f.type === k ? ' active' : '')} onClick={() => set('type', k)}>
                    {n}
                  </button>
                ))}
              </div>
            </Field>
          ) : (
            <span className="small muted">ধরন: {f.type === 'manga' ? 'মাঙ্গা' : 'ই-বুক'} (বদলানো যায় না)</span>
          )}
          <ImageUploader label="কভার ছবি" value={f.coverUrl} onChange={(u) => set('coverUrl', u)} maxW={800} />
          <Field
            label="slug (লিংকের নাম)"
            hint={<HelpHint>সাইটের লিংকে বসে, যেমন /p/dark-psychology। শুধু ইংরেজি ছোট হাতের অক্ষর, সংখ্যা ও ড্যাশ (-)। একবার ছাপানো লিংক পরে বদলালে পুরনো লিংক কাজ করবে না।</HelpHint>}
          >
            <input className="input" value={f.slug} onChange={(e) => { setSlugTouched(true); set('slug', e.target.value.toLowerCase()); }} placeholder="dark-psychology" autoCapitalize="none" />
          </Field>
          <div className="row">
            <div className="field grow">
              <label>অবস্থা</label>
              <select className="select" value={f.status} onChange={(e) => set('status', e.target.value)}>
                <option value="draft">খসড়া (শুধু আমি দেখি)</option>
                <option value="published">প্রকাশিত</option>
                <option value="hidden">লুকানো</option>
              </select>
            </div>
            <div className="field grow">
              <label>ক্যাটাগরি</label>
              <input className="input" value={f.category} onChange={(e) => set('category', e.target.value)} placeholder="যেমন: action" maxLength={60} />
            </div>
          </div>
          <div className="row">
            <div className="field grow">
              <label>ক্রম (ছোট আগে)</label>
              <input className="input" type="number" value={f.sortOrder} onChange={(e) => set('sortOrder', e.target.value)} />
            </div>
            <label className="row grow" style={{ gap: 8, paddingTop: 22 }}>
              <input type="checkbox" checked={f.featured} onChange={(e) => set('featured', e.target.checked)} />
              <span>হোমে বিশেষ (★)</span>
            </label>
          </div>
        </section>

        <section className="panel stack">
          <b>দাম ও ছাড়</b>
          <div className="row">
            <div className="field grow">
              <label>দাম ৳ (বাংলাদেশ)</label>
              <input className="input" type="number" min="0" step="any" inputMode="decimal" value={f.priceBDT} onChange={(e) => set('priceBDT', e.target.value)} />
            </div>
            <div className="field grow">
              <label>দাম $ (অন্য দেশ)</label>
              <input className="input" type="number" min="0" step="any" inputMode="decimal" value={f.priceUSD} onChange={(e) => set('priceUSD', e.target.value)} />
            </div>
          </div>
          <span className="small muted">যে বাজারের দাম ফাঁকা, সেখানে বই কেনা যাবে না।</span>

          <div className="row between">
            <b className="small">ছাড় (ঐচ্ছিক)</b>
            <HelpHint title="ছাড় কীভাবে দেবেন">
              শতাংশ (যেমন ২০) অথবা নির্দিষ্ট ছাড়ের টাকা, যেকোনো একটা দিন। শুরু ও শেষের সময় দিলে ওই সময়ের মধ্যেই ছাড় চলবে এবং ক্রেতা কাউন্টডাউন দেখবে। সময় ফাঁকা রাখলে ছাড় সবসময় চালু। ছাড় বন্ধ করতে সব ঘর ফাঁকা করে সেভ করুন।
            </HelpHint>
          </div>
          <div className="row">
            <div className="field grow">
              <label>শতাংশ %</label>
              <input className="input" type="number" min="0" max="99" step="any" inputMode="decimal" value={f.dPercent} onChange={(e) => set('dPercent', e.target.value)} />
            </div>
            <div className="field grow">
              <label>ছাড় ৳</label>
              <input className="input" type="number" min="0" step="any" inputMode="decimal" value={f.dBDT} onChange={(e) => set('dBDT', e.target.value)} />
            </div>
            <div className="field grow">
              <label>ছাড় $</label>
              <input className="input" type="number" min="0" step="any" inputMode="decimal" value={f.dUSD} onChange={(e) => set('dUSD', e.target.value)} />
            </div>
          </div>
          <div className="row">
            <div className="field grow">
              <label>শুরু</label>
              <input className="input" type="datetime-local" value={f.dStart} onChange={(e) => set('dStart', e.target.value)} />
            </div>
            <div className="field grow">
              <label>শেষ</label>
              <input className="input" type="datetime-local" value={f.dEnd} onChange={(e) => set('dEnd', e.target.value)} />
            </div>
          </div>
        </section>

        {f.type === 'ebook' && (
          <section className="panel stack">
            <b>ই-বুকের সেটিং</b>
            <Field label="পড়ার ভাষা" hint={<HelpHint>যেসব ভাষায় এই বইয়ের লেখা আছে সেগুলো টিক দিন। ক্রেতা পড়ার সময় এই ভাষাগুলো থেকে বাছতে পারবে।</HelpHint>}>
              <div className="chips">
                {LANGS.map(([l, n]) => (
                  <button key={l} type="button" className={'chip' + (f.textLangs.includes(l) ? ' active' : '')} onClick={() => toggle('textLangs', l)}>
                    {n}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="ডাউনলোডের ফরম্যাট">
              <div className="chips">
                {['pdf', 'epub'].map((x) => (
                  <button key={x} type="button" className={'chip' + (f.formats.includes(x) ? ' active' : '')} onClick={() => toggle('formats', x)}>
                    {x.toUpperCase()}
                  </button>
                ))}
              </div>
            </Field>
          </section>
        )}

        <section className="panel stack">
          <div className="row between">
            <b>নাম ও বিবরণ</b>
            <HelpHint>বাংলা নাম বাধ্যতামূলক। অন্য ভাষা ফাঁকা থাকলে ক্রেতা ইংরেজি বা বাংলা দেখবে। পরে অনুবাদ পেজ থেকে Gemini দিয়ে নিজে নিজে অনুবাদ করানো যাবে।</HelpHint>
          </div>
          <div className="chips">
            {LANGS.map(([l, n]) => (
              <button key={l} type="button" className={'chip' + (lang === l ? ' active' : '')} onClick={() => setLang(l)}>
                {n}
                {f.i18n[l].title ? ' ✔' : ''}
              </button>
            ))}
          </div>
          <Field label={'নাম' + (lang === 'bn' ? ' (বাধ্যতামূলক)' : '')}>
            <input className="input" value={L.title} onChange={(e) => setL('title', e.target.value)} maxLength={200} />
          </Field>
          <Field label="এক লাইনের আকর্ষণ (headline)">
            <input className="input" value={L.headline} onChange={(e) => setL('headline', e.target.value)} maxLength={300} />
          </Field>
          <Field label="ছোট ক্যাপশন (কার্ডে)">
            <input className="input" value={L.caption} onChange={(e) => setL('caption', e.target.value)} maxLength={500} />
          </Field>
          <Field label="বিস্তারিত বিবরণ">
            <textarea className="textarea" style={{ minHeight: 160 }} value={L.description} onChange={(e) => setL('description', e.target.value)} maxLength={10000} />
          </Field>
          <Field label="কী কী পাবেন (প্রতি লাইনে একটি)">
            <textarea className="textarea" value={L.bulletsText} onChange={(e) => setL('bulletsText', e.target.value)} />
          </Field>
          {f.type === 'ebook' && (
            <Field label="সূচিপত্র (প্রতি লাইনে একটি)">
              <textarea className="textarea" value={L.tocText} onChange={(e) => setL('tocText', e.target.value)} />
            </Field>
          )}
        </section>

        {err && <div className="alert danger small">{err}</div>}
        {ok && <div className="alert ok small">{ok}</div>}
        {warn.map((w, i) => (
          <div key={i} className="alert warn small">
            ⚠ {w}
          </div>
        ))}
        <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
          {busy ? 'সেভ হচ্ছে…' : isNew ? 'প্রোডাক্ট বানান' : 'সেভ করুন'}
        </button>
      </form>

      {isNew ? (
        <div className="alert small">প্রোডাক্ট বানানোর পর এখানেই চ্যাপ্টার যোগ করার অংশ আসবে।</div>
      ) : f.type === 'manga' ? (
        <ChapterUploader productId={id} />
      ) : (
        <EbookEditor productId={id} />
      )}
    </div>
  );
}
