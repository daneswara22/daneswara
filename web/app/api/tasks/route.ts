import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { handle, readBody } from '@/lib/handler';
import { HttpError } from '@/lib/http';
import { ensureTaskSchema } from '@/lib/schemaGuard';
import { cleanManualItems, createManualTask, deadlineState, TASK_PRIORITIES } from '@/lib/tasks';
import { safeJson } from '@/lib/http';

/**
 * GET /api/tasks
 * Daftar task dengan filter, pencarian, sorting, dan pagination.
 *
 * Data pelanggan/produk/pembayaran TIDAK disalin ke tabel task — diambil dari
 * `orders` lewat relasi order_id pada query yang sama (satu round-trip).
 */
export const GET = handle(async (req: NextRequest) => {
  const user = await getCurrentUser(req);
  await ensureTaskSchema();
  const tid = user.tenant_id;
  const url = new URL(req.url);
  const p = (k: string) => (url.searchParams.get(k) || '').trim();

  const tab = p('tab') || 'all'; // all | available | mine | completed
  const q = p('q');
  const status = p('status');
  const priority = p('priority');
  const pic = p('pic');
  const deadline = p('deadline'); // overdue | soon | none
  const sort = p('sort') || 'created_at';
  const dir = p('dir') === 'asc' ? 'asc' : 'desc';
  const page = Math.max(1, Number(p('page')) || 1);
  const perPage = Math.min(100, Math.max(5, Number(p('per_page')) || 20));

  const where: any = { tenant_id: tid };

  if (tab === 'available') where.status = 'AVAILABLE';
  else if (tab === 'mine') where.assigned_user_id = user.id;
  else if (tab === 'completed') where.status = 'COMPLETED';

  if (status && status !== 'all') where.status = status;
  if (priority && priority !== 'all') where.priority = priority;
  if (pic === 'me') where.assigned_user_id = user.id;
  else if (pic === 'unassigned') where.assigned_user_id = null;
  else if (pic && pic !== 'all') where.assigned_user_id = pic;

  const now = new Date();
  const soon = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
  if (deadline === 'overdue') where.deadline = { lt: now };
  else if (deadline === 'soon') where.deadline = { gte: now, lte: soon };
  else if (deadline === 'none') where.deadline = null;

  // Pencarian menyentuh task_number/project_name dan kolom order (order_number,
  // customer_name). Dibatasi ke tenant lewat relasi.
  if (q) {
    where.OR = [
      { task_number: { contains: q } },
      { project_name: { contains: q } },
      { order: { order_number: { contains: q } } },
      { order: { customer_name: { contains: q } } },
    ];
  }

  const orderBy: any =
    sort === 'deadline' ? { deadline: dir }
    : sort === 'priority' ? { priority: dir }
    : sort === 'status' ? { status: dir }
    : sort === 'task_number' ? { task_number: dir }
    : { created_at: dir };

  const [rows, total] = await Promise.all([
    prisma.order_tasks.findMany({
      where,
      orderBy,
      skip: (page - 1) * perPage,
      take: perPage,
      include: {
        order: {
          select: {
            id: true,
            order_number: true,
            customer_name: true,
            customer_phone: true,
            items: true,
            total: true,
            deposit_amount: true,
            remaining: true,
            payment_status: true,
            status: true,
            order_date: true,
            created_at: true,
            shipping_carrier: true,
            shipping_address: true,
            tracking_number: true,
            note: true,
          },
        },
      },
    }),
    prisma.order_tasks.count({ where }),
  ]);

  const items = rows.map((t: any) => {
    const o = t.order || {};
    const orderItems = safeJson<any[]>(o.items, []);
    // Task manual menyimpan item sendiri; task dari order membaca dari order.
    const manualItems = safeJson<any[]>(t.items, []);
    const effectiveItems = manualItems.length ? manualItems : orderItems;
    return {
      id: t.id,
      task_number: t.task_number,
      project_name: t.project_name,
      description: t.description,
      is_manual: !t.order_id,
      created_by_name: t.created_by_name || null,
      priority: t.priority,
      status: t.status,
      assigned_user_id: t.assigned_user_id,
      assigned_at: t.assigned_at,
      deadline: t.deadline,
      release_reason: t.release_reason,
      completed_at: t.completed_at,
      created_at: t.created_at,
      deadline_state: deadlineState(t.deadline, t.status),
      order: t.order_id
        ? {
            id: o.id,
            order_number: o.order_number,
            customer_name: o.customer_name,
            customer_phone: o.customer_phone,
            order_date: o.order_date || o.created_at,
            total: o.total,
            deposit_amount: o.deposit_amount,
            remaining: o.remaining,
            payment_status: o.payment_status,
            status: o.status,
            shipping_carrier: o.shipping_carrier,
            shipping_address: o.shipping_address,
            tracking_number: o.tracking_number,
            note: o.note,
          }
        : null,
      // Ringkasan produk untuk kolom tabel; detail lengkap ada di endpoint detail.
      product_summary: effectiveItems.slice(0, 2).map((i: any) => i.name).join(', '),
      product_extra: Math.max(0, effectiveItems.length - 2),
      quantity: effectiveItems.reduce((s: number, i: any) => s + (Number(i.qty) || 0), 0),
    };
  });

  return { items, total, page, per_page: perPage, pages: Math.max(1, Math.ceil(total / perPage)) };
});

/**
 * POST /api/tasks
 * Buat task manual (tanpa order). Item diketik bebas oleh user.
 */
export const POST = handle(async (req: NextRequest) => {
  const user = await getCurrentUser(req);
  await ensureTaskSchema();
  const body = await readBody(req);

  const projectName = String(body?.project_name || '').trim();
  if (!projectName) throw new HttpError(400, 'Nama proyek wajib diisi');

  const priority = String(body?.priority || 'Normal').trim();
  if (!TASK_PRIORITIES.includes(priority as any)) throw new HttpError(400, 'Prioritas tidak valid');

  const items = cleanManualItems(body?.items);
  if (items.length === 0) throw new HttpError(400, 'Tambahkan minimal 1 produk');

  let deadline: Date | null = null;
  if (body?.deadline) {
    deadline = new Date(body.deadline);
    if (Number.isNaN(deadline.getTime())) throw new HttpError(400, 'Tanggal deadline tidak valid');
  }

  const task = await createManualTask(user.tenant_id, {
    projectName,
    description: body?.description || null,
    items,
    priority: priority as any,
    deadline,
    assignedUserId: body?.assigned_user_id || null,
    createdById: user.id,
    createdByName: user.name || user.username,
  });

  return task;
});
