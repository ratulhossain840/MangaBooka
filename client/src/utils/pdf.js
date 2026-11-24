// FILE: pdf.js
// PATH: client/src/utils/pdf.js (রিপোতে client/src/utils ফোল্ডারের ভেতরে)
// কাজ: ব্রাউজারেই ই-বুকের টেক্সট থেকে PDF বানানো (বাইরের লাইব্রেরি ছাড়া)।
// বাংলা/জাপানি/চীনা ইত্যাদি সব ভাষার অক্ষর ঠিক রাখতে প্রতিটি পেজ ফোনের নিজের ফন্টে ক্যানভাসে আঁকা হয়, তারপর ছবি (JPEG) হিসেবে PDF-এ বসে।
// তাই PDF-এর লেখা সিলেক্ট/কপি করা যায় না, আর ফাইল একটু বড় হয় (পেজ প্রতি প্রায় ১০০–২০০ KB)।
//
// ব্যবহার: const blob = await buildPdf({ title, chapters:[{title,pages:[..]}], onProgress:(done,total)=>{} });  saveBlob(blob,'book.pdf')

const PX_W = 874; // A5 ~150dpi
const PX_H = 1240;
const PT_W = 420;
const PT_H = 595;
const MARGIN = 80;

const tick = () => new Promise((r) => setTimeout(r, 0));

// লেখাকে লাইনে ভাগ (শব্দ ধরে; ফাঁকা না থাকলে অক্ষর ধরে)
function wrap(ctx, text, maxW) {
  const lines = [];
  for (const par of String(text || '').split('\n')) {
    if (!par.trim()) {
      lines.push('');
      continue;
    }
    const hasSpace = /\s/.test(par);
    const units = hasSpace ? par.split(/(\s+)/).filter((x) => x !== '') : Array.from(par);
    let cur = '';
    for (const u of units) {
      const test = cur + u;
      if (ctx.measureText(test).width > maxW && cur.trim()) {
        lines.push(cur.trimEnd());
        cur = hasSpace ? u.trimStart() : u;
      } else {
        cur = test;
      }
    }
    if (cur.trim()) lines.push(cur.trimEnd());
  }
  return lines;
}

// ---------- নিচু স্তর: JPEG পেজগুলো থেকে PDF ফাইল ----------
// images: [{ bytes: Uint8Array(JPEG), width, height }], title: string
export function assemblePdf(images, title = '') {
  const enc = new TextEncoder();
  const chunks = [];
  const offsets = [];
  let len = 0;
  const push = (x) => {
    const b = typeof x === 'string' ? enc.encode(x) : x;
    chunks.push(b);
    len += b.length;
  };
  const obj = (n, body) => {
    offsets[n] = len;
    push(`${n} 0 obj\n`);
    push(body);
    push('\nendobj\n');
  };
  const n = images.length;
  // নম্বর: 1 Catalog, 2 Pages, 3 Info, তারপর প্রতি পেজে ৩টি (Page, Content, Image)
  push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
  obj(2, `<< /Type /Pages /Count ${n} /Kids [${images.map((_, i) => `${4 + i * 3} 0 R`).join(' ')}] >>`);
  // Info: শিরোনাম UTF-16BE hex
  let hex = 'FEFF';
  for (const ch of String(title).slice(0, 120)) {
    const cp = ch.codePointAt(0);
    if (cp > 0xffff) {
      const v = cp - 0x10000;
      hex += (0xd800 + (v >> 10)).toString(16).padStart(4, '0') + (0xdc00 + (v & 0x3ff)).toString(16).padStart(4, '0');
    } else hex += cp.toString(16).padStart(4, '0');
  }
  obj(3, `<< /Title <${hex}> /Producer (MangaBooka) >>`);
  images.forEach((img, i) => {
    const page = 4 + i * 3;
    obj(page, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PT_W} ${PT_H}] /Resources << /XObject << /Im0 ${page + 2} 0 R >> >> /Contents ${page + 1} 0 R >>`);
    const content = `q ${PT_W} 0 0 ${PT_H} 0 0 cm /Im0 Do Q`;
    obj(page + 1, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
    offsets[page + 2] = len;
    push(`${page + 2} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${img.width} /Height ${img.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${img.bytes.length} >>\nstream\n`);
    push(img.bytes);
    push('\nendstream\nendobj\n');
  });
  const total = 4 + n * 3;
  const xref = len;
  let x = `xref\n0 ${total}\n0000000000 65535 f \n`;
  for (let i = 1; i < total; i++) x += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
  push(x + `trailer\n<< /Size ${total} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${xref}\n%%EOF\n`);

  const out = new Uint8Array(len);
  let pos = 0;
  for (const c of chunks) {
    out.set(c, pos);
    pos += c.length;
  }
  return out;
}

// ---------- উঁচু স্তর: টেক্সট থেকে PDF ----------
export async function buildPdf({ title, chapters = [], onProgress } = {}) {
  const fontFam = getComputedStyle(document.documentElement).getPropertyValue('--font-read') || 'serif';
  const FS = 27;
  const LH = Math.round(FS * 1.75);
  const maxW = PX_W - MARGIN * 2;
  const pagesCanvas = [];

  let canvas;
  let ctx;
  let y;
  const newPage = () => {
    canvas = document.createElement('canvas');
    canvas.width = PX_W;
    canvas.height = PX_H;
    ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, PX_W, PX_H);
    ctx.fillStyle = '#111111';
    ctx.textBaseline = 'top';
    y = MARGIN;
    pagesCanvas.push(canvas);
  };
  const font = (size, bold) => {
    ctx.font = `${bold ? 'bold ' : ''}${size}px ${fontFam}`;
  };

  newPage();
  // কভার পেজ: বইয়ের নাম
  font(46, true);
  const tl = wrap(ctx, title || '', maxW);
  let ty = PX_H / 3;
  for (const l of tl) {
    ctx.fillText(l, MARGIN, ty);
    ty += 66;
  }

  let done = 0;
  const totalPages = chapters.reduce((s, c) => s + (c.pages || []).length, 0) || 1;

  for (const ch of chapters) {
    newPage();
    font(36, true);
    for (const l of wrap(ctx, ch.title || '', maxW)) {
      ctx.fillText(l, MARGIN, y);
      y += 52;
    }
    y += 24;
    for (const pageText of ch.pages || []) {
      font(FS, false);
      for (const line of wrap(ctx, pageText, maxW)) {
        if (y + LH > PX_H - MARGIN) {
          newPage();
          font(FS, false);
        }
        if (line) ctx.fillText(line, MARGIN, y);
        y += line ? LH : Math.round(LH * 0.6);
      }
      y += Math.round(LH * 0.6); // সোর্স পেজের মাঝে ফাঁক
      done += 1;
      if (onProgress) onProgress(done, totalPages);
      if (done % 3 === 0) await tick();
    }
  }

  const images = [];
  for (let i = 0; i < pagesCanvas.length; i++) {
    const blob = await new Promise((res) => pagesCanvas[i].toBlob(res, 'image/jpeg', 0.78));
    if (!blob) throw new Error('canvas toBlob failed');
    images.push({ bytes: new Uint8Array(await blob.arrayBuffer()), width: PX_W, height: PX_H });
    pagesCanvas[i].width = 1; // মেমরি ছাড়ি
    if (i % 4 === 3) await tick();
  }
  return new Blob([assemblePdf(images, title)], { type: 'application/pdf' });
}
