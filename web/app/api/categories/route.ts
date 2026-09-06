import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser, requireRoles } from '@/lib/auth';
import { handle, readBody } from '@/lib/handler';
import { storage } from '@/lib/storage';
import { newId } from '@/lib/http';
import { categoryInputSchema } from '@/lib/schemas';
import { serializeCategory } from '@/lib/serializers';

function sortKey(row: any) {
  const so = row.sort_order != null ? row.sort_order : 1e9;
  return [so, (row.name || '').toLowerCase()];
}

export const GET = handle(async (req: NextRequest) => {
  const user = await getCurrentUser(req);
  const rows = await prisma.categories.findMany({ where: { tenant_id: user.tenant_id } });
  const out = (rows || []).map(serializeCategory);
  out.sort((a: any, b: any) => {
    const [as, an] = sortKey(a), [bs, bn] = sortKey(b);
    return as !== bs ? (as as number) - (bs as number) : String(an).localeCompare(String(bn));
  });
  return out;
});

export const POST = handle(async (req: NextRequest) => {
  const user = await requireRoles(req, 'Owner', 'Manager', 'Gudang');
  const data = categoryInputSchema.parse(await readBody(req));
  const count = await prisma.categories.count({ where: { tenant_id: user.tenant_id } });
  const image = await storage.normalizeImageField(data.image || '', 'category');
  const c = await prisma.categories.create({
    data: {
      id: newId(), tenant_id: user.tenant_id, name: data.name,
      color: data.color || '#2563EB', image, sort_order: count, created_at: new Date(),
    },
  });
  return serializeCategory(c);
});
