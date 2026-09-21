import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { handle } from '@/lib/handler';
import { DRAFT_STATUS, NEW_STATUS } from '@/lib/customTeeOrders';

export const dynamic = 'force-dynamic';

/** Badge counter for the admin "Custom Tees" menu. */
export const GET = handle(async (req: NextRequest) => {
  const user = await getCurrentUser(req);
  const [newCount, total] = await Promise.all([
    prisma.custom_tee_orders.count({ where: { tenant_id: user.tenant_id, status: NEW_STATUS } }),
    prisma.custom_tee_orders.count({ where: { tenant_id: user.tenant_id, status: { not: DRAFT_STATUS } } }),
  ]);
  return { new: newCount, total };
});
