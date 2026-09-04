import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { handle } from '@/lib/handler';
import { localDateOf, localToday, safeJsonParse, toIsoUtc } from '@/lib/business';
import { serializeProduct, serializeActivity } from '@/lib/serializers';
import { parseDate } from '@/lib/business';

export const GET = handle(async (req: NextRequest) => {
  const user = await getCurrentUser(req);
  const tid = user.tenant_id;
  const today = localToday();
  const todayDate = parseDate(today)!;
  const weekStartDate = new Date(todayDate.getTime() - 6 * 86400_000);

  const totalsAgg = await prisma.sales.aggregate({
    where: { tenant_id: tid, refunded: false },
    _sum: { total: true }, _count: true,
  });
  const totalRevenue = Number(totalsAgg._sum.total || 0);
  const totalTransactions = totalsAgg._count;

  const recent = await prisma.sales.findMany({
    where: { tenant_id: tid, refunded: false, created_at: { gte: weekStartDate } },
    orderBy: { created_at: 'desc' },
    take: 5000,
  });
  const todaySales = recent.filter((s) => localDateOf(s.created_at) === today);
  const series: any[] = [];
  for (let d = 6; d >= 0; d--) {
    const day = new Date(todayDate.getTime() - d * 86400_000);
    const dayKey = localDateOf(day)!;
    const totalDay = recent.filter((s) => localDateOf(s.created_at) === dayKey).reduce((a, s) => a + s.total, 0);
    series.push({ date: dayKey.slice(5), total: totalDay });
  }

  const products = await prisma.products.findMany({ where: { tenant_id: tid } });
  const lowStock = products.filter((p) => (p.stock || 0) <= (p.min_stock || 5)).map(serializeProduct);
  const minusStock = products.filter((p) => (p.stock || 0) < 0).map(serializeProduct);

  const allItems = await prisma.sales.findMany({
    where: { tenant_id: tid, refunded: false }, select: { items: true },
  });
  const prodQty: Record<string, number> = {};
  for (const s of allItems) {
    for (const i of safeJsonParse<any[]>(s.items, [])) {
      const n = i?.name || '?';
      prodQty[n] = (prodQty[n] || 0) + Number(i?.qty || 0);
    }
  }
  const topProducts = Object.entries(prodQty)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, qty]) => ({ name, qty }));

  const activities = await prisma.activities.findMany({
    where: { tenant_id: tid }, orderBy: { created_at: 'desc' }, take: 8,
  });

  return {
    today_revenue: todaySales.reduce((a, s) => a + s.total, 0),
    today_transactions: todaySales.length,
    today_profit: todaySales.reduce((a, s) => a + (s.profit || 0), 0),
    total_revenue: totalRevenue,
    total_transactions: totalTransactions,
    product_count: products.length,
    low_stock_count: lowStock.length,
    low_stock: lowStock.slice(0, 10),
    minus_stock_count: minusStock.length,
    minus_stock: minusStock.slice(0, 20),
    sales_series: series,
    top_products: topProducts,
    activities: activities.map(serializeActivity),
  };
});
