/**
 * Katalog produk untuk tampilan mobile (marketplace).
 * Harga dan varian diambil dari database, bukan dari file.
 *   GET /api/public/shop-catalog
 */
import { NextResponse } from 'next/server';
import { handle } from '@/lib/handler';
import { ensureProductTypeSchema } from '@/lib/schemaGuard';
import { buildShopCatalog } from '@/lib/shopCatalogServer';

export const GET = handle(async () => {
  await ensureProductTypeSchema();
  const items = await buildShopCatalog();
  const res = NextResponse.json({ items });
  res.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
  return res;
});
