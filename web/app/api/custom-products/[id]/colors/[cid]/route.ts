/**
 * Ubah / hapus satu varian warna.
 *   PUT    /api/custom-products/:id/colors/:cid
 *   DELETE /api/custom-products/:id/colors/:cid
 */
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRoles, logActivity } from '@/lib/auth';
import { handle, readBody } from '@/lib/handler';
import { HttpError } from '@/lib/http';
import { storage } from '@/lib/storage';
import { serializeProductColor } from '@/lib/serializers';
import { colorSchema } from '../route';
import { ensureProductTypeSchema } from '@/lib/schemaGuard';

const updateSchema = colorSchema.partial();

async function findColor(id: string, cid: string, tenantId: string) {
  const row = await prisma.custom_product_colors.findUnique({ where: { id: cid } });
  if (!row || row.product_id !== id || row.tenant_id !== tenantId) {
    throw new HttpError(404, 'Warna tidak ditemukan');
  }
  return row;
}

export const PUT = handle(async (req: NextRequest, ctx: any) => {
  await ensureProductTypeSchema();
  const user = await requireRoles(req, 'Owner', 'Manager');
  const { id, cid } = await ctx.params;
  const existing = await findColor(id, cid, user.tenant_id);
  const data = updateSchema.parse(await readBody(req));

  const hex = data.hex ? data.hex.toUpperCase() : undefined;
  if (hex && hex !== existing.hex) {
    const dup = await prisma.custom_product_colors.findFirst({
      where: { product_id: id, hex },
      select: { id: true },
    });
    if (dup) throw new HttpError(400, `Warna ${hex} sudah ada di produk ini`);
  }

  let thumb: string | null = existing.thumb_url;
  if (data.thumb_url !== undefined) {
    if (!data.thumb_url) {
      if (existing.thumb_url?.startsWith('http')) {
        await storage.delete(existing.thumb_url).catch(() => {});
      }
      thumb = null;
    } else {
      const uploaded = await storage.normalizeImageField(data.thumb_url, 'mockup');
      if (!uploaded) throw new HttpError(400, 'Gagal memproses gambar warna');
      if (existing.thumb_url?.startsWith('http') && existing.thumb_url !== uploaded) {
        await storage.delete(existing.thumb_url).catch(() => {});
      }
      thumb = uploaded;
    }
  }

  const updated = await prisma.custom_product_colors.update({
    where: { id: cid },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(hex ? { hex } : {}),
      ...(data.sort_order !== undefined ? { sort_order: data.sort_order } : {}),
      ...(data.is_active !== undefined ? { is_active: data.is_active } : {}),
      thumb_url: thumb,
      updated_at: new Date(),
    },
  });
  await logActivity(user.tenant_id, user, 'Ubah Warna Produk', updated.name);
  return serializeProductColor(updated);
});

export const DELETE = handle(async (req: NextRequest, ctx: any) => {
  await ensureProductTypeSchema();
  const user = await requireRoles(req, 'Owner', 'Manager');
  const { id, cid } = await ctx.params;
  const existing = await findColor(id, cid, user.tenant_id);
  if (existing.thumb_url?.startsWith('http')) {
    await storage.delete(existing.thumb_url).catch(() => {});
  }
  await prisma.custom_product_colors.delete({ where: { id: cid } });
  await logActivity(user.tenant_id, user, 'Hapus Warna Produk', existing.name);
  return { ok: true, id: cid };
});
