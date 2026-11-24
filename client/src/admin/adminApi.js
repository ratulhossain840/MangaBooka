// FILE: adminApi.js
// PATH: client/src/admin/adminApi.js (রিপোতে client/src/admin ফোল্ডারের ভেতরে)
// কাজ: অ্যাডমিনের সব API কল এখান দিয়ে। /api/admin এর পথ নিজে বসে, লগইন টোকেন সবসময় যায়। বার্তা বাংলায়।
// ব্যবহার: const r = await adm.get('/orders?status=pending');  await adm.post('/orders/ID/confirm', {});  adm.put(path, body);  adm.del(path)
//         try { ... } catch (e) { setErr(admErr(e)); }

import { api } from '../api.js';

const opt = (o) => ({ ...o, auth: 'required' });

export const adm = {
  get: (p, o) => api.get('/api/admin' + p, opt(o)),
  post: (p, b, o) => api.post('/api/admin' + p, b, opt(o)),
  put: (p, b, o) => api.put('/api/admin' + p, b, opt(o)),
  del: (p, o) => api.del('/api/admin' + p, opt(o)),
};

// ত্রুটি থেকে বাংলা বার্তা (সার্ভারের বাংলা বার্তা থাকলে সেটাই)
export function admErr(err) {
  if (!err) return 'সমস্যা হয়েছে';
  if (err.code === 'network') return 'ইন্টারনেট সংযোগ নেই';
  if (err.code === 'timeout') return 'অনেক সময় লাগছে, আবার চেষ্টা করুন';
  if (err.status === 401) return 'আবার লগইন করুন';
  if (err.status === 403) return 'এই কাজের অনুমতি নেই';
  if (err.status === 429) return 'অনেকবার চেষ্টা হয়েছে, একটু পরে আবার করুন';
  if (typeof err.message === 'string' && /[ঀ-৿]/.test(err.message)) return err.message;
  if (err.status >= 500) return 'সার্ভারে সমস্যা, একটু পরে আবার চেষ্টা করুন';
  if (err.status === 404) return 'পাওয়া যায়নি';
  return 'সমস্যা হয়েছে' + (err.message ? ': ' + err.message : '');
}
