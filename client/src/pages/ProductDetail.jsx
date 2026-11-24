// FILE: ProductDetail.jsx
// PATH: client/src/pages/ProductDetail.jsx (রিপোতে client/src/pages ফোল্ডারের ভেতরে)
// কাজ: প্রোডাক্টের পেজ (/p/:slug ও /product/:slug): কভার, নাম, হেডলাইন, ক্যাপশন, দাম (অফারের কাউন্টডাউনসহ), লাইক/ডিসলাইক (শুধু আসল, লগইন লাগে),
// শেয়ার, "কী জানবেন", বিবরণ, সূচিপত্র, ফরম্যাট, সম্পর্কিত প্রোডাক্ট, আর নিচে আটকানো কেনার বার।
// কেনা থাকলে বার "এখনই পড়ুন" দেখায়; অর্ডার যাচাই চলছে এমন হলে "কনফার্মের অপেক্ষায়"।

import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { catalog, content, guest } from '../api.js';
import { useI18n } from '../i18n/index.js';
import { useMarket } from '../context/MarketContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import PriceTag from '../components/PriceTag.jsx';
import ShareButton from '../components/ShareButton.jsx';
import ProductCard from '../components/ProductCard.jsx';
import Skeleton from '../components/Skeleton.jsx';
import { toast } from '../components/Toast.jsx';

const FORMAT_NAMES = { pdf: 'PDF', epub: 'EPUB' };

export default function ProductDetail() {
  const { slug } = useParams();
  const nav = useNavigate();
  const { t, lang, fmtNumber, errMsg } = useI18n();
  const { market, country } = useMarket();
  const { user, ready, loggedIn } = useAuth();
  const cart = useCart();

  const [state, setState] = useState({ loading: true });
  const [mine, setMine] = useState(null); // myReaction
  const [counts, setCounts] = useState({ likes: 0, dislikes: 0 });
  const [owned, setOwned] = useState(false);
  const [busy, setBusy] = useState(false);

  // প্রোডাক্ট আনা (ভাষা/বাজার/লগইন বদলালে আবার; লগইন জানার পরেই, যাতে নিজের লাইক আসে)
  useEffect(() => {
    if (!ready) return undefined;
    let live = true;
    setState((s) => (s.data && s.data.product.slug === slug ? s : { loading: true }));
    catalog
      .product(slug)
      .then((r) => {
        if (!live) return;
        setState({ data: r });
        setMine(r.myReaction || null);
        setCounts({ likes: r.product.likes, dislikes: r.product.dislikes });
      })
      .catch((err) => live && setState({ err }));
    return () => {
      live = false;
    };
  }, [slug, lang, market, country, ready, user && user.uid]); // eslint-disable-line react-hooks/exhaustive-deps

  const p = state.data && state.data.product;

  // কেনা আছে কিনা: লগইনে লাইব্রেরি, গেস্টে এই ডিভাইসের অর্ডার
  useEffect(() => {
    if (!p || !ready) return undefined;
    let live = true;
    if (loggedIn) {
      content
        .library()
        .then((r) => live && setOwned((r.items || []).some((i) => i.productId === p.id)))
        .catch(() => {});
    } else {
      setOwned(false);
    }
    return () => {
      live = false;
    };
  }, [p && p.id, ready, loggedIn]); // eslint-disable-line react-hooks/exhaustive-deps

  const guestOrder = !loggedIn && p ? guest.orders().find((o) => (o.items || []).some((i) => i.productId === p.id)) : null;
  const guestOwned = !!guestOrder && guestOrder.status === 'confirmed';
  const guestPending = !!guestOrder && guestOrder.status === 'pending';
  const canRead = owned || guestOwned;

  async function react(value) {
    if (!loggedIn) {
      toast(t('product.loginToReact'));
      return;
    }
    if (busy) return;
    setBusy(true);
    try {
      const r = await catalog.react(p.id, mine === value ? 'none' : value);
      setMine(r.myReaction || null);
      setCounts({ likes: r.likes, dislikes: r.dislikes });
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(false);
    }
  }

  if (state.loading) {
    return (
      <div className="stack">
        <Skeleton h={300} />
        <Skeleton h={26} w="70%" />
        <Skeleton h={18} w="40%" />
        <Skeleton h={90} />
      </div>
    );
  }
  if (state.err) {
    const unavailable = state.err.code === 'not_available_in_market';
    return (
      <div className="empty">
        <b>{unavailable ? t('product.unavailable') : state.err.status === 404 ? t('product.notFound') : errMsg(state.err)}</b>
        <Link to="/" className="btn btn-primary">
          {t('errors.goHome')}
        </Link>
      </div>
    );
  }

  const { related, shareUrl } = state.data;
  const inCart = cart.has(p.id);
  const hasToc = Array.isArray(p.toc) && p.toc.length > 0;
  const hasChapters = Array.isArray(p.chapters) && p.chapters.length > 0;

  function buyNow() {
    cart.add(p);
    nav('/checkout');
  }

  const stats = [];
  stats.push(t('card.type.' + p.type));
  if (p.chapterCount > 0) stats.push(t('card.chapters', { n: fmtNumber(p.chapterCount) }));
  if (p.pageCount > 0) stats.push(t('product.pages', { n: fmtNumber(p.pageCount) }));
  if (p.wordCount > 0) stats.push(t('product.words', { n: fmtNumber(p.wordCount) }));
  if (p.soldTier) stats.push(t('card.sold', { n: fmtNumber(p.soldTier) }));

  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="row" style={{ alignItems: 'flex-start', gap: 16 }}>
        <div className="pcard-cover" style={{ width: '38%', flexShrink: 0 }}>
          {p.coverUrl && <img src={p.coverUrl} alt={p.title} decoding="async" />}
          {p.badges && p.badges.length > 0 && (
            <div className="badges">
              {p.badges.slice(0, 2).map((b) => (
                <span key={b} className={'badge ' + b}>
                  {t('card.badge.' + b)}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="stack grow" style={{ gap: 8 }}>
          <h1>{p.title}</h1>
          {p.headline && <p style={{ fontWeight: 600 }}>{p.headline}</p>}
          <PriceTag price={p.price} size="lg" countdown />
          <span className="muted small">{stats.join(' · ')}</span>
        </div>
      </div>

      {p.textReady === false && <div className="alert warn small">{t('card.textNotReady')}</div>}
      {p.caption && <p className="muted">{p.caption}</p>}

      <div className="row wrap">
        <button type="button" className={'btn btn-sm' + (mine === 'like' ? ' btn-primary' : '')} onClick={() => react('like')} disabled={busy}>
          👍 {t('product.like')} {counts.likes > 0 && fmtNumber(counts.likes)}
        </button>
        <button type="button" className={'btn btn-sm' + (mine === 'dislike' ? ' btn-primary' : '')} onClick={() => react('dislike')} disabled={busy}>
          👎 {t('product.dislike')} {counts.dislikes > 0 && fmtNumber(counts.dislikes)}
        </button>
        <ShareButton url={shareUrl} title={p.title} text={p.headline || p.caption} className="btn-sm" />
      </div>
      {!loggedIn && <p className="hint">{t('product.loginToReact')}</p>}

      {p.bullets.length > 0 && (
        <section className="stack">
          <h2>{t('product.whatYouLearn')}</h2>
          <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {p.bullets.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
        </section>
      )}

      {p.description && (
        <section className="stack">
          <h2>{t('product.description')}</h2>
          <p style={{ whiteSpace: 'pre-wrap' }}>{p.description}</p>
        </section>
      )}

      {(hasToc || hasChapters) && (
        <section className="stack">
          <h2>{t(hasToc ? 'product.toc' : 'product.chapters')}</h2>
          <ol style={{ margin: 0, paddingLeft: 22, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {hasToc
              ? p.toc.map((x, i) => <li key={i}>{typeof x === 'string' ? x : x && x.title}</li>)
              : p.chapters.map((c) => <li key={c.id}>{c.title || t('reader.chapter', { n: c.number })}</li>)}
          </ol>
        </section>
      )}

      {p.formats.length > 0 && (
        <section className="stack">
          <h2>{t('product.formats')}</h2>
          <div className="row wrap">
            {p.formats.map((f) => (
              <span key={f} className="chip">
                {FORMAT_NAMES[String(f).toLowerCase()] || String(f).toUpperCase()}
              </span>
            ))}
          </div>
        </section>
      )}

      {related && related.length > 0 && (
        <section className="stack">
          <h2>{t('product.related')}</h2>
          <div className="grid">
            {related.slice(0, 6).map((r) => (
              <ProductCard key={r.id} product={r} />
            ))}
          </div>
        </section>
      )}

      <div className="buybar">
        <div className="buybar-in">
          {canRead ? (
            <>
              <span className="grow muted small">{t('product.inLibrary')}</span>
              <Link to={'/read/' + p.id} className="btn btn-primary" style={{ flex: 2 }}>
                {t('product.read')}
              </Link>
            </>
          ) : guestPending ? (
            <>
              <span className="grow muted small">{t('library.waiting')}</span>
              <Link to="/orders" className="btn">
                {t('nav.orders')}
              </Link>
            </>
          ) : (
            <>
              <div className="grow">
                <PriceTag price={p.price} size="md" />
              </div>
              {inCart ? (
                <Link to="/cart" className="btn">
                  {t('product.goToCart')}
                </Link>
              ) : (
                <button type="button" className="btn" onClick={() => cart.add(p)}>
                  {t('product.addToCart')}
                </button>
              )}
              <button type="button" className="btn btn-primary" onClick={buyNow}>
                {t('product.buyNow')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
        }
