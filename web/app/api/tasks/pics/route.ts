import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { handle } from '@/lib/handler';

/**
 * GET /api/tasks/pics
 * Daftar user aktif untuk dropdown filter PIC dan dialog alihkan tugas.
 * Hanya id, nama, dan role — tidak ada data sensitif.
 */
export const GET = handle(async (req: NextRequest) => {
  const user = await getCurrentUser(req);
  const rows = await prisma.users.findMany({
    where: { tenant_id: user.tenant_id, active: true },
    select: { id: true, name: true, username: true, role: true },
    orderBy: { name: 'asc' },
  });
  return rows;
});
