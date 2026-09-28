import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { runShopeeSync } from '@/lib/channels/shopee/sync';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * POST /api/channels/sync-all — rekonsiliasi periodik (dipanggil cron).
 * Hanya kanal dengan auto_sync aktif & sudah terhubung. Inkremental (update_time)
 * supaya kuota API Shopee tidak terbuang.
 * Dilindungi header `x-cron-key` bila CRON_SECRET diset.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET || '';
  if (secret && req.headers.get('x-cron-key') !== secret) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
  }
  const url = new URL(req.url);
  const days = Math.min(15, Math.max(1, Number(url.searchParams.get('days')) || 3));

  const channels = await prisma.sales_channels.findMany({
    where: { type: 'shopee', status: 'connected', auto_sync: true },
  });
  const results = [];
  for (const ch of channels) {
    try {
      const r = await runShopeeSync({ tenantId: ch.tenant_id, syncType: 'cron', days });
      results.push({ channel: ch.type, tenant_id: ch.tenant_id, ...r });
    } catch (e: any) {
      results.push({ channel: ch.type, tenant_id: ch.tenant_id, status: 'failed', message: e?.message || String(e) });
    }
  }
  return NextResponse.json({ ran: results.length, results });
}

export async function GET(req: NextRequest) {
  return POST(req);
}
