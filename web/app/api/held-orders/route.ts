import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { handle, readBody } from '@/lib/handler';
import { newId } from '@/lib/http';
import { heldOrderInputSchema } from '@/lib/schemas';
import { serializeHeldOrder } from '@/lib/serializers';

export const GET = handle(async (req: NextRequest) => {
  const user = await getCurrentUser(req);
  const rows = await prisma.held_orders.findMany({
    where: { tenant_id: user.tenant_id },
    orderBy: { created_at: 'desc' },
    take: 200,
  });
  return rows.map(serializeHeldOrder);
});

export const POST = handle(async (req: NextRequest) => {
  const user = await getCurrentUser(req);
  const data = heldOrderInputSchema.parse(await readBody(req));
  const h = await prisma.held_orders.create({
    data: {
      id: newId(), tenant_id: user.tenant_id, label: data.label,
      items: JSON.stringify(data.items), discount: data.discount,
      cashier: user.name || '', created_at: new Date(),
    },
  });
  return serializeHeldOrder(h);
});
