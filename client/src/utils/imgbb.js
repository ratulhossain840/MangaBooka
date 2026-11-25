// FILE: imgbb.js
// PATH: client/src/utils/imgbb.js (রিপোতে client/src/utils ফোল্ডারের ভেতরে)
// কাজ: অ্যাডমিনের ছবি imgbb তে আপলোড। ছবি আগে ছোট (JPEG) করা হয়, তারপর ব্রাউজার থেকে সরাসরি imgbb তে যায়; imgbb এর চাবি সার্ভার থেকে (শুধু অ্যাডমিন) আসে।
// ব্যবহার: const url = await uploadImage(file, { maxW: 800 });
//         const urls = await uploadMany(files, { maxW: 1600, onProgress: (done,total)=>{} });  // ক্রম ঠিক থাকে

import { adm } from '../admin/adminApi.js';

let keyCache = null;
async function getKey() {
  if (keyCache) return keyCache;
  const r = await adm.get('/imgbb-key');
  if (!r.key) throw new Error('Render এ IMGBB_KEY দেওয়া নেই');
  keyCache = r.key;
  return keyCache;
}

// ছবি ছোট করা: লম্বা দিক maxW এর বেশি হলে কমানো, JPEG
export async function shrink(file, maxW = 1600, quality = 0.85) {
  if (!/^image\/(jpeg|png|webp|gif|bmp)$/i.test(file.type || '')) throw new Error('শুধু ছবি (JPG/PNG/WebP) দিন');
  let bmp;
  try {
    bmp = await createImageBitmap(file);
  } catch {
    throw new Error('ছবিটি পড়া যায়নি');
  }
  const k = Math.min(1, maxW / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * k));
  const h = Math.max(1, Math.round(bmp.height * k));
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bmp, 0, 0, w, h);
  if (bmp.close) bmp.close();
  const blob = await new Promise((ok) => cv.toBlob(ok, 'image/jpeg', quality));
  if (!blob) throw new Error('ছবি ছোট করা যায়নি');
  return blob;
}

export async function uploadImage(file, { maxW = 1600, quality = 0.85 } = {}) {
  const key = await getKey();
  const blob = await shrink(file, maxW, quality);
  const fd = new FormData();
  fd.append('image', blob, 'img.jpg');
  let res;
  try {
    res = await fetch('https://api.imgbb.com/1/upload?key=' + encodeURIComponent(key), { method: 'POST', body: fd });
  } catch {
    throw new Error('ইন্টারনেট সংযোগ নেই');
  }
  let j = null;
  try {
    j = await res.json();
  } catch {
    /* ignore */
  }
  const url = j && j.data && (j.data.url || j.data.display_url);
  if (!res.ok || !url) throw new Error((j && j.error && j.error.message) || 'imgbb তে আপলোড হয়নি');
  return url;
}

// একসাথে ৩টি করে; ফলাফলের ক্রম ফাইলের ক্রমেই। কোনোটা ব্যর্থ হলে একবার আবার চেষ্টা
export async function uploadMany(files, { maxW = 1600, quality = 0.85, onProgress } = {}) {
  const out = new Array(files.length);
  let next = 0;
  let done = 0;
  async function worker() {
    while (next < files.length) {
      const i = next++;
      let err;
      for (let a = 0; a < 2; a++) {
        try {
          out[i] = await uploadImage(files[i], { maxW, quality });
          err = null;
          break;
        } catch (e) {
          err = e;
        }
      }
      if (err) throw new Error(`${i + 1} নং ছবি: ${err.message}`);
      done++;
      if (onProgress) onProgress(done, files.length);
    }
  }
  await Promise.all([worker(), worker(), worker()].slice(0, Math.min(3, files.length)));
  return out;
}

export const sortFiles = (files) => [...files].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
