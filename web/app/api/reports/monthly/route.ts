import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRoles } from '@/lib/auth';
import { handle } from '@/lib/handler';
import { HttpError } from '@/lib/http';
import { localDateOf } from '@/lib/business';

export const GET = handle(async (req: NextRequest) => {
  const user = await requireRoles(req, 'Owner', 'Manager');
  const url = new URL(req.url);
  const year = parseInt(url.searchParams.get('year') || '', 10);
  if (!year) throw new HttpError(400, 'year is required');
  const tid = user.tenant_id;
  const months: any[] = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, total: 0, profit: 0, expense: 0, other_income: 0, net: 0, count: 0 }));
  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));
  const sales = await prisma.sales.findMany({
    where: { tenant_id: tid, refunded: false, created_at: { gte: start, lte: end } },
  });
  for (const s of sales) {
    const key = localDateOf(s.created_at);
    if (!key) continue;
    const m = parseInt(key.slice(5, 7)) - 1;
    months[m].total += s.total;
    months[m].profit += s.profit || 0;
    months[m].count += 1;
  }
  const expenses = await prisma.expenses.findMany({
    where: { tenant_id: tid, date: { gte: new Date(year, 0, 1), lte: new Date(year, 11, 31) } },
  });
  for (const e of expenses) months[e.date.getMonth()].expense += e.amount;
  const others = await prisma.other_income.findMany({
    where: { tenant_id: tid, date: { gte: new Date(year, 0, 1), lte: new Date(year, 11, 31) } },
  });
  for (const e of others) months[e.date.getMonth()].other_income += e.amount;
  for (const mo of months) mo.net = mo.profit + mo.other_income - mo.expense;
  return { year, months };
});
