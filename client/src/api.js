// FILE: api.js
// PATH: client/src/api.js (রিপোতে client/src ফোল্ডারের ভেতরে)
// কাজ: সার্ভারের API-র সাথে কথা বলার একমাত্র জায়গা। লগইন টোকেন, ভাষা/দেশ (?lang ?country), সময়সীমা,
// ত্রুটি সামলানো, গেস্ট অর্ডারের গোপন কোড মনে রাখা, UTM ও ভিজিট গণনা এখানে।
//
// ত্রুটি: সব ব্যর্থতা ApiError ছোড়ে { status, code, message, data }।
//   code: সার্ভারের কোড (login_required, forbidden, too_many_requests ...) বা 'network' / 'timeout' / 'aborted'
//   মানুষের ভাষার বার্তার জন্য i18n/index.js-এর errMsg(err) ব্যবহার করুন।

import { getIdToken, currentUser } from './firebase.js';

// ---------- ছোট সহায়ক ----------
const lsGet = (k) => {
  try {
    return window.localStorage.getItem(k);
  } catch {
    return null;
  }
};
const lsSet = (k, v) => {
  try {
    window.localStorage.setItem(k, v);
  } catch {
    /* প্রাইভেট মোডে চলবে না, সমস্যা নেই */
  }
};
const lsJson = (k, fallback) => {
  try {
    const v = JSON.parse(lsGet(k));
    return v == null ? fallback : v;
  } catch {
    return fallback;
  }
};
const ssGet = (k) => {
  try {
    return window.sessionStorage.getItem(k);
  } catch {
    return null;
  }
};
const ssSet = (k, v) => {
  try {
    window.sessionStorage.setItem(k, v);
  } catch {
    /* ignore */
  }
};

export class ApiError extends Error {
  constructor(status, message, code, data) {
    super(message || 'error');
    this.name = 'ApiError';
    this.status = status;
    this.code = code || null;
    this.data = data || null;
  }
}

// ---------- ভাষা ও দেশ (প্রতিটি রিকোয়েস্টে ?lang= ও ?country= যায়) ----------
// সার্ভার দাম/বাজার (টাকা বা ডলার) এই দুটো দিয়েই ঠিক করে, তাই অর্ডার পাঠানোর সময়ও যায়।
const ctx = { lang: null, country: null };

export function setApiContext(p = {}) {
  if (p.lang !== undefined) ctx.lang = p.lang;
  if (p.country !== undefined) ctx.country = p.country;
}
export const getApiContext = () => ({ lang: ctx.lang || lsGet('mb_lang') || null, country: ctx.country });

function buildUrl(path, params) {
  const u = new URL(path, window.location.origin);
  const { lang, country } = getApiContext();
  if (lang && !u.searchParams.has('lang')) u.searchParams.set('lang', lang);
  if (country && !u.searchParams.has('country')) u.searchParams.set('country', country);
  for (const [k, v] of Object.entries(params || {})) {
    if (v !== undefined && v !== null && v !== '') u.searchParams.set(k, String(v));
  }
  return u.pathname + u.search;
}

// ---------- মূল রিকোয়েস্ট ----------
// auth: 'optional' (লগইন থাকলে টোকেন যায়) | 'required' (না থাকলে সাথে সাথে login_required) | 'none'
async function request(method, path, { params, body, auth = 'optional', headers = {}, timeout = 20000, signal } = {}) {
  const url = buildUrl(path, params);
  let usedToken = false;

  const run = async (forceToken) => {
    const h = { Accept: 'application/json', ...headers };
    if (body !== undefined) h['Content-Type'] = 'application/json';
    if (auth !== 'none') {
      const tok = await getIdToken(forceToken);
      if (tok) {
        h.Authorization = 'Bearer ' + tok;
        usedToken = true;
      } else if (auth === 'required') {
        throw new ApiError(401, 'login_required', 'login_required');
      }
    }

    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeout);
    if (signal) {
      if (signal.aborted) ac.abort();
      else signal.addEventListener('abort', () => ac.abort(), { once: true });
    }

    let res;
    try {
      res = await fetch(url, {
        method,
        headers: h,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: ac.signal,
      });
    } catch (e) {
      clearTimeout(timer);
      if (signal && signal.aborted) throw new ApiError(0, 'aborted', 'aborted');
      const timedOut = e && e.name === 'AbortError';
      throw new ApiError(0, timedOut ? 'timeout' : 'network', timedOut ? 'timeout' : 'network');
    }
    clearTimeout(timer);

    let data = null;
    try {
      data = await res.json();
    } catch {
      /* JSON নয়, সমস্যা নেই */
    }
    if (!res.ok) {
      const msg = data && (data.error || data.message);
      const code = typeof msg === 'string' && /^[a-z_]+$/.test(msg) ? msg : null;
      throw new ApiError(res.status, typeof msg === 'string' ? msg : 'error', code, data);
    }
    return data;
  };

  try {
    return await run(false);
  } catch (e) {
    // টোকেনের মেয়াদ ফুরালে একবার নতুন টোকেনে আবার চেষ্টা
    if (e instanceof ApiError && e.status === 401 && usedToken && auth !== 'none') return run(true);
    // শুধু পড়ার (GET) রিকোয়েস্টে নেটওয়ার্ক ঝাঁকুনি হলে একবার আবার চেষ্টা
    if (e instanceof ApiError && e.code === 'network' && method === 'GET') {
      await new Promise((r) => setTimeout(r, 800));
      return run(false);
    }
    throw e;
  }
}

export const api = {
  get: (path, opts) => request('GET', path, opts),
  post: (path, body, opts) => request('POST', path, { ...opts, body: body ?? {} }),
  put: (path, body, opts) => request('PUT', path, { ...opts, body: body ?? {} }),
  del: (path, opts) => request('DELETE', path, opts),
};

// ---------- গেস্টের গোপন কোড (লগইন ছাড়া কিনলে) ----------
// অর্ডারের secret সার্ভার একবারই দেয়, তাই এই ডিভাইসে রাখা হয়, নাহলে কেনা বই আর খোলা যাবে না।
// দ্রষ্টব্য: ব্রাউজার ডেটা মুছলে এগুলো চলে যায়, তাই অর্ডারের পর কোড ও secret আলাদা করে সেভ করতে বলা হয়।
const K_ORDERS = 'mb_guest_orders';
const K_TICKETS = 'mb_guest_tickets';

export const guest = {
  // [{ orderCode, secret, status, items:[{productId,type,slug,title,coverUrl}], createdAt }]
  orders: () => lsJson(K_ORDERS, []),
  saveOrder(o) {
    const list = guest.orders();
    const i = list.findIndex((x) => x.orderCode === o.orderCode);
    if (i >= 0) list[i] = { ...list[i], ...o }; // আগে থেকে থাকলে জায়গা বদলায় না
    else list.unshift({ createdAt: Date.now(), ...o });
    lsSet(K_ORDERS, JSON.stringify(list.slice(0, 30)));
  },
  // এই প্রোডাক্ট পড়ার জন্য কোন অর্ডার-কোড কাজে লাগবে (কনফার্ম হওয়া অর্ডার আগে)
  accessFor(productId) {
    const hits = guest.orders().filter((o) => (o.items || []).some((i) => i.productId === productId));
    const best = hits.find((o) => o.status === 'confirmed') || hits[0];
    return best ? { orderCode: best.orderCode, secret: best.secret } : null;
  },
  saveTicket(id, secret) {
    const t = lsJson(K_TICKETS, {});
    t[id] = secret;
    lsSet(K_TICKETS, JSON.stringify(t));
  },
  ticketSecret: (id) => lsJson(K_TICKETS, {})[id] || null,
  ticketIds: () => Object.keys(lsJson(K_TICKETS, {})),
  forgetAll() {
    lsSet(K_ORDERS, '[]');
    lsSet(K_TICKETS, '{}');
  },
};

const accessHeaders = (productId, access) => {
  const a = access || guest.accessFor(productId);
  return a ? { 'x-order-code': a.orderCode, 'x-order-secret': a.secret } : {};
};

// ---------- UTM ও ভিজিট গণনা ----------
const UTM_KEY = 'mb_utm';

export function captureUtm() {
  try {
    const p = new URLSearchParams(window.location.search);
    const got = {
      source: p.get('utm_source') || '',
      medium: p.get('utm_medium') || '',
      campaign: p.get('utm_campaign') || '',
    };
    if (got.source || got.campaign) lsSet(UTM_KEY, JSON.stringify({ ...got, at: Date.now() }));
  } catch {
    /* ignore */
  }
}

// সর্বশেষ UTM (৭ দিন পর্যন্ত মনে রাখে)
export function getUtm() {
  const u = lsJson(UTM_KEY, null);
  if (!u || Date.now() - (u.at || 0) > 7 * 86400000) return { source: '', medium: '', campaign: '' };
  return { source: u.source || '', medium: u.medium || '', campaign: u.campaign || '' };
}

// প্রতি সেশনে একবার (অ্যাপ খোলার সময়)। productSlug দিলে সেই প্রোডাক্টের ভিউও গোনা হয়।
export async function trackVisit(productSlug) {
  if (ssGet('mb_visited')) return;
  ssSet('mb_visited', '1');
  const u = getUtm();
  try {
    await request('POST', '/api/analytics/visit', {
      auth: 'none',
      timeout: 8000,
      body: { utm_source: u.source, utm_medium: u.medium, utm_campaign: u.campaign, productSlug: productSlug || '' },
    });
  } catch {
    /* গণনা ব্যর্থ হলে ক্রেতার কিছু আসে যায় না */
  }
}

// ---------- ক্যাটালগ ----------
export const catalog = {
  config: () => api.get('/api/catalog/config'),
  home: (type) => api.get('/api/catalog/home', { params: { type } }),
  // params: { type, category, q, sort, limit, cursor }
  products: (params, opts) => api.get('/api/catalog/products', { ...opts, params }),
  product: (slug, opts) => api.get('/api/catalog/product/' + encodeURIComponent(slug), opts),
  react: (id, value) => api.post(`/api/catalog/product/${encodeURIComponent(id)}/react`, { value }, { auth: 'required' }),
};

// ---------- অর্ডার ----------
export const orders = {
  paymentInfo: () => api.get('/api/orders/payment-info', { auth: 'none' }),

  // body: { items:[{productId}], method, trxId, screenshotUrl?, email? } (utm নিজে যোগ হয়)
  // সফল হলে { id, orderCode, secret, currency, total } ফেরত দেয়
  async create(body) {
    const res = await api.post('/api/orders', { ...body, utm: getUtm() });
    if (!currentUser()) {
      // গেস্ট: কোড ও secret এই ডিভাইসে রাখি, আর অর্ডারের বিবরণ নামিয়ে লাইব্রেরির জন্য সেভ করি
      let items = (body.items || []).map((i) => ({ productId: i.productId }));
      let status = 'pending';
      try {
        const v = await api.post('/api/orders/track', { orderCode: res.orderCode, secret: res.secret }, { auth: 'none' });
        items = v.items || items;
        status = v.status || status;
      } catch {
        /* বিবরণ না এলেও কোড সেভ থাকবে */
      }
      guest.saveOrder({ orderCode: res.orderCode, secret: res.secret, status, items });
    }
    return res;
  },

  mine: () => api.get('/api/orders/mine', { auth: 'required' }),

  // গেস্ট অর্ডার দেখা; কোড ও secret মিললে এই ডিভাইসেও সেভ হয় (হাতে কোড বসানোর সময়)
  async track(orderCode, secret, { remember = false } = {}) {
    const v = await api.post('/api/orders/track', { orderCode, secret }, { auth: 'none' });
    if (remember) guest.saveOrder({ orderCode: v.orderCode, secret, status: v.status, items: v.items || [] });
    return v;
  },

  // এই ডিভাইসের সব গেস্ট অর্ডারের নতুন অবস্থা এনে সেভ করে ও ফেরত দেয়
  async refreshGuest() {
    const list = guest.orders();
    const out = [];
    for (const o of list) {
      try {
        const v = await api.post('/api/orders/track', { orderCode: o.orderCode, secret: o.secret }, { auth: 'none' });
        const upd = { ...o, status: v.status, items: v.items || o.items, rejectReason: v.rejectReason || null };
        guest.saveOrder(upd);
        out.push(upd);
      } catch {
        out.push(o); // নেট না থাকলে পুরনোটাই
      }
    }
    return out;
  },

  // লগইন করে গেস্ট অর্ডার নিজের অ্যাকাউন্টে নেওয়া
  claim: (orderCode, secret) => api.post('/api/orders/claim', { orderCode, secret }, { auth: 'required' }),
};

// ---------- কনটেন্ট (কনফার্ম হওয়া ক্রেতার জন্য) ----------
// access: { orderCode, secret } হাতে দিলে সেটা, না দিলে লগইন বা এই ডিভাইসের গেস্ট অর্ডার ব্যবহার হয়
export const content = {
  library: () => api.get('/api/content/library', { auth: 'required' }),
  index: (productId, access) =>
    api.get(`/api/content/${encodeURIComponent(productId)}/index`, { headers: accessHeaders(productId, access) }),
  chapter: (productId, cid, { lang, access } = {}) =>
    api.get(`/api/content/${encodeURIComponent(productId)}/chapter/${encodeURIComponent(cid)}`, {
      params: { lang },
      headers: accessHeaders(productId, access),
    }),
};

// ---------- সাপোর্ট ----------
const ticketHeaders = (id) => {
  const s = guest.ticketSecret(id);
  return s ? { 'x-ticket-secret': s } : {};
};

export const support = {
  // { subject, message, email?, orderCode? } -> { id, secret }; গেস্টের secret এই ডিভাইসে সেভ হয়
  async create(body) {
    const res = await api.post('/api/support', body);
    if (res && res.secret) guest.saveTicket(res.id, res.secret);
    return res;
  },
  mine: () => api.get('/api/support/mine', { auth: 'required' }),
  get: (id) => api.get('/api/support/' + encodeURIComponent(id), { headers: ticketHeaders(id) }),
  reply: (id, message) =>
    api.post(`/api/support/${encodeURIComponent(id)}/reply`, { message }, { headers: ticketHeaders(id) }),
};
