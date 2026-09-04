import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRoles, logActivity } from '@/lib/auth';
import { handle } from '@/lib/handler';

export const POST = handle(async (req: NextRequest) => {
  const user = await requireRoles(req, 'Owner');
  const r = await prisma.products.updateMany({ where: { tenant_id: user.tenant_id }, data: { stock: 0 } });
  await logActivity(user.tenant_id, user, 'Reset Stok', `Stok ${r.count} produk di-reset ke 0`);
  return { ok: true, reset: r.count };
});
