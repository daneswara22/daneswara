import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser, logActivity } from '@/lib/auth';
import { handle, readBody } from '@/lib/handler';
import { HttpError } from '@/lib/http';
import { rp } from '@/lib/business';
import { orderDepositSchema } from '@/lib/schemas';
import { serializeOrder } from '@/lib/serializers';

export const POST = handle(async (req: NextRequest, ctx: { params: Promise<{ oid: string }> }) => {
  const { oid } = await ctx.params;
  const user = await getCurrentUser(req);
  const order = await prisma.orders.findFirst({ where: { id: oid, tenant_id: user.tenant_id } });
  if (!order) throw new HttpError(404, 'Pesanan tidak ditemukan');
  if (order.status === 'Selesai') throw new HttpError(400, 'Pesanan sudah selesai');
  const data = orderDepositSchema.parse(await readBody(req));
  if (data.deposit_amount <= 0) throw new HttpError(400, 'Nominal DP harus lebih dari 0');
  if (data.deposit_amount > order.total) throw new HttpError(400, 'Nominal DP melebihi total pesanan');
  const updated = await prisma.orders.update({
    where: { id: oid },
    data: {
      deposit_amount: data.deposit_amount, deposit_method: data.deposit_method,
      remaining: Math.max(0, order.total - data.deposit_amount), status: 'Proses',
    },
  });
  await logActivity(user.tenant_id, user, 'DP Pesanan', `${order.order_number} DP ${rp(data.deposit_amount)}`);
  return serializeOrder(updated);
});
