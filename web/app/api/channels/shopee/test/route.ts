import { NextRequest } from 'next/server';
import { requireRoles } from '@/lib/auth';
import { handle } from '@/lib/handler';
import { HttpError } from '@/lib/http';
import { getShopInfo } from '@/lib/channels/shopee/client';
import { shopeeContext } from '@/lib/channels/shopee/sync';
import { updateChannel } from '@/lib/channels/store';

export const dynamic = 'force-dynamic';

/** POST /api/channels/shopee/test — Test Connection (ambil info toko). */
export const POST = handle(async (req: NextRequest) => {
  const user = await requireRoles(req, 'Owner', 'Manager');
  try {
    const ctx = await shopeeContext(user.tenant_id);
    const info: any = await getShopInfo(ctx.cfg, ctx.accessToken, ctx.shopId);
    const payload = info?.response || info || {};
    const shopName = String(payload?.shop_name || '');
    await updateChannel(ctx.channel.id, {
      status: 'connected',
      shop_name: shopName || ctx.channel.shop_name,
      shop_region: String(payload?.region || ctx.channel.shop_region || '').slice(0, 10) || null,
      last_error: null,
    });
    return {
      ok: true,
      shop_id: ctx.shopId,
      shop_name: shopName,
      region: payload?.region || null,
      status: payload?.status || null,
      environment: ctx.cfg.environment,
    };
  } catch (e: any) {
    throw new HttpError(e?.httpStatus && e.httpStatus < 500 ? 400 : 502, e?.message || 'Test koneksi Shopee gagal');
  }
});
