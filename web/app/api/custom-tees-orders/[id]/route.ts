import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { handle, readBody } from '@/lib/handler';
import { HttpError } from '@/lib/http';
import { safeJsonParse } from '@/lib/business';

const STATUSES = ['Baru', 'Diproses', 'Selesai', 'Dibatalkan'];

// GET single order INCLUDING the complete saved design (for Admin inspection).
// Viewing a "Baru" order marks it as seen so the unread badge stays accurate.
export const GET = handle(async (req: NextRequest, ctx: any) => {
  const user = await getCurrentUser(req);
  const { id } = await ctx.params;
  const o = await prisma.custom_tees_orders.findFirst({ where: { id, tenant_id: user.tenant_id } });
  if (!o) throw new HttpError(404, 'Pesanan tidak ditemukan');
  if (!o.seen) {
    await prisma.custom_tees_orders.update({ where: { id }, data: { seen: true, updated_at: new Date() } });
  }
  return {
    id: o.id,
    order_code: o.order_code,
    customer_name: o.customer_name,
    customer_phone: o.customer_phone,
    customer_email: o.customer_email || '',
    product_name: o.product_name,
    shirt_size: o.shirt_size,
    color_name: o.color_name,
    color_hex: o.color_hex,
    status: o.status,
    seen: true,
    note: o.note || '',
    design: safeJsonParse(o.design, {}),
    created_at: o.created_at instanceof Date ? o.created_at.toISOString() : o.created_at,
    updated_at: o.updated_at instanceof Date ? o.updated_at.toISOString() : o.updated_at,
  };
});

// PATCH — update status (and/or mark seen).
export const PATCH = handle(async (req: NextRequest, ctx: any) => {
  const user = await getCurrentUser(req);
  const { id } = await ctx.params;
  const body = await readBody(req);
  const o = await prisma.custom_tees_orders.findFirst({ where: { id, tenant_id: user.tenant_id } });
  if (!o) throw new HttpError(404, 'Pesanan tidak ditemukan');

  const patch: any = { updated_at: new Date() };
  if (body.status != null) {
    const status = String(body.status);
    if (!STATUSES.includes(status)) throw new HttpError(400, 'Status tidak valid');
    patch.status = status;
    patch.seen = true;
  }
  if (body.seen != null) patch.seen = !!body.seen;

  const updated = await prisma.custom_tees_orders.update({ where: { id }, data: patch });
  return { ok: true, status: updated.status, seen: !!updated.seen };
});

// DELETE — remove an order.
export const DELETE = handle(async (req: NextRequest, ctx: any) => {
  const user = await getCurrentUser(req);
  const { id } = await ctx.params;
  const o = await prisma.custom_tees_orders.findFirst({ where: { id, tenant_id: user.tenant_id } });
  if (!o) throw new HttpError(404, 'Pesanan tidak ditemukan');
  await prisma.custom_tees_orders.delete({ where: { id } });
  return { ok: true };
});
