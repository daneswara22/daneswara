import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRoles } from '@/lib/auth';
import { handle, readBody } from '@/lib/handler';
import { reorderInputSchema } from '@/lib/schemas';

export const POST = handle(async (req: NextRequest) => {
  const user = await requireRoles(req, 'Owner', 'Manager');
  const data = reorderInputSchema.parse(await readBody(req));
  const n = data.ids.length;
  for (let idx = 0; idx < n; idx++) {
    await prisma.gallery_items.updateMany({
      where: { id: data.ids[idx], tenant_id: user.tenant_id },
      data: { sort_order: n - idx },
    });
  }
  return { ok: true, count: n };
});
