import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { handle } from '@/lib/handler';

const DEFAULT_EXPENSE = ['Pembelian Bahan DTF', 'Pembelian ATK', 'Biaya Operasional', 'Jasa Pengambilan Online', 'Pembelian Lain-lain'];

export const GET = handle(async (req: NextRequest) => {
  const user = await getCurrentUser(req);
  const custom = await prisma.finance_categories.findMany({
    where: { tenant_id: user.tenant_id, type: 'expense' }, orderBy: { created_at: 'asc' },
  });
  const names = [...DEFAULT_EXPENSE];
  for (const c of custom) if (!names.includes(c.name)) names.push(c.name);
  return names;
});
