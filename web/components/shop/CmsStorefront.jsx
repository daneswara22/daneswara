'use client';
/**
 * Penyaji storefront HP berbasis data CMS (Mobile Platform Management).
 *
 * Dipakai di DUA tempat dengan komponen yang sama supaya "Live Mobile Preview"
 * di halaman admin benar-benar sama dengan yang dilihat pelanggan:
 *   1. halaman publik /belanja & / (lewat MobileShopHome) memakai snapshot hasil Publish
 *   2. panel preview di admin memakai data draft (preview = true)
 *
 * Saat preview = true semua tautan dimatikan supaya klik di dalam frame HP
 * tidak memindahkan halaman admin.
 */
import Link from 'next/link';
import { Search, ChevronRight, MessageCircle, Shirt } from 'lucide-react';
import { rupiah } from '@/lib/api';

const FALLBACK_IMG = '/assets/mockups/logo-a4.webp';

/** Tautan yang bisa dimatikan saat preview. */
function Clickable({ href, preview, className, children, testId }) {
  if (preview || !href) {
    return (
      <div className={className} data-testid={testId}>
        {children}
      </div>
    );
  }
  const external = /^https?:\/\//.test(href);
  if (external) {
    return (
      <a href={href} className={className} data-testid={testId}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={className} data-testid={testId}>
      {children}
    </Link>
  );
}

function discountPct(p) {
  if (p.discount > 0) return Math.round(p.discount);
  if (p.compare_price > p.price && p.compare_price > 0) {
    return Math.round(((p.compare_price - p.price) / p.compare_price) * 100);
  }
  return 0;
}

function ProductCard({ p, preview }) {
  const pct = discountPct(p);
  const oos = p.status === 'out_of_stock';
  return (
    <Clickable
      href={`/belanja/${p.slug}`}
      preview={preview}
      testId={`cms-product-card-${p.slug}`}
      className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white"
    >
      <div className="relative">
        <img
          src={p.thumbnail_image || p.main_image || FALLBACK_IMG}
          alt={p.name}
          loading="lazy"
          className="aspect-square w-full bg-slate-100 object-contain p-1"
        />
        {pct > 0 && (
          <span className="absolute left-1.5 top-1.5 rounded-md bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
            -{pct}%
          </span>
        )}
        {oos && (
          <span className="absolute inset-x-0 bottom-0 bg-slate-900/75 py-1 text-center text-[10px] font-semibold text-white">
            Stok Habis
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-2.5">
        <div className="line-clamp-2 text-[13px] font-medium leading-snug text-slate-900">{p.name}</div>
        {!!p.category_name && (
          <div className="text-[10px] uppercase tracking-wide text-slate-400">{p.category_name}</div>
        )}
        <div className="mt-auto flex flex-wrap items-baseline gap-1.5">
          <span className="text-[15px] font-bold text-blue-700">{rupiah(p.price)}</span>
          {p.compare_price > p.price && (
            <span className="text-[11px] text-slate-400 line-through">{rupiah(p.compare_price)}</span>
          )}
        </div>
      </div>
    </Clickable>
  );
}

function SectionTitle({ children, href, preview }) {
  return (
    <div className="flex items-center justify-between px-4 pb-2 pt-5">
      <h2 className="text-[15px] font-semibold text-slate-900">{children}</h2>
      {!!href && (
        <Clickable href={href} preview={preview} className="flex items-center text-[12px] font-medium text-blue-700">
          Lihat semua <ChevronRight size={14} />
        </Clickable>
      )}
    </div>
  );
}

export default function CmsStorefront({ data, preview = false, children }) {
  const settings = data?.settings || {};
  const sections = (data?.sections || []).filter((s) => s.enabled !== false);
  const categories = data?.categories || [];
  const products = data?.products || [];
  const accent = settings.theme_color || '#1d4ed8';

  const featured = (() => {
    const picked = products.filter((p) => p.is_featured);
    const list = picked.length ? picked : products;
    return list.slice(0, Math.max(1, Number(settings.featured_limit) || 4));
  })();

  const renderers = {
    header: () => (
      <div key="header" className="px-4 pb-5 pt-4 text-white" style={{ backgroundColor: accent }}>
        <div className="flex items-center gap-2">
          {!!settings.logo_url && (
            <img
              src={settings.logo_url}
              alt={settings.store_name || 'Logo'}
              className="h-7 w-7 rounded-md bg-white object-contain p-0.5"
            />
          )}
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate text-[15px] font-semibold">{settings.store_name || 'Toko'}</div>
            <div className="truncate text-[11px] opacity-80">{settings.tagline || ''}</div>
          </div>
        </div>
        <Clickable
          href="/belanja"
          preview={preview}
          testId="cms-storefront-search"
          className="mt-4 flex items-center gap-2 rounded-xl bg-white px-3 py-2.5 text-sm text-slate-400"
        >
          <Search size={17} /> {settings.search_placeholder || 'Cari produk…'}
        </Clickable>
      </div>
    ),

    hero: () =>
      settings.hero_image || settings.hero_title ? (
        <div key="hero" className="px-3 pt-3" data-testid="cms-section-hero">
          <Clickable
            href={settings.hero_cta_href}
            preview={preview}
            className="block overflow-hidden rounded-xl border border-slate-200 bg-white"
          >
            {!!settings.hero_image && (
              <img src={settings.hero_image} alt={settings.hero_title || 'Hero'} className="w-full object-contain" />
            )}
            {(settings.hero_title || settings.hero_subtitle) && (
              <div className="p-3">
                {!!settings.hero_title && (
                  <div className="text-[14px] font-semibold text-slate-900">{settings.hero_title}</div>
                )}
                {!!settings.hero_subtitle && (
                  <div className="mt-0.5 text-[12px] text-slate-500">{settings.hero_subtitle}</div>
                )}
                {!!settings.hero_cta_label && (
                  <span
                    className="mt-2 inline-block rounded-full px-3 py-1.5 text-[11px] font-semibold text-white"
                    style={{ backgroundColor: accent }}
                  >
                    {settings.hero_cta_label}
                  </span>
                )}
              </div>
            )}
          </Clickable>
        </div>
      ) : null,

    category: () =>
      categories.length ? (
        <div key="category" data-testid="cms-section-category">
          <SectionTitle>{settings.category_title || 'Kategori'}</SectionTitle>
          <div className="flex gap-2 overflow-x-auto px-3 pb-1">
            {categories.map((c) => (
              <div
                key={c.id}
                className="flex w-[76px] shrink-0 flex-col items-center gap-1.5 rounded-xl border border-slate-200 bg-white p-2 text-center"
              >
                <span className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-blue-50">
                  {c.image ? (
                    <img src={c.image} alt={c.name} className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-[13px] font-bold" style={{ color: accent }}>
                      {(c.name || '?').slice(0, 1).toUpperCase()}
                    </span>
                  )}
                </span>
                <span className="line-clamp-2 text-[10px] font-medium leading-tight text-slate-700">{c.name}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null,

    featured: () =>
      featured.length ? (
        <div key="featured" data-testid="cms-section-featured">
          <SectionTitle href="/belanja" preview={preview}>
            {settings.featured_title || 'Produk Pilihan'}
          </SectionTitle>
          <div className="flex gap-2.5 overflow-x-auto px-3 pb-1">
            {featured.map((p) => (
              <div key={p.id} className="w-[46%] shrink-0">
                <ProductCard p={p} preview={preview} />
              </div>
            ))}
          </div>
        </div>
      ) : null,

    promo: () =>
      settings.promo_image || settings.promo_title ? (
        <div key="promo" className="px-3 pt-4" data-testid="cms-section-promo">
          <Clickable
            href={settings.promo_href}
            preview={preview}
            className="block overflow-hidden rounded-xl border border-amber-200 bg-amber-50"
          >
            {!!settings.promo_image && (
              <img src={settings.promo_image} alt={settings.promo_title || 'Promo'} className="w-full object-contain" />
            )}
            {(settings.promo_title || settings.promo_subtitle) && (
              <div className="p-3">
                {!!settings.promo_title && (
                  <div className="text-[13px] font-bold text-amber-900">{settings.promo_title}</div>
                )}
                {!!settings.promo_subtitle && (
                  <div className="mt-0.5 text-[11px] text-amber-800">{settings.promo_subtitle}</div>
                )}
              </div>
            )}
          </Clickable>
        </div>
      ) : null,

    products: () => (
      <div key="products" data-testid="cms-section-products">
        <SectionTitle>{settings.products_title || 'Semua Produk'}</SectionTitle>
        {products.length === 0 ? (
          <p className="px-4 text-[12px] text-slate-500" data-testid="cms-products-empty">
            Belum ada produk berstatus Active. Tambahkan dari tab Products lalu tekan Publish Changes.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2.5 px-3">
            {products.map((p) => (
              <ProductCard key={p.id} p={p} preview={preview} />
            ))}
          </div>
        )}
      </div>
    ),

    custom_tees: () =>
      settings.custom_tees_title ? (
        <div key="custom_tees" className="px-3 pt-4" data-testid="cms-section-custom-tees">
          <Clickable
            href={settings.custom_tees_href || '/custom-tees'}
            preview={preview}
            className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3"
          >
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white"
              style={{ backgroundColor: accent }}
            >
              <Shirt size={18} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-semibold text-slate-900">{settings.custom_tees_title}</span>
              <span className="block text-[11px] text-slate-500">{settings.custom_tees_subtitle || ''}</span>
            </span>
            <ChevronRight size={18} className="shrink-0 text-slate-400" />
          </Clickable>
        </div>
      ) : null,

    banner: () =>
      settings.banner_image ? (
        <div key="banner" className="px-3 pt-4" data-testid="cms-section-banner">
          <Clickable href={settings.banner_href} preview={preview} className="block overflow-hidden rounded-xl">
            <img src={settings.banner_image} alt="Banner" className="w-full object-contain" />
          </Clickable>
        </div>
      ) : null,

    footer: () => (
      <div key="footer" className="px-4 pb-6 pt-5 text-center" data-testid="cms-section-footer">
        {!!settings.whatsapp && (
          <Clickable
            href={`https://wa.me/${String(settings.whatsapp).replace(/[^0-9]/g, '')}`}
            preview={preview}
            testId="cms-footer-whatsapp"
            className="mb-3 inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-[12px] font-semibold text-white"
          >
            <MessageCircle size={14} /> Hubungi CS
          </Clickable>
        )}
        <p className="text-[11px] leading-relaxed text-slate-400">{settings.footer_note || ''}</p>
      </div>
    ),
  };

  return (
    <div className="min-h-full bg-slate-50" data-testid="cms-storefront">
      {sections.map((s) => renderers[s.key]?.() ?? null)}
      {children}
    </div>
  );
}
