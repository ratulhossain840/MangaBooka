// FILE: Dashboard.jsx
// PATH: client/src/admin/pages/Dashboard.jsx (রিপোতে client/src/admin/pages ফোল্ডারের ভেতরে)
// কাজ: প্রথম পেজ: অপেক্ষার অর্ডার, খোলা সাপোর্ট, মোট প্রোডাক্ট, গত ৭ দিনের ভিজিট ও অর্ডারের বার, এবং সেটআপ পরীক্ষা (Render এর গোপন সেটিং ঠিক আছে কিনা)।

import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adm, admErr } from '../adminApi.js';
import HelpHint from '../components/HelpHint.jsx';

const nf = new Intl.NumberFormat('bn-BD');
const dayLabel = (d) => {
  const [, m, dd] = d.split('-');
  return `${Number(dd)}/${Number(m)}`;
};

function Bars({ rows, field, color }) {
  const max = Math.max(1, ...rows.map((r) => r[field] || 0));
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 90 }}>
      {rows.map((r) => (
        <div key={r.day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, height: '100%', justifyContent: 'flex-end' }}>
          <span className="small muted">{r[field] || 0}</span>
          <div style={{ width: '100%', height: Math.max(3, ((r[field] || 0) / max) * 56), background: color, borderRadius: 4 }} />
        </div>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const [d, setD] = useState(null);
  const [env, setEnv] = useState(null);
  const [err, setErr] = useState('');
  const [all, setAll] = useState(false);

  const load = useCallback(() => {
    setErr('');
    adm.get('/dashboard').then(setD).catch((e) => setErr(admErr(e)));
    adm.get('/env-check').then(setEnv).catch(() => {});
  }, []);
  useEffect(load, [load]);

  if (err && !d) {
    return (
      <div className="empty">
        <span>{err}</span>
        <button type="button" className="btn" onClick={load}>
          আবার চেষ্টা করুন
        </button>
      </div>
    );
  }
  if (!d) {
    return (
      <div className="page-loading">
        <div className="spinner" />
      </div>
    );
  }

  const problems = env ? env.items.filter((i) => i.level !== 'ok') : [];
  const shown = env ? (all ? env.items : problems) : [];
  const COLOR = { ok: 'var(--ok)', warn: 'var(--warn)', error: 'var(--danger)' };
  const ICON = { ok: '✔', warn: '⚠', error: '✖' };
  const visits7 = d.last7.reduce((s, r) => s + (r.visits || 0), 0);
  const orders7 = d.last7.reduce((s, r) => s + (r.orders || 0), 0);

  return (
    <div className="stack" style={{ gap: 16 }}>
      <h1>ড্যাশবোর্ড</h1>

      <div className="row" style={{ alignItems: 'stretch' }}>
        <Link to="/orders" className="panel grow stack" style={{ gap: 2, color: 'var(--text)' }}>
          <span className="muted small">অপেক্ষার অর্ডার</span>
          <b style={{ fontSize: 30, color: d.pendingOrders ? 'var(--warn)' : 'var(--text)' }}>{nf.format(d.pendingOrders)}</b>
        </Link>
        <Link to="/support" className="panel grow stack" style={{ gap: 2, color: 'var(--text)' }}>
          <span className="muted small">খোলা সাপোর্ট</span>
          <b style={{ fontSize: 30, color: d.openTickets ? 'var(--warn)' : 'var(--text)' }}>{nf.format(d.openTickets)}</b>
        </Link>
        <Link to="/products" className="panel grow stack" style={{ gap: 2, color: 'var(--text)' }}>
          <span className="muted small">প্রোডাক্ট</span>
          <b style={{ fontSize: 30 }}>{nf.format(d.products)}</b>
        </Link>
      </div>

      <section className="panel stack">
        <div className="row between">
          <b>গত ৭ দিনের ভিজিট ({nf.format(visits7)})</b>
          <HelpHint>প্রতিদিন কতজন সাইটে এসেছে। একজন একই সেশনে একবারই গোনা হয়।</HelpHint>
        </div>
        <Bars rows={d.last7} field="visits" color="var(--accent)" />
        <div style={{ display: 'flex', gap: 6 }}>
          {d.last7.map((r) => (
            <span key={r.day} className="small muted" style={{ flex: 1, textAlign: 'center' }}>
              {dayLabel(r.day)}
            </span>
          ))}
        </div>
      </section>

      <section className="panel stack">
        <b>গত ৭ দিনে কনফার্ম হওয়া অর্ডার ({nf.format(orders7)})</b>
        <Bars rows={d.last7} field="orders" color="var(--ok)" />
      </section>

      {env && (
        <section className="panel stack">
          <div className="row between">
            <b>
              সেটআপ পরীক্ষা{' '}
              <span style={{ color: problems.length ? 'var(--warn)' : 'var(--ok)' }}>{problems.length ? `(${nf.format(problems.length)}টি সমস্যা)` : '(সব ঠিক)'}</span>
            </b>
            <HelpHint title="এটা কী?">
              Render এর Environment এ যেসব গোপন সেটিং (Firebase, পেমেন্ট নম্বর, imgbb, Gemini) দিয়েছেন সেগুলো ঠিক আছে কিনা এখানে দেখায়। মান কখনো দেখানো হয় না। ⚠ বা ✖ থাকলে ওই নামের সেটিং Render এ ঠিক করে ডিপ্লয় করুন।
            </HelpHint>
          </div>
          {shown.map((i) => (
            <div key={i.name} className="small" style={{ color: COLOR[i.level] }}>
              {ICON[i.level]} <b>{i.name}</b>: {i.msg}
            </div>
          ))}
          <button type="button" className="btn btn-sm btn-ghost" style={{ alignSelf: 'flex-start' }} onClick={() => setAll((v) => !v)}>
            {all ? 'শুধু সমস্যাগুলো দেখান' : 'সবগুলো দেখান'}
          </button>
        </section>
      )}
    </div>
  );
                                                             }
