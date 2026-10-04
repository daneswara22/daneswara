/**
 * Satu produk CMS mobile.
 *   PUT    /api/mobile-cms/products/:pid            ubah seluruh informasi
 *   PATCH  /api/mobile-cms/products/:pid            ubah sebagian (mis. status/Hide)
 *   POST   /api/mobile-cms/products/:pid?op=duplicate   duplikat produk
 *   DELETE /api/mobile-cms/products/:pid            SOFT delete (deleted_at)
 */
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRoles, logActivity } from '@/lib/auth';
import { handle, readBody } from '@/lib/handler';
import { newId, notFound, badRequest } from '@/lib/http';
import {
  ensureMobileCmsSchema,
  serializeCmsProduct,
  PRODUCT_STATUSES,
  slugify,
  productPayload,
} from '@/lib/mobileCms';

const ROLES = ['Owner', 'Manager'] as const;

async function findOwned(tenantId: string, pid: string) {
  const row = await prisma.mobile_cms_products.findFirst({
    where: { id: pid, tenant_id: tenantId, deleted_at: null },
  });
  if (!row) notFound('Produk tidak ditemukan');
  return row;
}

export const PUT = handle(async (req: NextRequest, ctx: any) => {
  const user = await requireRoles(req, ...ROLES);
  await ensureMobileCmsSchema();
  const { pid } = await ctx.params;
  await findOwned(user.tenant_id, pid);
  const data = productPayload(await readBody(req));
  const row = await prisma.mobile_cms_products.update({
    where: { id: pid },
    data: { ...data, updated_at: new Date() },
  });
  await logActivity(user.tenant_id, user, 'Ubah Produk Mobile', data.name);
  return serializeCmsProduct(row);
});

export const PATCH = handle(async (req: NextRequest, ctx: any) => {
  const user = await requireRoles(req, ...ROLES);
  await ensureMobileCmsSchema();
  const { pid } = await ctx.params;
  const current = await findOwned(user.tenant_id, pid);
  const body = await readBody(req);
  const patch: any = { updated_at: new Date() };
  if (body?.status !== undefined) {
    if (!(PRODUCT_STATUSES as readonly string[]).includes(body.status))
      badRequest('Status produk tidak dikenal');
    patch.status = body.status;
  }
  if (body?.is_featured !== undefined) patch.is_featured = !!body.is_featured;
  const row = await prisma.mobile_cms_products.update({ where: { id: pid }, data: patch });
  await logActivity(user.tenant_id, user, 'Ubah Status Produk Mobile', `${current.name} -> ${row.status}`);
  return serializeCmsProduct(row);
});

export const POST = handle(async (req: NextRequest, ctx: any) => {
  const user = await requireRoles(req, ...ROLES);
  await ensureMobileCmsSchema();
  const { pid } = await ctx.params;
  const op = new URL(req.url).searchParams.get('op') || 'duplicate';
  if (op !== 'duplicate') badRequest('Operasi tidak dikenal');
  const src = await findOwned(user.tenant_id, pid);
  const count = await prisma.mobile_cms_products.count({
    where: { tenant_id: user.tenant_id, deleted_at: null },
  });
  const now = new Date();
  const name = `${src.name} (Copy)`;
  const row = await prisma.mobile_cms_products.create({
    data: {
      id: newId(),
      tenant_id: user.tenant_id,
      name,
      slug: `${slugify(name)}-${Date.now().toString(36)}`,
      category_id: src.category_id,
      description: src.description,
      sku: src.sku ? `${src.sku}-COPY` : '',
      price: src.price,
      cost: src.cost,
      compare_price: src.compare_price,
      discount: src.discount,
      // Hasil duplikat selalu Draft supaya tidak langsung tampil ke pelanggan.
      status: 'draft',
      is_featured: false,
      variants: src.variants,
      images: src.images,
      main_image: src.main_image,
      thumbnail_image: src.thumbnail_image,
      banner_image: src.banner_image,
      sort_order: count,
      created_at: now,
      updated_at: now,
    },
  });
  await logActivity(user.tenant_id, user, 'Duplikat Produk Mobile', name);
  return serializeCmsProduct(row);
});

export const DELETE = handle(async (req: NextRequest, ctx: any) => {
  const user = await requireRoles(req, ...ROLES);
  await ensureMobileCmsSchema();
  const { pid } = await ctx.params;
  const row = await findOwned(user.tenant_id, pid);
  // Soft delete: baris tetap ada di database, hanya disembunyikan.
  await prisma.mobile_cms_products.update({
    where: { id: pid },
    data: { deleted_at: new Date(), updated_at: new Date() },
  });
  await logActivity(user.tenant_id, user, 'Hapus Produk Mobile', row.name);
  return { ok: true, soft_deleted: true };
});
