import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRoles } from '@/lib/auth';
import { handle } from '@/lib/handler';
import { localRangeToUtc, parseDate } from '@/lib/business';

export const GET = handle(async (req: NextRequest) => {
  const user = await requireRoles(req, 'Owner', 'Manager');
  const url = new URL(req.url);
  const startStr = url.searchParams.get('start'); const endStr = url.searchParams.get('end');
  const { s, e } = localRangeToUtc(startStr, endStr);
  const tid = user.tenant_id;
  const saleWhere: any = { tenant_id: tid, refunded: false };
  if (s || e) saleWhere.created_at = {};
  if (s) saleWhere.created_at.gte = s;
  if (e) saleWhere.created_at.lt = e;
  const sales = await prisma.sales.findMany({ where: saleWhere });
  const salesIn = sales.reduce((a, x) => a + x.total, 0);

  const startDate = parseDate(startStr); const endDate = parseDate(endStr);
  const finWhere: any = { tenant_id: tid };
  if (startDate || endDate) finWhere.date = {};
  if (startDate) finWhere.date.gte = startDate;
  if (endDate) finWhere.date.lte = endDate;
  const others = await prisma.other_income.findMany({ where: finWhere });
  const oiIn = others.reduce((a, x) => a + x.amount, 0);
  const expenses = await prisma.expenses.findMany({ where: finWhere });
  const expByCat: Record<string, number> = {};
  for (const ex of expenses) expByCat[ex.category] = (expByCat[ex.category] || 0) + ex.amount;
  const expOut = expenses.reduce((a, x) => a + x.amount, 0);

  const purWhere: any = { tenant_id: tid, status: 'Diterima' };
  const purchases = await prisma.purchases.findMany({ where: purWhere });
  const filtered = purchases.filter((p) => {
    const ref = p.received_at || p.created_at;
    if (s && ref < s) return false;
    if (e && ref >= e) return false;
    return true;
  });
  const purchaseOut = filtered.reduce((a, x) => a + (x.total || 0), 0);

  const inflow = salesIn + oiIn;
  const outflow = purchaseOut + expOut;
  return {
    inflow: { sales: salesIn, other_income: oiIn, total: inflow },
    outflow: {
      purchases: purchaseOut, expenses: expOut, total: outflow,
      expenses_by_category: Object.entries(expByCat).map(([category, amount]) => ({ category, amount })),
    },
    net_cash: inflow - outflow,
    sales_count: sales.length, purchase_count: filtered.length, expense_count: expenses.length,
  };
});
