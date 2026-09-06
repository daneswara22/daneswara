import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRoles, logActivity } from '@/lib/auth';
import { handle, readBody } from '@/lib/handler';
import { HttpError, newId } from '@/lib/http';
import { parseDate, localToday } from '@/lib/business';
import { financeEntryInputSchema } from '@/lib/schemas';
import { serializeExpense } from '@/lib/serializers';

export const GET = handle(async (req: NextRequest) => {
  const user = await requireRoles(req, 'Owner', 'Manager');
  const url = new URL(req.url);
  const start = parseDate(url.searchParams.get('start'));
  const end = parseDate(url.searchParams.get('end'));
  const where: any = { tenant_id: user.tenant_id };
  if (start || end) where.date = {};
  if (start) where.date.gte = start;
  if (end) where.date.lte = end;
  const rows = await prisma.expenses.findMany({
    where, orderBy: [{ date: 'desc' }, { created_at: 'desc' }], take: 5000,
  });
  return (rows || []).map(serializeExpense);
});

export const POST = handle(async (req: NextRequest) => {
  const user = await requireRoles(req, 'Owner', 'Manager');
  const data = financeEntryInputSchema.parse(await readBody(req));
  if (data.amount <= 0) throw new HttpError(400, 'Nominal harus lebih dari 0');
  const d = parseDate(data.date) || parseDate(localToday())!;
  const row = await prisma.expenses.create({
    data: {
      id: newId(), tenant_id: user.tenant_id, category: data.category, amount: data.amount,
      note: data.note || '', date: d, user_name: user.name || '', created_at: new Date(),
    },
  });
  await logActivity(user.tenant_id, user, 'Tambah Pengeluaran', `${data.category} - ${data.amount}`);
  return serializeExpense(row);
});
