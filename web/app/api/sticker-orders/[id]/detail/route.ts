import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRoles } from '@/lib/auth';
import { handle } from '@/lib/handler';
import { HttpError } from '@/lib/http';
import { serializeStickerOrder as ser } from '@/lib/stickerSerialize';

export const dynamic = 'force-dynamic';

/** Detail pesanan Custom Sticker termasuk preview kanvas yang disimpan. */
export const GET = handle(async (req: NextRequest, ctx: any) => {
  const user = await requireRoles(req, 'Owner', 'Manager', 'Kasir');
  const { id } = await ctx.params;
  const row = await prisma.sticker_orders.findFirst({ where: { id, tenant_id: user.tenant_id } });
  if (!row) throw new HttpError(404, 'Pesanan tidak ditemukan');
  return ser(row, true);
});
