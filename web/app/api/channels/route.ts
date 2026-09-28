import { NextRequest } from 'next/server';
import { requireRoles } from '@/lib/auth';
import { handle } from '@/lib/handler';
import { channelPublicView, ensureChannel, getCreds, listChannels } from '@/lib/channels/store';
import { CHANNEL_TYPES } from '@/lib/channels/types';

export const dynamic = 'force-dynamic';

/** GET /api/channels — daftar kanal penjualan + status koneksinya. */
export const GET = handle(async (req: NextRequest) => {
  const user = await requireRoles(req, 'Owner', 'Manager');
  await ensureChannel(user.tenant_id, 'shopee');
  const rows = await listChannels(user.tenant_id);
  const out = [];
  for (const ch of rows) {
    const creds = await getCreds(ch.id);
    out.push(channelPublicView(ch, creds));
  }
  return { channels: out, types: CHANNEL_TYPES };
});
