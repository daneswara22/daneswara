import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireRoles, logActivity } from '@/lib/auth';
import { handle, readBody } from '@/lib/handler';
import { runShopeeSync } from '@/lib/channels/shopee/sync';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const schema = z.object({
  days: z.number().int().min(1).max(120).optional(),
  order_sns: z.array(z.string().trim().min(1)).max(50).optional(),
});

/** POST /api/channels/shopee/sync — Sync Now / Retry Sync. */
export const POST = handle(async (req: NextRequest) => {
  const user = await requireRoles(req, 'Owner', 'Manager');
  const body = schema.parse((await readBody(req)) || {});
  const result = await runShopeeSync({
    tenantId: user.tenant_id,
    syncType: 'manual',
    days: body.days || 7,
    orderSns: body.order_sns,
  });
  await logActivity(
    user.tenant_id,
    user,
    'Sinkron Shopee',
    `${result.status} — cek ${result.orders_checked}, baru ${result.orders_created}, update ${result.orders_updated}`,
  );
  return result;
});
