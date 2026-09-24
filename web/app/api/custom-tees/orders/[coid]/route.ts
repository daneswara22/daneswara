import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRoles, logActivity } from '@/lib/auth';
import { handle, readBody } from '@/lib/handler';
import { HttpError } from '@/lib/http';
import { serializeCustomTeeOrder } from '@/lib/serializers';
import { CUSTOM_TEE_STATUSES } from '@/lib/customTeeOrders';

export const dynamic = 'force-dynamic';

async function find(req: NextRequest, ctx: any) {
  const user = await requireRoles(req, 'Owner', 'Manager', 'Kasir');
  const { coid } = await ctx.params;
  const row = await prisma.custom_tee_orders.findFirst({ where: { id: coid, tenant_id: user.tenant_id } });
  if (!row) throw new HttpError(404, 'Pesanan tidak ditemukan');
  return { user, row };
}

/** Full order incl. the complete design payload. */
export const GET = handle(async (req: NextRequest, ctx: any) => {
  const { row } = await find(req, ctx);
  return serializeCustomTeeOrder(row, true);
});

/** Update the order status only — the design payload is never touched. */
export const PATCH = handle(async (req: NextRequest, ctx: any) => {
  const { user, row } = await find(req, ctx);
  const body = await readBody(req);
  const status = String(body?.status || '').trim();
  if (!CUSTOM_TEE_STATUSES.includes(status as any)) throw new HttpError(400, 'Status tidak valid');
  const updated = await prisma.custom_tee_orders.update({
    where: { id: row.id },
    data: { status, updated_at: new Date() },
  });
  await logActivity(user.tenant_id, user, 'Update Pesanan Custom Tees', `${row.order_code} → ${status}`);
  return serializeCustomTeeOrder(updated, true);
});
