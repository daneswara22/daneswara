import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRoles } from '@/lib/auth';
import { handle } from '@/lib/handler';
import { serializeCustomTeeOrder } from '@/lib/serializers';
import { DRAFT_STATUS } from '@/lib/customTeeOrders';

export const dynamic = 'force-dynamic';

/** Admin list of submitted Custom Tees orders (drafts hidden by default). */
export const GET = handle(async (req: NextRequest) => {
  const user = await requireRoles(req, 'Owner', 'Manager', 'Kasir');
  const url = new URL(req.url);
  const status = (url.searchParams.get('status') || '').trim();
  const includeDrafts = url.searchParams.get('include_drafts') === '1';

  const where: any = { tenant_id: user.tenant_id };
  if (status) where.status = status;
  else if (!includeDrafts) where.status = { not: DRAFT_STATUS };

  const rows = await prisma.custom_tee_orders.findMany({
    where,
    orderBy: [{ created_at: 'desc' }],
    take: 200,
  });
  return (rows || []).map((r) => serializeCustomTeeOrder(r, false));
});
