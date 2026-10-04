/**
 * Satu kategori storefront HP.
 *   PUT    /api/mobile-cms/categories/:cid
 *   DELETE /api/mobile-cms/categories/:cid   soft delete
 */
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRoles } from '@/lib/auth';
import { handle, readBody } from '@/lib/handler';
import { notFound, badRequest } from '@/lib/http';
import { ensureMobileCmsSchema, serializeCmsCategory } from '@/lib/mobileCms';

const ROLES = ['Owner', 'Manager'] as const;

async function findOwned(tenantId: string, cid: string) {
  const row = await prisma.mobile_cms_categories.findFirst({
    where: { id: cid, tenant_id: tenantId, deleted_at: null },
  });
  if (!row) notFound('Kategori tidak ditemukan');
  return row;
}

export const PUT = handle(async (req: NextRequest, ctx: any) => {
  const user = await requireRoles(req, ...ROLES);
  await ensureMobileCmsSchema();
  const { cid } = await ctx.params;
  await findOwned(user.tenant_id, cid);
  const body = await readBody(req);
  const name = String(body?.name || '').trim();
  if (!name) badRequest('Nama kategori wajib diisi');
  const row = await prisma.mobile_cms_categories.update({
    where: { id: cid },
    data: {
      name: name.slice(0, 160),
      image: String(body?.image || ''),
      is_active: body?.is_active === undefined ? true : !!body.is_active,
      updated_at: new Date(),
    },
  });
  return serializeCmsCategory(row);
});

export const DELETE = handle(async (req: NextRequest, ctx: any) => {
  const user = await requireRoles(req, ...ROLES);
  await ensureMobileCmsSchema();
  const { cid } = await ctx.params;
  await findOwned(user.tenant_id, cid);
  await prisma.mobile_cms_categories.update({
    where: { id: cid },
    data: { deleted_at: new Date(), updated_at: new Date() },
  });
  // Produk yang memakai kategori ini dilepas supaya tidak menunjuk ke data mati.
  await prisma.mobile_cms_products.updateMany({
    where: { tenant_id: user.tenant_id, category_id: cid },
    data: { category_id: null },
  });
  return { ok: true, soft_deleted: true };
});
