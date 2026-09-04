import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { handle } from '@/lib/handler';

export const DELETE = handle(async (req: NextRequest, ctx: { params: Promise<{ hid: string }> }) => {
  const { hid } = await ctx.params;
  const user = await getCurrentUser(req);
  await prisma.held_orders.deleteMany({ where: { id: hid, tenant_id: user.tenant_id } });
  return { ok: true };
});
