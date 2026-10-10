import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { requireRoles } from '@/lib/auth';
import { ensureChannel, getCreds } from '@/lib/channels/store';
import { buildAuthUrl, callbackBase, redirectUri as buildRedirectUri, shopeeEnvironment } from '@/lib/channels/shopee/client';

export const dynamic = 'force-dynamic';

/**
 * GET /api/channels/shopee/oauth/start
 * Membuat URL otorisasi penjual Shopee di SERVER lalu redirect.
 * Partner key tidak pernah ikut ke browser; `state` disimpan di cookie HttpOnly.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireRoles(req, 'Owner', 'Manager');
    const ch = await ensureChannel(user.tenant_id, 'shopee');
    const creds = await getCreds(ch.id);
    if (!creds.partnerId || !creds.partnerKey) {
      return NextResponse.redirect(new URL('/app/sales-channels?error=no_partner', callbackBase(new URL(req.url).origin)));
    }
    const origin = new URL(req.url).origin;
    const base = callbackBase(origin);
    const redirectUri = buildRedirectUri(origin);
    const state = crypto.randomBytes(24).toString('base64url');
    const url = buildAuthUrl(
      {
        partnerId: creds.partnerId,
        partnerKey: creds.partnerKey,
        environment: shopeeEnvironment(ch.environment),
      },
      redirectUri,
      state,
    );
    const res = NextResponse.redirect(url);
    res.cookies.set('shopee_oauth', JSON.stringify({ state, tid: user.tenant_id }), {
      httpOnly: true,
      sameSite: 'lax',
      secure: base.startsWith('https://'),
      path: '/',
      maxAge: 600,
    });
    return res;
  } catch (e: any) {
    const status = e?.status === 401 || e?.status === 403 ? 'unauthorized' : 'start_failed';
    return NextResponse.redirect(new URL(`/login?error=${status}`, callbackBase(new URL(req.url).origin)));
  }
}
