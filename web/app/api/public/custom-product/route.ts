import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { handle } from '@/lib/handler';
import { serializeCustomProduct } from '@/lib/serializers';
import { getCustomProductDefault } from '@/lib/customProductDefaults';

const DEFAULT_KEY = 'premium-cotton-7200';

export const GET = handle(async (req: NextRequest) => {
  const url = new URL(req.url);
  const productKey = url.searchParams.get('product_key') || DEFAULT_KEY;
  const row = await prisma.custom_products.findFirst({ where: { product_key: productKey } });
  const payload = row
    ? serializeCustomProduct(row)
    : { product_key: productKey, ...getCustomProductDefault(productKey), updated_at: null };
  const res = NextResponse.json(payload);
  res.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
  return res;
});
