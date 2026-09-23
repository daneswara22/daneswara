/**
 * Varian warna per jenis produk.
 *   GET  /api/custom-products/:id/colors
 *   POST /api/custom-products/:id/colors
 *
 * `thumb_url` boleh berupa data URI (hasil FileReader) atau URL hasil
 * /api/upload; keduanya berakhir sebagai WebP di R2 lewat lib/storage.
 */
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getCurrentUser, requireRoles, logActivity } from '@/lib/auth';
import { handle, readBody } from '@/lib/handler';
import { HttpError, newId } from '@/lib/http';
import { storage } from '@/lib/storage';
import { serializeProductColor } from '@/lib/serializers';
import { getProductTypeById } from '@/lib/productTypeQueries';

export const colorSchema = z.object({
  name: z.string().trim().min(1, 'Nama warna wajib diisi').max(60),
  hex: z
    .string()
    .trim()
    .regex(/^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/, 'Format warna harus #RRGGBB'),
  thumb_url: z.string().trim().max(2_000_000).optional().nullable(),
  sort_order: z.coerce.number().int().min(0).max(100000).optional(),
  is_active: z.boolean().optional(),
});

export const GET = handle(async (req: NextRequest, ctx: any) => {
  const user = await getCurrentUser(req);
  const { id } = await ctx.params;
  const product = await getProductTypeById(id, user.tenant_id);
  if (!product) throw new HttpError(404, 'Jenis produk tidak ditemukan');
  return (product.colors || []).map(serializeProductColor);
});

export const POST = handle(async (req: NextRequest, ctx: any) => {
  const user = await requireRoles(req, 'Owner', 'Manager');
  const { id } = await ctx.params;
  const product = await getProductTypeById(id, user.tenant_id);
  if (!product) throw new HttpError(404, 'Jenis produk tidak ditemukan');
  const data = colorSchema.parse(await readBody(req));
  const hex = data.hex.toUpperCase();

  const dup = await prisma.custom_product_colors.findFirst({
    where: { product_id: id, hex },
    select: { id: true },
  });
  if (dup) throw new HttpError(400, `Warna ${hex} sudah ada di produk ini`);

  const thumb = await storage.normalizeImageField(data.thumb_url, 'mockup');
  const now = new Date();
  const created = await prisma.custom_product_colors.create({
    data: {
      id: newId(),
      tenant_id: user.tenant_id,
      product_id: id,
      name: data.name,
      hex,
      thumb_url: thumb || null,
      sort_order: data.sort_order ?? (product.colors?.length || 0) * 10,
      is_active: data.is_active ?? true,
      created_at: now,
      updated_at: now,
    },
  });
  await logActivity(user.tenant_id, user, 'Tambah Warna Produk', `${product.title} · ${data.name}`);
  return serializeProductColor(created);
});
