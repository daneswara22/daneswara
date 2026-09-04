import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { handle } from '@/lib/handler';

const DEFAULT_INCOME = ['Biaya layanan', 'Biaya express', 'Biaya tambahan/order khusus', 'Pendapatan komisi'];

export const GET = handle(async (req: NextRequest) => {
  const user = await getCurrentUser(req);
  const custom = await prisma.finance_categories.findMany({
    where: { tenant_id: user.tenant_id, type: 'income' }, orderBy: { created_at: 'asc' },
  });
  const names = [...DEFAULT_INCOME];
  for (const c of custom) if (!names.includes(c.name)) names.push(c.name);
  return names;
});
