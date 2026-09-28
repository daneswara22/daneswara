import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRoles } from '@/lib/auth';
import { handle } from '@/lib/handler';
import { ensureChannel } from '@/lib/channels/store';
import { toIso } from '@/lib/http';

export const dynamic = 'force-dynamic';

/** GET /api/channels/shopee/logs — riwayat sinkronisasi. */
export const GET = handle(async (req: NextRequest) => {
  const user = await requireRoles(req, 'Owner', 'Manager');
  const ch = await ensureChannel(user.tenant_id, 'shopee');
  const url = new URL(req.url);
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit')) || 30));
  const rows = await prisma.channel_sync_logs.findMany({
    where: { tenant_id: user.tenant_id, sales_channel_id: ch.id },
    orderBy: { started_at: 'desc' },
    take: limit,
  });
  return (rows || []).map((r) => ({
    id: r.id,
    sync_type: r.sync_type,
    status: r.status,
    started_at: toIso(r.started_at),
    finished_at: toIso(r.finished_at),
    orders_checked: r.orders_checked,
    orders_created: r.orders_created,
    orders_updated: r.orders_updated,
    orders_skipped: r.orders_skipped,
    errors_count: r.errors_count,
    api_status: r.api_status,
    message: r.message,
  }));
});
