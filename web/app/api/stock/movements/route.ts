import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { handle } from '@/lib/handler';
import { serializeStockMovement } from '@/lib/serializers';

export const GET = handle(async (req: NextRequest) => {
  const user = await getCurrentUser(req);
  const rows = await prisma.stock_movements.findMany({
    where: { tenant_id: user.tenant_id },
    orderBy: { created_at: 'desc' },
    take: 500,
  });
  return rows.map(serializeStockMovement);
});
