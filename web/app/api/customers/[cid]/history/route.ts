import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { handle } from '@/lib/handler';
import { serializeSale } from '@/lib/serializers';

export const GET = handle(async (req: NextRequest, ctx: { params: Promise<{ cid: string }> }) => {
  const { cid } = await ctx.params;
  const user = await getCurrentUser(req);
  const rows = await prisma.sales.findMany({
    where: { tenant_id: user.tenant_id, customer_id: cid, refunded: false },
    orderBy: { created_at: 'desc' },
    take: 500,
  });
  return (rows || []).map(serializeSale);
});
