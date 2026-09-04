import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRoles, logActivity } from '@/lib/auth';
import { handle } from '@/lib/handler';
import { HttpError } from '@/lib/http';
import { safeJsonParse } from '@/lib/business';

export const POST = handle(async (req: NextRequest, ctx: { params: Promise<{ sid: string }> }) => {
  const { sid } = await ctx.params;
  const user = await requireRoles(req, 'Owner', 'Manager');
  const tid = user.tenant_id;
  const sale = await prisma.sales.findFirst({ where: { id: sid, tenant_id: tid } });
  if (!sale) throw new HttpError(404, 'Transaksi tidak ditemukan');
  if (sale.refunded) throw new HttpError(400, 'Transaksi sudah di-refund');
  const items = safeJsonParse<any[]>(sale.items, []);
  for (const i of items) {
    const prod = await prisma.products.findFirst({ where: { id: i.product_id, tenant_id: tid } });
    if (prod) {
      await prisma.products.update({ where: { id: prod.id }, data: { stock: (prod.stock || 0) + Number(i.qty || 0) } });
    }
  }
  await prisma.sales.update({ where: { id: sid }, data: { refunded: true, refunded_at: new Date() } });
  await logActivity(tid, user, 'Refund', sale.invoice);
  return { ok: true };
});
