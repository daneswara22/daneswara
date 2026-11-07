import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRoles, logActivity } from '@/lib/auth';
import { handle, readBody } from '@/lib/handler';
import { HttpError } from '@/lib/http';
import { ensureFinanceSchema } from '@/lib/schemaGuard';

/**
 * POST /api/purchases/:pid/pay
 * Tandai PO sudah dibayar ke supplier. Arus kas memakai `paid_at`, jadi
 * pembayaran di sini yang menentukan kapan uang benar-benar keluar.
 *
 * Body: { paid_amount?, payment_source? }
 */
export const POST = handle(async (req: NextRequest, ctx: { params: Promise<{ pid: string }> }) => {
  const { pid } = await ctx.params;
  const user = await requireRoles(req, 'Owner', 'Manager');
  await ensureFinanceSchema();
  const tid = user.tenant_id;

  const po = await prisma.purchases.findFirst({ where: { id: pid, tenant_id: tid } });
  if (!po) throw new HttpError(404, 'PO tidak ditemukan');
  if (po.payment_status === 'PAID') throw new HttpError(400, 'PO sudah dibayar');

  const body = await readBody(req);
  const amount = Number(body?.paid_amount ?? po.total) || 0;
  if (amount <= 0) throw new HttpError(400, 'Nominal bayar harus lebih dari 0');

  const now = new Date();
  const updated = await prisma.purchases.update({
    where: { id: pid },
    data: {
      payment_status: 'PAID',
      paid_at: now,
      paid_amount: amount,
      payment_source: String(body?.payment_source || 'Tunai').trim() || 'Tunai',
    },
  });

  await logActivity(tid, user, 'Bayar PO', `${po.po_number} - ${amount}`);
  return updated;
});
