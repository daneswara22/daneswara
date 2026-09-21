import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { handle } from '@/lib/handler';

// Lightweight unread/pending count for the sidebar badge.
export const GET = handle(async (req: NextRequest) => {
  const user = await getCurrentUser(req);
  const count = await prisma.custom_tees_orders.count({
    where: { tenant_id: user.tenant_id, status: 'Baru' },
  });
  return { count };
});
