import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRoles, logActivity } from '@/lib/auth';
import { handle, readBody } from '@/lib/handler';
import { reorderInputSchema } from '@/lib/schemas';

export const POST = handle(async (req: NextRequest) => {
  const user = await requireRoles(req, 'Owner', 'Manager', 'Gudang');
  const data = reorderInputSchema.parse(await readBody(req));
  for (let idx = 0; idx < data.ids.length; idx++) {
    await prisma.categories.updateMany({
      where: { id: data.ids[idx], tenant_id: user.tenant_id },
      data: { sort_order: idx },
    });
  }
  await logActivity(user.tenant_id, user, 'Atur Urutan Kategori', `${data.ids.length} kategori diurutkan ulang`);
  return { ok: true, count: data.ids.length };
});
