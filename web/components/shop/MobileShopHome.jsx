'use client';
/** Katalog produk gaya marketplace untuk mobile (beranda + tab Produk). */
import Link from 'next/link';
import { Search, Phone, Images, ListOrdered } from 'lucide-react';
import { rupiah } from '@/lib/api';
import { useShopCatalog, startingPrice } from '@/lib/shopCatalog';
import MobileBottomNav from '@/components/shop/MobileBottomNav';
import MobileHeaderActions from '@/components/shop/MobileHeaderActions';

const SHORTCUTS = [
  { href: '/galeri', label: 'Galeri', icon: Images },
  { href: '/price-list', label: 'Daftar Harga', icon: ListOrdered },
  { href: 'https://wa.me/6285888102930', label: 'Hubungi CS', icon: Phone },
];

export default function MobileShopHome({ showHero = true }) {
  const { items, loading, error } = useShopCatalog();

  return (
    <div className="min-h-screen bg-slate-50 pb-24" data-testid="mobile-shop-home">
      <div className="bg-blue-700 px-4 pb-5 pt-4 text-white">
        <div className="flex items-center gap-2">
          <img src="/assets/daneswara-logo.webp" alt="Daneswara Print" className="h-7 w-7 rounded-md bg-white object-contain p-0.5" />
          <div className="min-w-0 flex-1 leading-tight">
            <div className="text-[15px] font-semibold">Daneswara Print</div>
            <div className="text-[11px] text-blue-100">Kaos, Stiker &amp; Banner Custom</div>
          </div>
          <MobileHeaderActions tone="light" />
        </div>
        {showHero && (
          <Link
            href="/belanja"
            data-testid="home-search"
            className="mt-4 flex items-center gap-2 rounded-xl bg-white px-3 py-2.5 text-sm text-slate-400"
          >
            <Search size={17} /> Cari produk cetak&hellip;
          </Link>
        )}
      </div>

      <div className="-mt-3 px-3">
        <div className="grid grid-cols-3 gap-2 rounded-xl border border-slate-200 bg-white p-3">
          {SHORTCUTS.map((s) => {
            const Icon = s.icon;
            return (
              <a
                key={s.label}
                href={s.href}
                data-testid={`shortcut-${s.label.toLowerCase().replace(/\s+/g, '-')}`}
                className="flex flex-col items-center gap-1.5 py-1 text-[11px] font-medium text-slate-700"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-700">
                  <Icon size={19} />
                </span>
                {s.label}
              </a>
            );
          })}
        </div>
      </div>

      <h2 className="px-4 pb-2 pt-5 text-[15px] font-semibold text-slate-900">Produk Kami</h2>

      {loading && (
        <div className="grid grid-cols-2 gap-2.5 px-3" data-testid="product-grid-loading">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="aspect-square w-full animate-pulse bg-slate-100" />
              <div className="space-y-2 p-2.5">
                <div className="h-3 w-4/5 animate-pulse rounded bg-slate-100" />
                <div className="h-4 w-1/2 animate-pulse rounded bg-slate-100" />
              </div>
            </div>
          ))}
        </div>
      )}

      {error && (
        <p className="px-4 text-[13px] text-red-600" data-testid="product-grid-error">{error}</p>
      )}

      {!loading && !error && items.length === 0 && (
        <p className="px-4 text-[13px] text-slate-500" data-testid="product-grid-empty">
          Belum ada produk aktif. Tambahkan dari menu Jenis Produk di dashboard.
        </p>
      )}

      {!loading && items.length > 0 && (
        <div className="grid grid-cols-2 gap-2.5 px-3" data-testid="product-grid">
          {items.map((p) => (
            <Link
              key={p.slug}
              href={p.kind === 'link' ? p.href : `/belanja/${p.slug}`}
              data-testid={`product-card-${p.slug}`}
              className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white"
            >
              <img src={p.thumb} alt={p.name} loading="lazy" className="aspect-square w-full bg-slate-100 object-cover" />
              <div className="flex flex-1 flex-col gap-1 p-2.5">
                <div className="line-clamp-2 text-[13px] font-medium leading-snug text-slate-900">{p.name}</div>
                <div className="mt-auto text-[11px] text-slate-500">Mulai dari</div>
                <div className="text-[15px] font-bold text-blue-700">{rupiah(startingPrice(p))}</div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <p className="px-4 pt-5 text-center text-[11px] leading-relaxed text-slate-400">
        Harga mengikuti data Jenis Produk di dashboard. Harga final dikonfirmasi CS setelah desain diperiksa.
      </p>

      <MobileBottomNav />
    </div>
  );
}
