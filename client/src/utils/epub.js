// FILE: epub.js
// PATH: client/src/utils/epub.js (রিপোতে client/src/utils ফোল্ডারের ভেতরে)
// কাজ: ব্রাউজারেই ই-বুকের টেক্সট থেকে EPUB ফাইল বানানো (বাইরের লাইব্রেরি ছাড়া, নিজস্ব ছোট ZIP লেখক)। ফাইল ক্রেতার নিজের ফোনেই তৈরি হয়, সার্ভারে যায় না।
//
// ব্যবহার: const blob = buildEpub({ title, lang, author, chapters: [{ title, pages: ['...'] }] });  saveBlob(blob, 'book.epub');

const enc = new TextEncoder();

// ---------- CRC32 ----------
let TABLE = null;
function crc32(bytes) {
  if (!TABLE) {
    TABLE = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      TABLE[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) crc = TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

// ---------- ZIP (সংকোচন ছাড়া, "stored") ----------
// files: [{ name, data: string | Uint8Array }]  -> Uint8Array
export function zipStore(files) {
  const parts = [];
  const central = [];
  let offset = 0;
  const now = new Date();
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
  const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();

  for (const f of files) {
    const name = enc.encode(f.name);
    const data = typeof f.data === 'string' ? enc.encode(f.data) : f.data;
    const crc = crc32(data);

    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true);
    lh.setUint16(4, 20, true);
    lh.setUint16(6, 0x0800, true); // UTF-8 নাম
    lh.setUint16(8, 0, true); // stored
    lh.setUint16(10, dosTime, true);
    lh.setUint16(12, dosDate, true);
    lh.setUint32(14, crc, true);
    lh.setUint32(18, data.length, true);
    lh.setUint32(22, data.length, true);
    lh.setUint16(26, name.length, true);
    lh.setUint16(28, 0, true);
    parts.push(new Uint8Array(lh.buffer), name, data);

    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true);
    ch.setUint16(4, 20, true);
    ch.setUint16(6, 20, true);
    ch.setUint16(8, 0x0800, true);
    ch.setUint16(10, 0, true);
    ch.setUint16(12, dosTime, true);
    ch.setUint16(14, dosDate, true);
    ch.setUint32(16, crc, true);
    ch.setUint32(20, data.length, true);
    ch.setUint32(24, data.length, true);
    ch.setUint16(28, name.length, true);
    ch.setUint32(42, offset, true);
    central.push(new Uint8Array(ch.buffer), name);

    offset += 30 + name.length + data.length;
  }

  let cdSize = 0;
  for (const c of central) cdSize += c.length;
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, cdSize, true);
  end.setUint32(16, offset, true);

  const all = [...parts, ...central, new Uint8Array(end.buffer)];
  const total = all.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(total);
  let pos = 0;
  for (const p of all) {
    out.set(p, pos);
    pos += p.length;
  }
  return out;
}

// ---------- EPUB ----------
const esc = (s) =>
  String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const paras = (text) =>
  String(text || '')
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${esc(p)}</p>`)
    .join('\n');

const CSS = `body{font-family:serif;line-height:1.7;margin:5%}h1{font-size:1.4em;margin:1.2em 0 .8em}p{margin:0 0 1em;text-align:left}`;

export function buildEpub({ title, lang = 'en', author = 'MangaBooka', chapters = [] }) {
  const id = 'urn:uuid:' + (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2));
  const chs = chapters.map((c, i) => ({ file: `ch${i + 1}.xhtml`, title: c.title || `${i + 1}`, body: (c.pages || []).map(paras).join('\n<hr/>\n') }));

  const xhtml = (t, inner) =>
    `<?xml version="1.0" encoding="utf-8"?>\n<!DOCTYPE html>\n<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="${esc(lang)}" xml:lang="${esc(lang)}"><head><meta charset="utf-8"/><title>${esc(t)}</title><link rel="stylesheet" type="text/css" href="style.css"/></head><body>${inner}</body></html>`;

  const files = [
    { name: 'mimetype', data: 'application/epub+zip' },
    {
      name: 'META-INF/container.xml',
      data: `<?xml version="1.0"?>\n<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`,
    },
    { name: 'OEBPS/style.css', data: CSS },
    ...chs.map((c) => ({ name: 'OEBPS/' + c.file, data: xhtml(c.title, `<h1>${esc(c.title)}</h1>\n${c.body}`) })),
    {
      name: 'OEBPS/nav.xhtml',
      data: xhtml(title, `<nav epub:type="toc" id="toc"><h1>${esc(title)}</h1><ol>${chs.map((c) => `<li><a href="${c.file}">${esc(c.title)}</a></li>`).join('')}</ol></nav>`),
    },
    {
      name: 'OEBPS/toc.ncx',
      data: `<?xml version="1.0" encoding="utf-8"?>\n<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1"><head><meta name="dtb:uid" content="${esc(id)}"/></head><docTitle><text>${esc(title)}</text></docTitle><navMap>${chs
        .map((c, i) => `<navPoint id="n${i + 1}" playOrder="${i + 1}"><navLabel><text>${esc(c.title)}</text></navLabel><content src="${c.file}"/></navPoint>`)
        .join('')}</navMap></ncx>`,
    },
    {
      name: 'OEBPS/content.opf',
      data: `<?xml version="1.0" encoding="utf-8"?>\n<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="bookid">${esc(id)}</dc:identifier><dc:title>${esc(title)}</dc:title><dc:language>${esc(lang)}</dc:language><dc:creator>${esc(author)}</dc:creator><meta property="dcterms:modified">${new Date().toISOString().replace(/\.\d+Z$/, 'Z')}</meta></metadata><manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/><item id="css" href="style.css" media-type="text/css"/>${chs
        .map((c, i) => `<item id="c${i + 1}" href="${c.file}" media-type="application/xhtml+xml"/>`)
        .join('')}</manifest><spine toc="ncx">${chs.map((c, i) => `<itemref idref="c${i + 1}"/>`).join('')}</spine></package>`,
    },
  ];
  return new Blob([zipStore(files)], { type: 'application/epub+zip' });
}

// ---------- ডাউনলোড (ফোনের ব্রাউজারে ফাইল সেভ) ----------
export function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 4000);
}

export const safeFileName = (s) => String(s || 'book').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').trim().slice(0, 80) || 'book';
