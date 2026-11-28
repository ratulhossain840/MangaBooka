// FILE: Home.jsx
// PATH: client/src/pages/Home.jsx (রিপোতে client/src/pages ফোল্ডারের ভেতরে)
// কাজ: হোম পেজ: OMNI-MANGA স্টাইলের Hero, Genre স্ট্রিপ, ঘোষণা, ব্যানার, সেকশন (featured / new / trending / sale)।

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { catalog } from '../api.js';
import { useI18n } from '../i18n/index.js';
import { useMarket } from '../context/MarketContext.jsx';
import ProductCard from '../components/ProductCard.jsx';
import InstallButton from '../components/InstallButton.jsx';
import { SkeletonGrid } from '../components/Skeleton.jsx';

const SECTIONS = [
  ['featured', 'home.featured'],
  ['new', 'home.new'],
  ['trending', 'home.trending'],
  ['sale', 'home.sale'],
];

const GENRES = [
  { key: 'shonen', label: 'Shonen', to: '/manga?genre=shonen' },
  { key: 'isekai', label: 'Isekai', to: '/manga?genre=isekai' },
  { key: 'shojo', label: 'Shojo', to: '/manga?genre=shojo' },
  { key: 'seinen', label: 'Seinen', to: '/manga?genre=seinen' },
];

const rowStyle = {
  display: 'grid',
  gridAutoFlow: 'column',
  gridAutoColumns: 'calc((100% - 20px) / 3.2)',
  gap: 10,
  overflowX: 'auto',
  scrollSnapType: 'x proximity',
  paddingBottom: 6,
  scrollbarWidth: 'none',
};

function BannerLink({ to, children }) {
  if (!to) return <div className="banner-in">{children}</div>;
  if (/^https?:\/\//i.test(to)) {
    return (
      <a href={to} className="banner-in" target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    );
  }
  return (
    <Link to={to} className="banner-in">
      {children}
    </Link>
  );
}

export default function Home() {
  const { t, lang, errMsg } = useI18n();
  const { config, market, country } = useMarket();
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let live = true;
    setErr(null);
    catalog
      .home()
      .then((r) => live && setData(r.sections))
      .catch((e) => live && setErr(e));
    return () => {
      live = false;
    };
  }, [lang, market, country, tick]);

  const banners = (config && config.banners) || [];
  const ann = config && config.announcement;
  const anyItems = data && SECTIONS.some(([k]) => (data[k] || []).length > 0);

  return (
    <div className="stack" style={{ gap: 22 }}>
      {ann && ann.text && (
        <div className="alert">
          {ann.link ? (
            <a href={ann.link} style={{ color: 'inherit' }}>
              {ann.text}
            </a>
          ) : (
            ann.text
          )}
        </div>
      )}

      {/* ===== OMNI-style Hero ===== */}
      <section className="hero">
        <h1 className="hero-title">{t('home.heroTitle') || 'EXPLORE WORLDS'}</h1>
        <p className="hero-sub">{t('home.heroSub') || 'Your next story awaits.'}</p>
        <div className="hero-actions">
          <Link to="/manga" className="btn btn-primary">
            {t('home.shopManga') || 'Browse Manga'}
          </Link>
          <Link to="/ebook" className="btn">
            {t('home.shopEbook') || 'E-Books'}
          </Link>
        </div>
      </section>

      {/* Genre strip */}
      <div className="genre-strip">
        {GENRES.map((g) => (
          <Link key={g.key} to={g.to} className="genre-card">
            <span style={{ fontSize: 22, lineHeight: 1 }}>✦</span>
            <span>{g.label}</span>
          </Link>
        ))}
      </div>

      {banners.length > 0 && (
        <div style={{ ...rowStyle, gridAutoColumns: '100%', gap: 12 }}>
          {banners.map((b) => (
            <div key={b.id} style={{ scrollSnapAlign: 'start' }}>
              <BannerLink to={b.link}>
                <div
                  style={{
                    position: 'relative',
                    borderRadius: 'var(--radius)',
                    overflow: 'hidden',
                    aspectRatio: '16 / 8',
                    background: 'var(--surface-solid)',
                    border: '1px solid var(--border)',
                  }}
                >
                  <img
                    src={b.image}
                    alt={b.title || ''}
                    loading="lazy"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  {(b.title || b.subtitle || b.cta) && (
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'flex-end',
                        gap: 4,
                        padding: 14,
                        background: 'linear-gradient(transparent 25%, rgba(0,0,0,.8))',
                      }}
                    >
                      {b.title && <b style={{ fontSize: 18 }}>{b.title}</b>}
                      {b.subtitle && <span className="small muted">{b.subtitle}</span>}
                      {b.cta && (
                        <span className="badge" style={{ alignSelf: 'flex-start' }}>
                          {b.cta}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </BannerLink>
            </div>
          ))}
        </div>
      )}

      <InstallButton />

      {err && !data && (
        <div className="empty">
          <span>{errMsg(err)}</span>
          <button type="button" className="btn" onClick={() => setTick((n) => n + 1)}>
            {t('common.retry')}
          </button>
        </div>
      )}
      {!data && !err && <SkeletonGrid count={6} />}
      {data && !anyItems && <div className="empty">{t('home.empty')}</div>}

      {data &&
        SECTIONS.map(([key, label]) => {
          const list = data[key] || [];
          if (!list.length) return null;
          return (
            <section key={key} className="stack" style={{ gap: 10 }}>
              <div className="section-title">
                <h2>{t(label)}</h2>
                {key === 'trending' && (
                  <Link to="/manga">{t('common.seeAll') || 'See all'}</Link>
                )}
              </div>
              <div style={rowStyle}>
                {list.map((p) => (
                  <div key={p.id} style={{ scrollSnapAlign: 'start' }}>
                    <ProductCard product={p} />
                  </div>
                ))}
              </div>
            </section>
          );
        })}
    </div>
  );
    }
