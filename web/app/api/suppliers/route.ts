import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser, requireRoles } from '@/lib/auth';
import { handle, readBody } from '@/lib/handler';
import { newId } from '@/lib/http';
import { supplierInputSchema } from '@/lib/schemas';
import { serializeSupplier } from '@/lib/serializers';

export const GET = handle(async (req: NextRequest) => {
  const user = await getCurrentUser(req);
  const rows = await prisma.suppliers.findMany({ where: { tenant_id: user.tenant_id }, orderBy: { created_at: 'desc' } });
  return rows.map(serializeSupplier);
});

export const POST = handle(async (req: NextRequest) => {
  const user = await requireRoles(req, 'Owner', 'Manager', 'Gudang');
  const data = supplierInputSchema.parse(await readBody(req));
  const s = await prisma.suppliers.create({
    data: {
      id: newId(), tenant_id: user.tenant_id, name: data.name,
      phone: data.phone || '', email: data.email || '', address: data.address || '',
      created_at: new Date(),
    },
  });
  return serializeSupplier(s);
});
