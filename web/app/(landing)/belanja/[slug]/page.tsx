'use client';
import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useShopCatalog } from '@/lib/shopCatalog';
import ProductDetail from '@/components/shop/ProductDetail';
import MobileTopBar from '@/components/shop/MobileTopBar';

export default function Page() {
  const params = useParams<{ slug: string }>();
  const slug = String(params?.slug || '');
  const { items, loading, error } = useShopCatalog();
  const product = items.find((p: any) => p.slug === slug) || null;

  // Produk bertipe 'link' memakai editor penuh yang sudah ada.
  useEffect(() => {
    if (product?.kind === 'link' && product.href) window.location.replace(product.href);
  }, [product]);

  return (
    <div className="mx-auto w-full max-w-md md:max-w-none">
      {loading && (
        <div className="min-h-screen bg-slate-50" data-testid="detail-loading">
          <MobileTopBar title="Memuat produk…" />
          <div className="aspect-square w-full animate-pulse bg-slate-200" />
          <div className="space-y-3 bg-white p-4">
            <div className="h-6 w-1/3 animate-pulse rounded bg-slate-100" />
            <div className="h-4 w-2/3 animate-pulse rounded bg-slate-100" />
          </div>
        </div>
      )}

      {!loading && !product && (
        <div className="min-h-screen bg-slate-50" data-testid="detail-notfound">
          <MobileTopBar title="Produk tidak ditemukan" />
          <div className="px-6 py-16 text-center">
            <p className="text-[13px] text-slate-500">
              {error || 'Produk ini sudah tidak aktif atau telah dihapus.'}
            </p>
            <Link href="/belanja" className="mt-5 inline-block rounded-xl bg-blue-700 px-5 py-2.5 text-[13px] font-semibold text-white">
              Lihat Produk Lain
            </Link>
          </div>
        </div>
      )}

      {product && product.kind !== 'link' && <ProductDetail product={product} />}
    </div>
  );
}
