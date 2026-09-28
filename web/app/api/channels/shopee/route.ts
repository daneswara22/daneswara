import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireRoles, logActivity } from '@/lib/auth';
import { handle, readBody } from '@/lib/handler';
import { channelPublicView, clearTokens, ensureChannel, getCreds, savePartnerCreds, updateChannel } from '@/lib/channels/store';
import { redirectUri, webhookUrl } from '@/lib/channels/shopee/client';

export const dynamic = 'force-dynamic';

const configSchema = z.object({
  partner_id: z.string().trim().max(40).optional(),
  partner_key: z.string().trim().max(200).optional(),
  environment: z.enum(['sandbox', 'live']).optional(),
  auto_sync: z.boolean().optional(),
});

/** GET /api/channels/shopee — status koneksi (tanpa token / partner key). */
export const GET = handle(async (req: NextRequest) => {
  const user = await requireRoles(req, 'Owner', 'Manager');
  const ch = await ensureChannel(user.tenant_id, 'shopee');
  const creds = await getCreds(ch.id);
  const origin = new URL(req.url).origin;
  return {
    ...channelPublicView(ch, creds),
    redirect_uri: redirectUri(origin),
    webhook_url: webhookUrl(origin),
  };
});

/** POST /api/channels/shopee — simpan Partner ID / Key / environment. */
export const POST = handle(async (req: NextRequest) => {
  const user = await requireRoles(req, 'Owner', 'Manager');
  const body = configSchema.parse(await readBody(req));
  const ch = await ensureChannel(user.tenant_id, 'shopee');

  if (body.partner_id !== undefined || body.partner_key) {
    await savePartnerCreds(ch.id, body.partner_id ?? (await getCreds(ch.id)).partnerId, body.partner_key || undefined);
  }
  const patch: Record<string, any> = {};
  if (body.environment) patch.environment = body.environment;
  if (body.auto_sync !== undefined) patch.auto_sync = body.auto_sync;
  const updated = Object.keys(patch).length ? await updateChannel(ch.id, patch) : ch;

  await logActivity(user.tenant_id, user, 'Konfigurasi Shopee', 'Partner ID/Key atau environment diperbarui');
  const creds = await getCreds(ch.id);
  return channelPublicView(updated, creds);
});

/** DELETE /api/channels/shopee — putuskan koneksi (pesanan lama TIDAK dihapus). */
export const DELETE = handle(async (req: NextRequest) => {
  const user = await requireRoles(req, 'Owner', 'Manager');
  const ch = await ensureChannel(user.tenant_id, 'shopee');
  await clearTokens(ch.id);
  const updated = await updateChannel(ch.id, {
    status: 'disconnected',
    external_shop_id: null,
    shop_name: null,
    connected_at: null,
    last_error: null,
  });
  await logActivity(user.tenant_id, user, 'Putus Koneksi Shopee', 'Token dihapus, pesanan tersimpan tetap ada');
  const creds = await getCreds(ch.id);
  return channelPublicView(updated, creds);
});
