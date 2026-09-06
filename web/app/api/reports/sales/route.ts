import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRoles } from '@/lib/auth';
import { handle } from '@/lib/handler';
import { localRangeToUtc } from '@/lib/business';
import { serializeSale } from '@/lib/serializers';

export const GET = handle(async (req: NextRequest) => {
  const user = await requireRoles(req, 'Owner', 'Manager');
  const url = new URL(req.url);
  const { s, e } = localRangeToUtc(url.searchParams.get('start'), url.searchParams.get('end'));
  const where: any = { tenant_id: user.tenant_id, refunded: false };
  if (s || e) where.created_at = {};
  if (s) where.created_at.gte = s;
  if (e) where.created_at.lt = e;
  const sales = await prisma.sales.findMany({
    where, orderBy: { created_at: 'desc' }, take: 20000,
  });
  const byMethod: Record<string, { total: number; count: number }> = {};
  const byChannel: Record<string, { total: number; profit: number; count: number }> = {};
  for (const s of sales) {
    const m = byMethod[s.payment_method] || { total: 0, count: 0 };
    m.total += s.total; m.count += 1; byMethod[s.payment_method] = m;
    const ch = s.channel || 'Toko';
    const c = byChannel[ch] || { total: 0, profit: 0, count: 0 };
    c.total += s.total; c.profit += s.profit || 0; c.count += 1; byChannel[ch] = c;
  }
  return {
    count: sales.length,
    total: (sales || []).reduce((a, s) => a + s.total, 0),
    profit: (sales || []).reduce((a, s) => a + (s.profit || 0), 0),
    by_method: Object.entries(byMethod).map(([method, v]) => ({ method, total: v.total, count: v.count })),
    by_channel: Object.entries(byChannel).map(([channel, v]) => ({ channel, ...v })).sort((a, b) => b.total - a.total),
    sales: (sales || []).map(serializeSale),
  };
});
