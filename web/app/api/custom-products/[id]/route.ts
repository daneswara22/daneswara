/**
 * Jenis Produk — detail / ubah / hapus.
 *   GET    /api/custom-products/:id
 *   PUT    /api/custom-products/:id
 *   DELETE /api/custom-products/:id   (warna & size chart ikut terhapus - cascade)
 */
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser, requireRoles, logActivity } from '@/lib/auth';
import { handle, readBody } from '@/lib/handler';
import { HttpError } from '@/lib/http';
import { storage } from '@/lib/storage';
import { serializeProductType } from '@/lib/serializers';
import { getProductTypeById } from '@/lib/productTypeQueries';
import { createSchema } from '../route';
import { ensureProductTypeSchema } from '@/lib/schemaGuard';

const updateSchema = createSchema.partial();

export const GET = handle(async (req: NextRequest, ctx: any) => {
  await ensureProductTypeSchema();
  const user = await getCurrentUser(req);
  const { id } = await ctx.params;
  const row = await getProductTypeById(id, user.tenant_id);
  if (!row) throw new HttpError(404, 'Jenis produk tidak ditemukan');
  return serializeProductType(row);
});

export const PUT = handle(async (req: NextRequest, ctx: any) => {
  await ensureProductTypeSchema();
  const user = await requireRoles(req, 'Owner', 'Manager');
  const { id } = await ctx.params;
  const existing = await getProductTypeById(id, user.tenant_id);
  if (!existing) throw new HttpError(404, 'Jenis produk tidak ditemukan');
  const data = updateSchema.parse(await readBody(req));

  let thumb: string | null = existing.thumbnail_url;
  if (data.thumbnail_url !== undefined) {
    if (!data.thumbnail_url) {
      if (existing.thumbnail_url?.startsWith('http')) {
        await storage.delete(existing.thumbnail_url).catch(() => {});
      }
      thumb = null;
    } else {
      const uploaded = await storage.normalizeImageField(data.thumbnail_url, 'mockup');
      if (!uploaded) throw new HttpError(400, 'Gagal memproses gambar produk');
      if (existing.thumbnail_url?.startsWith('http') && existing.thumbnail_url !== uploaded) {
        await storage.delete(existing.thumbnail_url).catch(() => {});
      }
      thumb = uploaded;
    }
  }

  const updated = await prisma.custom_products.update({
    where: { id },
    data: {
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.subtitle !== undefined ? { subtitle: data.subtitle || null } : {}),
      ...(data.description !== undefined ? { description: data.description || '' } : {}),
      ...(data.price !== undefined ? { price: data.price } : {}),
      ...(data.supplier !== undefined ? { supplier: data.supplier || null } : {}),
      ...(data.size_region !== undefined ? { size_region: data.size_region || null } : {}),
      ...(data.model !== undefined ? { model: data.model || null } : {}),
      ...(data.material !== undefined ? { material: data.material || null } : {}),
      ...(data.is_active !== undefined ? { is_active: data.is_active } : {}),
      ...(data.sort_order !== undefined ? { sort_order: data.sort_order } : {}),
      thumbnail_url: thumb,
      updated_at: new Date(),
    },
    include: {
      colors: { orderBy: [{ sort_order: 'asc' }, { created_at: 'asc' }] },
      size_chart: { orderBy: [{ sort_order: 'asc' }] },
    },
  });
  await logActivity(user.tenant_id, user, 'Ubah Jenis Produk', updated.title);
  return serializeProductType(updated);
});

export const DELETE = handle(async (req: NextRequest, ctx: any) => {
  await ensureProductTypeSchema();
  const user = await requireRoles(req, 'Owner', 'Manager');
  const { id } = await ctx.params;
  const existing = await getProductTypeById(id, user.tenant_id);
  if (!existing) throw new HttpError(404, 'Jenis produk tidak ditemukan');

  // best-effort: bersihkan berkas di R2 (thumbnail produk + thumbnail warna)
  const urls = [existing.thumbnail_url, ...(existing.colors || []).map((c: any) => c.thumb_url)];
  for (const u of urls) {
    if (u && u.startsWith('http')) await storage.delete(u).catch(() => {});
  }

  await prisma.custom_products.delete({ where: { id } });
  await logActivity(user.tenant_id, user, 'Hapus Jenis Produk', existing.title);
  return { ok: true, id };
});
