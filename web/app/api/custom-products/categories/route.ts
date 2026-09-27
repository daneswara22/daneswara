/**
 * Kategori jenis produk — dipakai untuk saran (select atau buat baru) di form
 * Jenis Produk. Kategori disimpan sebagai teks pada custom_products.category,
 * jadi daftarnya cukup diambil distinct.
 *   GET /api/custom-products/categories
 */
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { handle } from '@/lib/handler';
import { ensureProductTypeSchema } from '@/lib/schemaGuard';

export const GET = handle(async (req: NextRequest) => {
  await ensureProductTypeSchema();
  const user = await getCurrentUser(req);
  const rows = await prisma.custom_products.findMany({
    where: { tenant_id: user.tenant_id, deleted_at: null, NOT: { category: null } },
    select: { category: true },
    distinct: ['category'],
    orderBy: { category: 'asc' },
  });
  const items = (rows || [])
    .map((r) => (r.category || '').trim())
    .filter((c) => c.length > 0);
  return { items };
});
