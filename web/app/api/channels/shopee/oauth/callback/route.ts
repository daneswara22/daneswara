import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { ensureChannel, getCreds, saveTokens, updateChannel } from '@/lib/channels/store';
import { exchangeCodeForToken, getShopInfo } from '@/lib/channels/shopee/client';

export const dynamic = 'force-dynamic';

function back(req: NextRequest, params: Record<string, string>) {
  const url = new URL('/app/sales-channels', req.url);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return NextResponse.redirect(url);
}

/**
 * GET /api/channels/shopee/oauth/callback?code=...&shop_id=...&state=...
 * Tukar code (sekali pakai, 10 menit) jadi access/refresh token di server.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code') || '';
  const shopId = url.searchParams.get('shop_id') || '';
  const state = url.searchParams.get('state') || '';
  const cookie = req.cookies.get('shopee_oauth')?.value || '';

  let saved: any = null;
  try {
    saved = cookie ? JSON.parse(cookie) : null;
  } catch {
    saved = null;
  }
  if (!code || !shopId || !state || !saved?.state || saved.state !== state) {
    return back(req, { error: 'invalid_callback' });
  }

  try {
    const tenantId =
      saved.tid || (await prisma.tenants.findFirst({ orderBy: { created_at: 'asc' }, select: { id: true } }))?.id;
    if (!tenantId) return back(req, { error: 'no_tenant' });
    const ch = await ensureChannel(tenantId, 'shopee');
    const creds = await getCreds(ch.id);
    const cfg = {
      partnerId: creds.partnerId,
      partnerKey: creds.partnerKey,
      environment: (ch.environment === 'live' ? 'live' : 'sandbox') as 'live' | 'sandbox',
    };
    const tokens = await exchangeCodeForToken(cfg, code, shopId);
    await saveTokens(ch.id, tokens);

    let shopName = '';
    let region = '';
    try {
      const info: any = await getShopInfo(cfg, tokens.accessToken, shopId);
      shopName = String(info?.shop_name || info?.response?.shop_name || '');
      region = String(info?.region || info?.response?.region || '');
    } catch {
      /* nama toko opsional; koneksi tetap dianggap berhasil */
    }
    await updateChannel(ch.id, {
      status: 'connected',
      external_shop_id: String(shopId),
      shop_name: shopName || `Shopee Shop ${shopId}`,
      shop_region: region.slice(0, 10) || null,
      connected_at: new Date(),
      last_error: null,
    });

    const res = back(req, { connected: '1' });
    res.cookies.set('shopee_oauth', '', { path: '/', maxAge: 0 });
    return res;
  } catch (e: any) {
    return back(req, { error: String(e?.code || 'token_failed'), message: String(e?.message || '').slice(0, 160) });
  }
}
