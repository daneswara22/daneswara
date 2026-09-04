import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRoles } from '@/lib/auth';
import { handle } from '@/lib/handler';

export const DELETE = handle(async (req: NextRequest, ctx: { params: Promise<{ cid: string }> }) => {
  const { cid } = await ctx.params;
  const user = await requireRoles(req, 'Owner', 'Manager');
  await prisma.finance_categories.deleteMany({ where: { id: cid, tenant_id: user.tenant_id } });
  return { ok: true };
});
