import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { handle } from '@/lib/handler';
import { ensureTaskSchema } from '@/lib/schemaGuard';

/**
 * GET /api/tasks/summary
 * Ringkasan angka untuk dashboard Task To Do. Semua dihitung langsung dari
 * database (bukan angka tersimpan) supaya tidak ada data turunan yang basi.
 */
export const GET = handle(async (req: NextRequest) => {
  const user = await getCurrentUser(req);
  await ensureTaskSchema();
  const tid = user.tenant_id;
  const now = new Date();

  const [active, available, mine, completed, overdue] = await Promise.all([
    prisma.order_tasks.count({ where: { tenant_id: tid, status: { not: 'COMPLETED' } } }),
    prisma.order_tasks.count({ where: { tenant_id: tid, status: 'AVAILABLE' } }),
    prisma.order_tasks.count({ where: { tenant_id: tid, assigned_user_id: user.id, status: { not: 'COMPLETED' } } }),
    prisma.order_tasks.count({ where: { tenant_id: tid, status: 'COMPLETED' } }),
    prisma.order_tasks.count({
      where: { tenant_id: tid, status: { not: 'COMPLETED' }, deadline: { lt: now } },
    }),
  ]);

  return { active, available, mine, completed, overdue };
});
