/**
 * Daftar jenis produk untuk halaman publik:
 *   - /price-list  (pilih jenis kaos + varian warna)
 *   - /custom      (tombol "Ganti Produk")
 *
 * Hanya produk aktif, sudah dipaginasi supaya bisa lazy-load.
 *   GET /api/public/custom-products?page=1&limit=12&q=
 */
import { NextRequest, NextResponse } from 'next/server';
import { handle } from '@/lib/handler';
import { listProductTypes } from '@/lib/productTypeQueries';
import { ensureProductTypeSchema } from '@/lib/schemaGuard';

export const GET = handle(async (req: NextRequest) => {
  await ensureProductTypeSchema();
  const url = new URL(req.url);
  const data = await listProductTypes({
    page: Number(url.searchParams.get('page') || 1),
    limit: Number(url.searchParams.get('limit') || 12),
    q: url.searchParams.get('q') || undefined,
    activeOnly: true,
  });
  const res = NextResponse.json(data);
  res.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
  return res;
});
