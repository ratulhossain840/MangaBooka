// FILE: Charts.jsx
// PATH: client/src/admin/components/Charts.jsx (রিপোতে client/src/admin/components ফোল্ডারের ভেতরে)
// কাজ: ছোট চার্ট: BarChart (দিনের বার) ও BarList (নামসহ লম্বা বার, যেমন দেশ/ক্যাম্পেইন)। বাইরের লাইব্রেরি লাগে না।
// ব্যবহার: <BarChart data={[{label:'৫/১১', value:12}]} color="var(--accent)" />
//         <BarList items={[{label:'facebook', value:40, sub:'ক্যাম্পেইন: eid'}]} />

const nf = new Intl.NumberFormat('bn-BD');

export default function BarChart({ data = [], color = 'var(--accent)', height = 90 }) {
  const max = Math.max(1, ...data.map((d) => d.value || 0));
  const dense = data.length > 10;
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: dense ? 3 : 6, height }}>
        {data.map((d, i) => (
          <div key={i} title={`${d.label}: ${d.value || 0}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%', gap: 2 }}>
            {!dense && <span className="small muted">{d.value || 0}</span>}
            <div style={{ width: '100%', height: Math.max(3, ((d.value || 0) / max) * (height - (dense ? 4 : 24))), background: color, borderRadius: 3 }} />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: dense ? 3 : 6, marginTop: 4 }}>
        {data.map((d, i) => (
          <span key={i} className="muted" style={{ flex: 1, textAlign: 'center', fontSize: dense ? 9 : 12, overflow: 'hidden' }}>
            {dense && i % 2 ? '' : d.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export function BarList({ items = [], color = 'var(--accent)', empty = 'এখনো তথ্য নেই' }) {
  if (!items.length) return <span className="small muted">{empty}</span>;
  const max = Math.max(1, ...items.map((d) => d.value || 0));
  return (
    <div className="stack" style={{ gap: 8 }}>
      {items.map((d, i) => (
        <div key={i} className="stack" style={{ gap: 2 }}>
          <div className="row between small">
            <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.label}</span>
            <b>{nf.format(d.value || 0)}</b>
          </div>
          <div style={{ height: 8, background: 'var(--surface)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ width: ((d.value || 0) / max) * 100 + '%', height: '100%', background: color }} />
          </div>
          {d.sub && <span className="small muted">{d.sub}</span>}
        </div>
      ))}
    </div>
  );
}
