/**
 * Size chart per jenis produk (lebar dada & panjang, cm).
 *   GET  /api/custom-products/:id/sizes
 *   POST /api/custom-products/:id/sizes
 */
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getCurrentUser, requireRoles, logActivity } from '@/lib/auth';
import { handle, readBody } from '@/lib/handler';
import { HttpError, newId } from '@/lib/http';
import { serializeProductSize } from '@/lib/serializers';
import { getProductTypeById } from '@/lib/productTypeQueries';
import { sizeRank } from '@/lib/productTypes';

export const sizeSchema = z.object({
  label: z.string().trim().min(1, 'Nama ukuran wajib diisi').max(20),
  chest_cm: z.coerce.number().min(0, 'Lebar dada tidak boleh negatif').max(400),
  length_cm: z.coerce.number().min(0, 'Panjang tidak boleh negatif').max(400),
  sort_order: z.coerce.number().int().min(0).max(100000).optional(),
});

export const GET = handle(async (req: NextRequest, ctx: any) => {
  const user = await getCurrentUser(req);
  const { id } = await ctx.params;
  const product = await getProductTypeById(id, user.tenant_id);
  if (!product) throw new HttpError(404, 'Jenis produk tidak ditemukan');
  return (product.size_chart || []).map(serializeProductSize);
});

export const POST = handle(async (req: NextRequest, ctx: any) => {
  const user = await requireRoles(req, 'Owner', 'Manager');
  const { id } = await ctx.params;
  const product = await getProductTypeById(id, user.tenant_id);
  if (!product) throw new HttpError(404, 'Jenis produk tidak ditemukan');
  const data = sizeSchema.parse(await readBody(req));
  const label = data.label.toUpperCase();

  const dup = await prisma.custom_product_sizes.findFirst({
    where: { product_id: id, label },
    select: { id: true },
  });
  if (dup) throw new HttpError(400, `Ukuran ${label} sudah ada di produk ini`);

  const now = new Date();
  const created = await prisma.custom_product_sizes.create({
    data: {
      id: newId(),
      tenant_id: user.tenant_id,
      product_id: id,
      label,
      chest_cm: data.chest_cm,
      length_cm: data.length_cm,
      sort_order: data.sort_order ?? sizeRank(label) * 10,
      created_at: now,
      updated_at: now,
    },
  });
  await logActivity(user.tenant_id, user, 'Tambah Ukuran Produk', `${product.title} · ${label}`);
  return serializeProductSize(created);
});
