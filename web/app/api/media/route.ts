import { NextRequest, NextResponse } from 'next/server';
import { env } from '@/lib/env';

// Same-origin media proxy.
//
// WHY: receipt / voucher share images are rasterised in the browser (html2canvas +
// canvas.getImageData for the ESC/POS thermal logo). Before the R2 migration the shop
// logo was an inline base64 data URI so it was always same-origin. Now it is served from
// the R2 custom domain (cdn.daneswara.com), which does not send Access-Control-Allow-Origin,
// so the browser taints the canvas and the logo silently disappears from receipts.
//
// Streaming the object through our own origin removes the cross-origin problem entirely and
// does not depend on any Cloudflare dashboard/token permission.
//
// SSRF guard: only hosts belonging to this deployment's own R2 configuration are allowed.

function allowedHosts(): string[] {
  const hosts = new Set<string>();
  for (const candidate of [env.R2_PUBLIC_BASE_URL, env.r2Endpoint, env.PUBLIC_BASE_URL]) {
    if (!candidate) continue;
    try {
      hosts.add(new URL(candidate).hostname.toLowerCase());
    } catch {
      /* ignore malformed config */
    }
  }
  if (env.R2_ACCOUNT_ID) hosts.add(`${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`.toLowerCase());
  return [...hosts];
}

const ALLOWED_CONTENT_TYPES = ['image/webp', 'image/png', 'image/jpeg', 'image/gif', 'image/svg+xml', 'image/avif'];

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('url');
  if (!raw) return new NextResponse('Missing url', { status: 400 });

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return new NextResponse('Invalid url', { status: 400 });
  }

  if (target.protocol !== 'https:' && target.protocol !== 'http:') {
    return new NextResponse('Unsupported protocol', { status: 400 });
  }

  const hosts = allowedHosts();
  if (!hosts.includes(target.hostname.toLowerCase())) {
    return new NextResponse('Host not allowed', { status: 403 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(target.toString(), { cache: 'no-store' });
  } catch {
    return new NextResponse('Upstream fetch failed', { status: 502 });
  }

  if (!upstream.ok) {
    return new NextResponse('Upstream error', { status: upstream.status === 404 ? 404 : 502 });
  }

  const contentType = (upstream.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (contentType && !ALLOWED_CONTENT_TYPES.includes(contentType)) {
    return new NextResponse('Unsupported content type', { status: 415 });
  }

  const body = await upstream.arrayBuffer();
  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': contentType || 'image/webp',
      'Cache-Control': 'public, max-age=31536000, immutable',
      // Harmless for same-origin use, and lets the canvas read the pixels if a
      // future page ever loads this endpoint from another origin.
      'Access-Control-Allow-Origin': '*',
      'Timing-Allow-Origin': '*',
    },
  });
}
