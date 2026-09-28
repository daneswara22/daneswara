import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { newId } from '@/lib/http';
import { runShopeeSync } from '@/lib/channels/shopee/sync';

export const dynamic = 'force-dynamic';

// Cron endpoints must ack 2xx immediately; enqueue/background the actual work.
// Rekonsiliasi berkala semua kanal (cadangan kalau push/webhook Shopee lolos).
// Inkremental: hanya jendela beberapa hari terakhir memakai update_time.

function authorized(req: NextRequest): boolean {
  const secret = process.env.WEBHOOK_CRON_SECRET || process.env.CRON_SECRET || '';
  if (!secret) return false;
  const header = req.headers.get('authorization') || '';
  const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7) : header;
  const a = Buffer.from(token);
  const b = Buffer.from(secret);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

async function handle(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
  }
  const runId = req.headers.get('x-webhook-id') || '';
  const eventKey = `cron:sync-channels:${runId || Date.now()}`.slice(0, 160);

  // Idempotensi per run_id: kalau webhook yang sama dikirim ulang, cukup ack.
  try {
    await prisma.channel_webhook_events.create({
      data: { id: newId(), event_key: eventKey, event_code: 'cron', created_at: new Date() },
    });
  } catch {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  const channels = await prisma.sales_channels.findMany({
    where: { type: 'shopee', status: 'connected', auto_sync: true },
    select: { id: true, tenant_id: true },
  });

  // Kerja beratnya jalan di belakang; respons langsung 2xx (<5 detik).
  setTimeout(() => {
    (async () => {
      for (const ch of channels) {
        try {
          await runShopeeSync({ tenantId: ch.tenant_id, syncType: 'cron', days: 3 });
        } catch (e: any) {
          console.error('[cron/sync-channels] gagal:', e?.message || e);
        }
      }
      await prisma.channel_webhook_events
        .updateMany({ where: { event_key: eventKey }, data: { processed_at: new Date() } })
        .catch(() => undefined);
    })();
  }, 0);

  return NextResponse.json({ ok: true, queued_channels: channels.length });
}

export async function POST(req: NextRequest) {
  return handle(req);
}

export async function PUT(req: NextRequest) {
  return handle(req);
}
