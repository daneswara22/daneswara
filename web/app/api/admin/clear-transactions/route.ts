import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRoles, logActivity } from '@/lib/auth';
import { handle } from '@/lib/handler';

export const POST = handle(async (req: NextRequest) => {
  const user = await requireRoles(req, 'Owner');
  const tid = user.tenant_id;
  const result: Record<string, number> = {};
  const models: { name: string; del: () => Promise<{ count: number }> }[] = [
    { name: 'sales', del: () => prisma.sales.deleteMany({ where: { tenant_id: tid } }) },
    { name: 'orders', del: () => prisma.orders.deleteMany({ where: { tenant_id: tid } }) },
    { name: 'held_orders', del: () => prisma.held_orders.deleteMany({ where: { tenant_id: tid } }) },
    { name: 'activities', del: () => prisma.activities.deleteMany({ where: { tenant_id: tid } }) },
    { name: 'stock_movements', del: () => prisma.stock_movements.deleteMany({ where: { tenant_id: tid } }) },
    { name: 'expenses', del: () => prisma.expenses.deleteMany({ where: { tenant_id: tid } }) },
    { name: 'other_income', del: () => prisma.other_income.deleteMany({ where: { tenant_id: tid } }) },
  ];
  for (const m of models) {
    const r = await m.del();
    result[m.name] = r.count;
  }
  await logActivity(tid, user, 'Reset Data Transaksi', 'Semua transaksi percobaan dihapus');
  return { ok: true, deleted: result };
});
