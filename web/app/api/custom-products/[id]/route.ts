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
import { slugifyProductKey } from '@/lib/productTypes';
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

  // --- Kode produk: boleh diubah, wajib unik, dan referensi ikut dipindah ----
  let nextKey = existing.product_key;
  if (data.product_key !== undefined && data.product_key !== null) {
    const slug = slugifyProductKey(data.product_key);
    if (!slug) throw new HttpError(400, 'Kode produk tidak valid');
    if (slug !== existing.product_key) {
      const taken = await prisma.custom_products.findFirst({
        where: { tenant_id: user.tenant_id, product_key: slug, id: { not: id } },
        select: { id: true },
      });
      if (taken) throw new HttpError(400, `Kode produk "${slug}" sudah dipakai produk lain`);
      nextKey = slug;
    }
  }

  // --- Validasi aktivasi: minimal 1 mockup -----------------------------------
  if (data.is_active === true) {
    const mockups = await prisma.custom_mockups.count({
      where: { tenant_id: user.tenant_id, product_key: existing.product_key },
    });
    if (mockups === 0) {
      throw new HttpError(400, 'Tambahkan minimal 1 mockup produk sebelum mengaktifkan produk ini');
    }
  }

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
      ...(data.category !== undefined ? { category: data.category?.trim() || null } : {}),
      ...(nextKey !== existing.product_key ? { product_key: nextKey } : {}),
      ...(data.sort_order !== undefined ? { sort_order: data.sort_order } : {}),
      thumbnail_url: thumb,
      updated_at: new Date(),
    },
    include: {
      colors: { orderBy: [{ sort_order: 'asc' }, { created_at: 'asc' }] },
      size_chart: { orderBy: [{ sort_order: 'asc' }] },
    },
  });
  if (nextKey !== existing.product_key) {
    // mockup & riwayat pesanan tetap menempel ke produk yang sama
    await prisma.custom_mockups.updateMany({
      where: { tenant_id: user.tenant_id, product_key: existing.product_key },
      data: { product_key: nextKey },
    });
    await prisma.custom_tee_orders.updateMany({
      where: { tenant_id: user.tenant_id, product_key: existing.product_key },
      data: { product_key: nextKey },
    });
  }
  const mockup_count = await prisma.custom_mockups.count({
    where: { tenant_id: user.tenant_id, product_key: nextKey },
  });
  await logActivity(user.tenant_id, user, 'Ubah Jenis Produk', updated.title);
  return serializeProductType({ ...updated, mockup_count });
});

export const DELETE = handle(async (req: NextRequest, ctx: any) => {
  await ensureProductTypeSchema();
  const user = await requireRoles(req, 'Owner', 'Manager');
  const { id } = await ctx.params;
  const existing = await getProductTypeById(id, user.tenant_id);
  if (!existing) throw new HttpError(404, 'Jenis produk tidak ditemukan');

  // Produk yang sudah punya pesanan / mockup TIDAK dihapus permanen supaya
  // riwayat pesanan dan desain pelanggan tetap utuh (soft delete).
  const [orders, mockups] = await Promise.all([
    prisma.custom_tee_orders.count({
      where: { tenant_id: user.tenant_id, product_key: existing.product_key },
    }),
    prisma.custom_mockups.count({
      where: { tenant_id: user.tenant_id, product_key: existing.product_key },
    }),
  ]);
  if (orders > 0) {
    await prisma.custom_products.update({
      where: { id },
      data: { deleted_at: new Date(), is_active: false, updated_at: new Date() },
    });
    await logActivity(user.tenant_id, user, 'Arsip Jenis Produk', existing.title);
    return {
      ok: true,
      id,
      soft_deleted: true,
      message: `Produk dipakai ${orders} pesanan, jadi diarsipkan (tidak tampil ke pelanggan) supaya riwayat pesanan tetap utuh.`,
    };
  }

  // best-effort: bersihkan berkas di R2 (thumbnail produk + thumbnail warna)
  const urls = [existing.thumbnail_url, ...(existing.colors || []).map((c: any) => c.thumb_url)];
  for (const u of urls) {
    if (u && u.startsWith('http')) await storage.delete(u).catch(() => {});
  }

  if (mockups > 0) {
    const rows = await prisma.custom_mockups.findMany({
      where: { tenant_id: user.tenant_id, product_key: existing.product_key },
    });
    for (const m of rows) {
      if (m.image_url?.startsWith('http')) await storage.delete(m.image_url).catch(() => {});
    }
    await prisma.custom_mockups.deleteMany({
      where: { tenant_id: user.tenant_id, product_key: existing.product_key },
    });
  }
  await prisma.custom_products.delete({ where: { id } });
  await logActivity(user.tenant_id, user, 'Hapus Jenis Produk', existing.title);
  return { ok: true, id };
});
