import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { newId } from '@/lib/http';
import { decryptSecret } from '@/lib/crypto';
import { SHOPEE_WEBHOOK_PATH, webhookSignature, webhookUrl } from '@/lib/channels/shopee/client';
import { runShopeeSync } from '@/lib/channels/shopee/sync';

export const dynamic = 'force-dynamic';

/**
 * Perbandingan tanda tangan tanpa membocorkan waktu eksekusi. Header
 * Authorization dari Shopee berisi HMAC hex, jadi huruf besar/kecil
 * dinormalkan dulu sebelum dibandingkan byte per byte.
 */
function sameSignature(received: string, expected: string): boolean {
  const a = Buffer.from(String(received).trim().toLowerCase(), 'utf8');
  const b = Buffer.from(String(expected).trim().toLowerCase(), 'utf8');
  if (a.length !== b.length || b.length === 0) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * GET /api/channels/shopee/webhook — hanya penanda bahwa endpoint hidup,
 * dipakai saat memverifikasi URL di Shopee Console. Tidak membaca kredensial
 * dan tidak mengembalikan data apa pun selain path-nya.
 */
export async function GET() {
  return NextResponse.json({ ok: true, endpoint: SHOPEE_WEBHOOK_PATH, method: 'POST' });
}

/**
 * POST /api/channels/shopee/webhook — Order Status Update Push (code 3).
 * Wajib: verifikasi HMAC atas BODY MENTAH, balas 2xx tanpa isi < 3 detik,
 * proses detailnya asinkron, dan buang event duplikat.
 */
export async function POST(req: NextRequest) {
  const raw = await req.text();
  let event: any = null;
  try {
    event = JSON.parse(raw);
  } catch {
    return new NextResponse(null, { status: 400 });
  }

  const shopId = String(event?.shop_id || '');
  const channel = shopId
    ? await prisma.sales_channels.findFirst({ where: { type: 'shopee', external_shop_id: shopId } })
    : await prisma.sales_channels.findFirst({ where: { type: 'shopee' } });
  if (!channel) return new NextResponse(null, { status: 401 });

  const credRow = await prisma.channel_credentials.findFirst({ where: { sales_channel_id: channel.id } });
  const partnerKey = decryptSecret(credRow?.partner_key_enc);
  if (!partnerKey) return new NextResponse(null, { status: 401 });

  const auth = req.headers.get('authorization') || '';
  const callbackUrl = webhookUrl(new URL(req.url).origin);
  const expected = webhookSignature(partnerKey, callbackUrl, raw);
  if (!sameSignature(auth, expected)) {
    return new NextResponse(null, { status: 401 });
  }

  const orderSn = String(event?.data?.ordersn || event?.data?.order_sn || '');
  const eventKey = `${shopId}:${event?.code}:${orderSn}:${event?.data?.update_time || event?.timestamp || ''}`.slice(0, 160);
  try {
    await prisma.channel_webhook_events.create({
      data: {
        id: newId(),
        sales_channel_id: channel.id,
        event_key: eventKey,
        event_code: String(event?.code ?? ''),
        external_shop_id: shopId || null,
        payload: raw.slice(0, 100_000),
        created_at: new Date(),
      },
    });
  } catch {
    // event_key unik -> duplikat, jangan proses dua kali
    return new NextResponse(null, { status: 204 });
  }

  if (orderSn) {
    // Jangan tahan respons: Shopee timeout 3 detik lalu mengirim ulang.
    setTimeout(() => {
      runShopeeSync({ tenantId: channel.tenant_id, syncType: 'webhook', orderSns: [orderSn] })
        .then(() =>
          prisma.channel_webhook_events
            .updateMany({ where: { event_key: eventKey }, data: { processed_at: new Date() } })
            .catch(() => undefined),
        )
        .catch((e) => console.error('[shopee-webhook] sync gagal:', e?.message || e));
    }, 0);
  }

  return new NextResponse(null, { status: 204 });
}
