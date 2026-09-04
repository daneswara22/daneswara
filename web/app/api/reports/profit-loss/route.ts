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
  const revenue = sales.reduce((a, x) => a + x.total, 0);
  const hpp = sales.reduce((a, x) => a + (x.cost || 0), 0);

  const startDate = parseDate(startStr); const endDate = parseDate(endStr);
  const finWhere: any = { tenant_id: tid };
  if (startDate || endDate) finWhere.date = {};
  if (startDate) finWhere.date.gte = startDate;
  if (endDate) finWhere.date.lte = endDate;
  const expenses = await prisma.expenses.findMany({ where: finWhere });
  const others = await prisma.other_income.findMany({ where: finWhere });

  const byCat: Record<string, number> = {};
  for (const e of expenses) byCat[e.category] = (byCat[e.category] || 0) + e.amount;
  const oiByCat: Record<string, number> = {};
  for (const e of others) oiByCat[e.category] = (oiByCat[e.category] || 0) + e.amount;

  const expenseTotal = expenses.reduce((a, x) => a + x.amount, 0);
  const otherIncomeTotal = others.reduce((a, x) => a + x.amount, 0);
  return {
    revenue, hpp, gross_profit: revenue - hpp, expense_total: expenseTotal,
    expenses_by_category: Object.entries(byCat).map(([category, amount]) => ({ category, amount })),
    other_income_total: otherIncomeTotal,
    other_income_by_category: Object.entries(oiByCat).map(([category, amount]) => ({ category, amount })),
    net_profit: (revenue - hpp) + otherIncomeTotal - expenseTotal,
    sales_count: sales.length, expense_count: expenses.length, other_income_count: others.length,
  };
});
