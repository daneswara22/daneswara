import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser, requireRoles, logActivity } from '@/lib/auth';
import { handle, readBody } from '@/lib/handler';
import { HttpError, newId } from '@/lib/http';
import { parseDate, localToday } from '@/lib/business';
import { financeCategoryInputSchema, financeEntryInputSchema } from '@/lib/schemas';
import { serializeExpense, serializeOtherIncome, serializeFinanceCategory } from '@/lib/serializers';

const DEFAULT_EXPENSE = ['Pembelian Bahan DTF', 'Pembelian ATK', 'Biaya Operasional', 'Jasa Pengambilan Online', 'Pembelian Lain-lain'];
const DEFAULT_INCOME = ['Biaya layanan', 'Biaya express', 'Biaya tambahan/order khusus', 'Pendapatan komisi'];

async function customCats(tid: string, kind: string) {
  return await prisma.finance_categories.findMany({
    where: { tenant_id: tid, type: kind }, orderBy: { created_at: 'asc' },
  });
}

async function mergedNames(tid: string, kind: string): Promise<string[]> {
  const defaults = kind === 'expense' ? DEFAULT_EXPENSE : DEFAULT_INCOME;
  const custom = await customCats(tid, kind);
  const names = [...defaults];
  for (const c of custom) if (!names.includes(c.name)) names.push(c.name);
  return names;
}

export const GET = handle(async (req: NextRequest) => {
  const user = await requireRoles(req, 'Owner', 'Manager');
  const type = new URL(req.url).searchParams.get('type');
  if (type !== 'expense' && type !== 'income') throw new HttpError(400, 'Tipe tidak valid');
  const defaults = type === 'expense' ? DEFAULT_EXPENSE : DEFAULT_INCOME;
  const out: any[] = defaults.map((n) => ({ id: null, name: n, is_default: true }));
  const custom = await customCats(user.tenant_id, type);
  for (const c of custom) out.push({ id: c.id, name: c.name, is_default: false });
  return out;
});

export const POST = handle(async (req: NextRequest) => {
  const user = await requireRoles(req, 'Owner', 'Manager');
  const data = financeCategoryInputSchema.parse(await readBody(req));
  const name = data.name.trim();
  if (!name) throw new HttpError(400, 'Nama kategori wajib diisi');
  const existing = await mergedNames(user.tenant_id, data.type);
  if ((existing || []).some((n) => n.toLowerCase() === name.toLowerCase())) throw new HttpError(400, 'Kategori sudah ada');
  const c = await prisma.finance_categories.create({
    data: {
      id: newId(), tenant_id: user.tenant_id, type: data.type, name, created_at: new Date(),
    },
  });
  await logActivity(user.tenant_id, user, 'Tambah Kategori Keuangan', `${data.type}: ${name}`);
  return serializeFinanceCategory(c);
});
