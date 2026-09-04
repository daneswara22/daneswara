import { NextRequest, NextResponse } from 'next/server';

// Hosts treated as the POS / dashboard entry point (e.g. pos.daneswara.com).
// The landing site stays on the apex/www host; these subdomains open the app.
const POS_SUBDOMAINS = ['pos', 'dashboard', 'app'];

export function middleware(req: NextRequest) {
  const host = (req.headers.get('host') || '').split(':')[0];
  const sub = host.split('.')[0];
  const isPosHost = POS_SUBDOMAINS.includes(sub);

  if (isPosHost && req.nextUrl.pathname === '/') {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // only needs to inspect the root path to redirect the POS subdomain
  matcher: ['/'],
};
