import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser, requireRoles } from '@/lib/auth';
import { handle, readBody } from '@/lib/handler';
import { newId } from '@/lib/http';
import { customerInputSchema } from '@/lib/schemas';
import { serializeCustomer } from '@/lib/serializers';

export const GET = handle(async (req: NextRequest) => {
  const user = await getCurrentUser(req);
  const tid = user.tenant_id;
  const customers = await prisma.customers.findMany({ where: { tenant_id: tid }, orderBy: { created_at: 'desc' } });
  // aggregate sales stats per customer
  const agg = await prisma.sales.groupBy({
    by: ['customer_id'],
    where: { tenant_id: tid, customer_id: { not: null }, refunded: false },
    _sum: { total: true }, _count: true,
  });
  const map: Record<string, { total: number; visits: number }> = {};
  for (const g of agg) {
    if (g.customer_id) map[g.customer_id] = { total: Number(g._sum.total || 0), visits: g._count };
  }
  return customers.map((c: any) => {
    const d = serializeCustomer(c) as any;
    const s = map[c.id] || { total: 0, visits: 0 };
    d.total_spent = s.total; d.visits = s.visits;
    return d;
  });
});

export const POST = handle(async (req: NextRequest) => {
  const user = await getCurrentUser(req);
  const data = customerInputSchema.parse(await readBody(req));
  const c = await prisma.customers.create({
    data: {
      id: newId(), tenant_id: user.tenant_id, name: data.name, phone: data.phone || '', email: data.email || '', address: data.address || '',
      total_spent: 0, visits: 0, created_at: new Date(),
    },
  });
  return serializeCustomer(c);
});
