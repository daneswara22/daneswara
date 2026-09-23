/**
 * Ubah / hapus satu baris size chart.
 *   PUT    /api/custom-products/:id/sizes/:sid
 *   DELETE /api/custom-products/:id/sizes/:sid
 */
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRoles, logActivity } from '@/lib/auth';
import { handle, readBody } from '@/lib/handler';
import { HttpError } from '@/lib/http';
import { serializeProductSize } from '@/lib/serializers';
import { sizeSchema } from '../route';
import { ensureProductTypeSchema } from '@/lib/schemaGuard';

const updateSchema = sizeSchema.partial();

async function findSize(id: string, sid: string, tenantId: string) {
  const row = await prisma.custom_product_sizes.findUnique({ where: { id: sid } });
  if (!row || row.product_id !== id || row.tenant_id !== tenantId) {
    throw new HttpError(404, 'Ukuran tidak ditemukan');
  }
  return row;
}

export const PUT = handle(async (req: NextRequest, ctx: any) => {
  await ensureProductTypeSchema();
  const user = await requireRoles(req, 'Owner', 'Manager');
  const { id, sid } = await ctx.params;
  const existing = await findSize(id, sid, user.tenant_id);
  const data = updateSchema.parse(await readBody(req));
  const label = data.label ? data.label.toUpperCase() : undefined;

  if (label && label !== existing.label) {
    const dup = await prisma.custom_product_sizes.findFirst({
      where: { product_id: id, label },
      select: { id: true },
    });
    if (dup) throw new HttpError(400, `Ukuran ${label} sudah ada di produk ini`);
  }

  const updated = await prisma.custom_product_sizes.update({
    where: { id: sid },
    data: {
      ...(label ? { label } : {}),
      ...(data.chest_cm !== undefined ? { chest_cm: data.chest_cm } : {}),
      ...(data.length_cm !== undefined ? { length_cm: data.length_cm } : {}),
      ...(data.sort_order !== undefined ? { sort_order: data.sort_order } : {}),
      updated_at: new Date(),
    },
  });
  await logActivity(user.tenant_id, user, 'Ubah Ukuran Produk', updated.label);
  return serializeProductSize(updated);
});

export const DELETE = handle(async (req: NextRequest, ctx: any) => {
  await ensureProductTypeSchema();
  const user = await requireRoles(req, 'Owner', 'Manager');
  const { id, sid } = await ctx.params;
  const existing = await findSize(id, sid, user.tenant_id);
  await prisma.custom_product_sizes.delete({ where: { id: sid } });
  await logActivity(user.tenant_id, user, 'Hapus Ukuran Produk', existing.label);
  return { ok: true, id: sid };
});
