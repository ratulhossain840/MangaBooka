// FILE: TranslateStatus.jsx
// PATH: client/src/admin/pages/TranslateStatus.jsx (রিপোতে client/src/admin/pages ফোল্ডারের ভেতরে)
// কাজ: Gemini দিয়ে অনুবাদ: ১) Gemini চালু কিনা দেখা ও পরীক্ষা ২) প্রোডাক্ট বেছে কোন ভাষায় কতটা অনুবাদ হয়েছে দেখা ৩) অনুবাদ শুরু ৪) চলমান কাজ দেখা, বাতিল/আবার চেষ্টা।
// বাংলা লেখা মূল ধরা হয়; অন্য ৫ ভাষায় নাম-বিবরণ ও ই-বুকের পেজ অনুবাদ হয়।

import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api.js';
import { adm, admErr } from '../adminApi.js';
import HelpHint from '../components/HelpHint.jsx';

const T = (p, b) => api.post('/api/translate' + p, b, { auth: 'required' });
const G = (p) => api.get('/api/translate' + p, { auth: 'required' });

const LANGS = [
  ['en', 'English'],
  ['ja', '日本語'],
  ['zh', '中文'],
  ['ms', 'Melayu'],
  ['es', 'Español'],
];
const JOB = {
  queued: ['লাইনে', 'var(--warn)'],
  running: ['চলছে', 'var(--accent)'],
  done: ['শেষ', 'var(--ok)'],
  partial: ['আংশিক', 'var(--warn)'],
  error: ['ত্রুটি', 'var(--danger)'],
  cancelled: ['বাতিল', 'var(--text-3)'],
};
const when = (ms) => (ms ? new Date(ms).toLocaleString('bn-BD', { dateStyle: 'short', timeStyle: 'short' }) : '');

function Health() {
  const [h, setH] = useState(null);
  const [err, setErr] = useState('');
  const [to, setTo] = useState('en');
  const [out, setOut] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    G('/health').then(setH).catch((e) => setErr(admErr(e)));
  }, []);
  async function test() {
    setBusy(true);
    setOut('');
    try {
      const r = await T('/test', { to });
      setOut('✔ ' + r.translated);
    } catch (e) {
      setOut('✖ ' + admErr(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel stack">
      <div className="row between">
        <b>Gemini অবস্থা</b>
        <HelpHint title="Gemini কী">
          অনুবাদ Google Gemini দিয়ে হয়। Render এ GEMINI_API_KEYS (একাধিক হলে কমা দিয়ে) দেওয়া থাকতে হবে। চাবি ০টি দেখালে Render এর Environment এ দিন।
        </HelpHint>
      </div>
      {err && <span className="error-text">{err}</span>}
      {h && (
        <span className="small" style={{ color: h.keys ? 'var(--ok)' : 'var(--danger)' }}>
          {h.keys ? `✔ চাবি ${h.keys}টি` : '✖ কোনো চাবি নেই'} · মডেল: {h.model}
        </span>
      )}
      <div className="row">
        <select className="select" value={to} onChange={(e) => setTo(e.target.value)} style={{ flex: '0 0 130px' }}>
          {LANGS.map(([l, n]) => (
            <option key={l} value={l}>
              {n}
            </option>
          ))}
        </select>
        <button type="button" className="btn grow" disabled={busy || (h && !h.keys)} onClick={test}>
          {busy ? '…' : 'পরীক্ষা করুন'}
        </button>
      </div>
      {out && <div className="alert small" style={{ whiteSpace: 'pre-wrap' }}>{out}</div>}
    </section>
  );
}

function Product({ products, onStarted }) {
  const [id, setId] = useState('');
  const [st, setSt] = useState(null);
  const [err, setErr] = useState('');
  const [langs, setLangs] = useState({});
  const [force, setForce] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback((pid) => {
    setSt(null);
    setErr('');
    if (!pid) return;
    G('/status/' + pid).then(setSt).catch((e) => setErr(admErr(e)));
  }, []);
  useEffect(() => load(id), [id, load]);

  async function start() {
    const sel = LANGS.map(([l]) => l).filter((l) => langs[l]);
    if (!id) return setErr('প্রোডাক্ট বাছুন');
    if (!sel.length) return setErr('অন্তত একটি ভাষা টিক দিন');
    setBusy(true);
    setErr('');
    try {
      await T('/products/' + id, { langs: sel, force });
      onStarted();
      load(id);
    } catch (e) {
      setErr(admErr(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel stack">
      <div className="row between">
        <b>প্রোডাক্ট অনুবাদ</b>
        <HelpHint title="কীভাবে">
          প্রোডাক্ট বাছুন, যে ভাষাগুলো চান টিক দিন, "অনুবাদ শুরু" চাপুন। কাজ সার্ভারে চলে, ফোন বন্ধ করলেও থামে না। যা আগেই অনুবাদ হয়েছে তা বাদ যায়; নতুন করে অনুবাদ করাতে "আবার অনুবাদ" টিক দিন। ই-বুকে বাংলা চ্যাপ্টার আগে দেওয়া থাকতে হবে।
        </HelpHint>
      </div>
      <select className="select" value={id} onChange={(e) => setId(e.target.value)}>
        <option value="">প্রোডাক্ট বাছুন</option>
        {products.map((p) => (
          <option key={p.id} value={p.id}>
            {p.title || p.slug}
          </option>
        ))}
      </select>
      {st && (
        <div className="stack" style={{ gap: 4 }}>
          {st.langs.map((x) => (
            <div key={x.lang} className="row between small">
              <span>{(LANGS.find((l) => l[0] === x.lang) || [0, x.lang])[1]}</span>
              <span>
                নাম-বিবরণ {x.meta ? '✔' : '✖'}
                {st.type === 'ebook' ? ` · চ্যাপ্টার ${x.chaptersDone}/${x.chaptersTotal}` : ''}
              </span>
            </div>
          ))}
        </div>
      )}
      <div className="chips">
        {LANGS.map(([l, n]) => (
          <button key={l} type="button" className={'chip' + (langs[l] ? ' active' : '')} onClick={() => setLangs((s) => ({ ...s, [l]: !s[l] }))}>
            {n}
          </button>
        ))}
      </div>
      <label className="row small" style={{ gap: 8 }}>
        <input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} />
        <span>আবার অনুবাদ (আগেরগুলোও নতুন করে)</span>
      </label>
      {err && <span className="error-text">{err}</span>}
      <button type="button" className="btn btn-primary" disabled={busy} onClick={start}>
        {busy ? '…' : 'অনুবাদ শুরু'}
      </button>
    </section>
  );
}

function Jobs({ products, rev }) {
  const [items, setItems] = useState(null);
  const [err, setErr] = useState('');
  const [busyId, setBusyId] = useState('');
  const load = useCallback(() => {
    G('/jobs').then((r) => setItems(r.items)).catch((e) => setErr(admErr(e)));
  }, []);
  useEffect(() => {
    load();
  }, [load, rev]);
  const active = (items || []).some((j) => j.status === 'queued' || j.status === 'running');
  useEffect(() => {
    if (!active) return undefined;
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [active, load]);

  async function act(j, kind) {
    setBusyId(j.id);
    try {
      await T(`/jobs/${j.id}/${kind}`, {});
      load();
    } catch (e) {
      setErr(admErr(e));
    } finally {
      setBusyId('');
    }
  }

  return (
    <section className="panel stack">
      <b>অনুবাদের কাজ</b>
      {err && <span className="error-text">{err}</span>}
      {!items && !err && <div className="spinner" />}
      {items && items.length === 0 && <span className="small muted">এখনো কোনো কাজ নেই</span>}
      {(items || []).map((j) => {
        const [n, c] = JOB[j.status] || [j.status, 'var(--accent)'];
        const p = products.find((x) => x.id === j.productId);
        const pct = j.total ? Math.round((j.done / j.total) * 100) : 0;
        return (
          <div key={j.id} className="panel stack" style={{ gap: 6 }}>
            <div className="row between">
              <b className="small" style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {p ? p.title || p.slug : j.productId}
              </b>
              <span className="badge" style={{ background: c }}>
                {n}
              </span>
            </div>
            <span className="small muted">
              {j.langs.join(', ')} · {when(j.createdAt)}
            </span>
            <div style={{ height: 8, background: 'var(--surface)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ width: pct + '%', height: '100%', background: c }} />
            </div>
            <span className="small">
              {j.done}/{j.total} {j.current ? '· ' + j.current : ''}
            </span>
            {j.errors.length > 0 && (
              <div className="alert danger small" style={{ whiteSpace: 'pre-wrap' }}>
                {j.errors.slice(0, 3).map((e) => (typeof e === 'string' ? e : e.message || JSON.stringify(e))).join('\n')}
                {j.errors.length > 3 ? `\n…আরও ${j.errors.length - 3}টি` : ''}
              </div>
            )}
            <div className="row">
              {(j.status === 'queued' || j.status === 'running') && (
                <button type="button" className="btn btn-sm btn-danger" disabled={busyId === j.id} onClick={() => act(j, 'cancel')}>
                  বাতিল
                </button>
              )}
              {['error', 'partial', 'cancelled'].includes(j.status) && (
                <button type="button" className="btn btn-sm" disabled={busyId === j.id} onClick={() => act(j, 'retry')}>
                  আবার চেষ্টা
                </button>
              )}
            </div>
          </div>
        );
      })}
    </section>
  );
}

export default function TranslateStatus() {
  const [products, setProducts] = useState([]);
  const [rev, setRev] = useState(0);
  useEffect(() => {
    adm.get('/products').then((r) => setProducts(r.items)).catch(() => {});
  }, []);
  return (
    <div className="stack" style={{ gap: 16 }}>
      <h1>অনুবাদের অবস্থা</h1>
      <Health />
      <Product products={products} onStarted={() => setRev((x) => x + 1)} />
      <Jobs products={products} rev={rev} />
    </div>
  );
         }
