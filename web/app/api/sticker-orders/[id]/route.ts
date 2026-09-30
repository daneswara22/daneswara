import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRoles } from '@/lib/auth';
import { handle, readBody } from '@/lib/handler';
import { HttpError } from '@/lib/http';
import { STICKER_STATUSES } from '@/lib/stickerPricing';

export const dynamic = 'force-dynamic';

/** Ubah status pesanan Custom Sticker. */
export const PATCH = handle(async (req: NextRequest, ctx: any) => {
  const user = await requireRoles(req, 'Owner', 'Manager', 'Kasir');
  const { id } = await ctx.params;
  const b = await readBody(req);
  const status = String(b.status || '').trim();
  if (!STICKER_STATUSES.includes(status as any)) throw new HttpError(400, 'Status tidak valid');

  const found = await prisma.sticker_orders.findFirst({ where: { id, tenant_id: user.tenant_id } });
  if (!found) throw new HttpError(404, 'Pesanan tidak ditemukan');
  await prisma.sticker_orders.update({ where: { id }, data: { status, updated_at: new Date() } });
  return { ok: true, id, status };
});

/** Hapus pesanan Custom Sticker. */
export const DELETE = handle(async (req: NextRequest, ctx: any) => {
  const user = await requireRoles(req, 'Owner', 'Manager');
  const { id } = await ctx.params;
  const found = await prisma.sticker_orders.findFirst({ where: { id, tenant_id: user.tenant_id } });
  if (!found) throw new HttpError(404, 'Pesanan tidak ditemukan');
  await prisma.sticker_orders.delete({ where: { id } });
  return { ok: true };
});
