import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { handle } from '@/lib/handler';
import { serializeMockup } from '@/lib/serializers';

// Public endpoint used by the /custom design page.
// Returns all mockups for the tenant. Since this SaaS is single-tenant here,
// we grab the first tenant_id found on tenants table (mirrors gallery public route).
export const GET = handle(async (req: NextRequest) => {
  const url = new URL(req.url);
  const productKey = url.searchParams.get('product_key') || undefined;
  const rows = await prisma.custom_mockups.findMany({
    where: productKey ? { product_key: productKey } : {},
    orderBy: [{ sort_order: 'asc' }, { created_at: 'asc' }],
  });
  const res = NextResponse.json((rows || []).map(serializeMockup));
  res.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
  return res;
});
