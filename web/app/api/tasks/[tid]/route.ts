import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { handle, readBody } from '@/lib/handler';
import { HttpError, safeJson } from '@/lib/http';
import { ensureTaskSchema } from '@/lib/schemaGuard';
import { deadlineState, logTaskActivity, cleanManualItems, TASK_PRIORITIES, TASK_STATUSES } from '@/lib/tasks';

async function loadTask(tid: string, taskId: string) {
  const task = await prisma.order_tasks.findFirst({ where: { id: taskId, tenant_id: tid } });
  if (!task) throw new HttpError(404, 'Task tidak ditemukan');
  return task;
}

/**
 * GET /api/tasks/:tid
 * Detail lengkap satu task: project, customer, product, payment, delivery,
 * plus riwayat aktivitas ringan.
 */
export const GET = handle(async (req: NextRequest, ctx: any) => {
  const user = await getCurrentUser(req);
  await ensureTaskSchema();
  const tid = user.tenant_id;
  const taskId = (await ctx?.params)?.tid;
  const task = await loadTask(tid, taskId);

  const [order, activities] = await Promise.all([
    prisma.orders.findFirst({ where: { id: task.order_id, tenant_id: tid } }),
    prisma.order_task_activities.findMany({
      where: { task_id: task.id },
      orderBy: { created_at: 'desc' },
      take: 30,
    }),
  ]);

  const items = safeJson<any[]>(order?.items, []);
  const manualItems = safeJson<any[]>(task.items, []);
  const effectiveItems = manualItems.length ? manualItems : items;
  const customer = order?.customer_id
    ? await prisma.customers.findFirst({
        where: { id: order.customer_id, tenant_id: tid },
        select: { id: true, name: true, phone: true, address: true },
      })
    : null;

  return {
    id: task.id,
    task_number: task.task_number,
    project_name: task.project_name,
    description: task.description,
    is_manual: !task.order_id,
    created_by_name: task.created_by_name || null,
    priority: task.priority,
    status: task.status,
    assigned_user_id: task.assigned_user_id,
    assigned_at: task.assigned_at,
    deadline: task.deadline,
    release_reason: task.release_reason,
    completed_at: task.completed_at,
    created_at: task.created_at,
    deadline_state: deadlineState(task.deadline, task.status),
    order: order
      ? {
          id: order.id,
          order_number: order.order_number,
          order_date: order.order_date || order.created_at,
          status: order.status,
          note: order.note,
          total: order.total,
          deposit_amount: order.deposit_amount,
          remaining: order.remaining,
          payment_status: order.payment_status,
          payment_method: order.payment_method,
          shipping_carrier: order.shipping_carrier,
          shipping_address: order.shipping_address,
          tracking_number: order.tracking_number,
        }
      : null,
    customer: {
      name: order?.customer_name || customer?.name || null,
      phone: order?.customer_phone || customer?.phone || null,
      address: customer?.address || order?.shipping_address || null,
    },
    items: effectiveItems.map((i: any) => ({
      name: i.name,
      category: i.category || null,
      color: i.color || i.variation_name || null,
      material: i.material || null,
      qty: Number(i.qty) || 0,
      price: Number(i.price) || 0,
      size: i.size || null,
      note: i.note || null,
    })),
    activities: activities.map((a: any) => ({
      id: a.id,
      action: a.action,
      detail: a.detail,
      user_name: a.user_name,
      created_at: a.created_at,
    })),
  };
});

/**
 * PATCH /api/tasks/:tid
 * Satu endpoint untuk semua perubahan task. Body: { action, ... }.
 *
 * action:
 *   claim    — ambil task (atomic, hanya kalau masih AVAILABLE & tanpa PIC)
 *   release  — lepas task (alasan wajib), kembali ke AVAILABLE
 *   status   — ubah status
 *   assign   — admin mengalihkan PIC
 *   project  — ubah nama proyek (tidak menyentuh order asli)
 *   deadline — ubah deadline
 *   priority — ubah prioritas
 */
export const PATCH = handle(async (req: NextRequest, ctx: any) => {
  const user = await getCurrentUser(req);
  await ensureTaskSchema();
  const tid = user.tenant_id;
  const taskId = (await ctx?.params)?.tid;
  const body = await readBody(req);
  const action = String(body?.action || '').trim();
  const isAdmin = user.role === 'Owner' || user.role === 'Manager';
  const now = new Date();

  const task = await loadTask(tid, taskId);

  if (action === 'claim') {
    // Conditional update: hanya berhasil kalau task masih AVAILABLE dan belum
    // punya PIC. Ini yang mencegah dua user mengambil task yang sama.
    const res = await prisma.order_tasks.updateMany({
      where: { id: task.id, tenant_id: tid, status: 'AVAILABLE', assigned_user_id: null },
      data: { status: 'CLAIMED', assigned_user_id: user.id, assigned_at: now, updated_at: now },
    });
    if (res.count === 0) throw new HttpError(409, 'Task sudah diambil user lain');
    await logTaskActivity(tid, task.id, 'Task Claimed', user.id, user.name, null);
    return prisma.order_tasks.findUnique({ where: { id: task.id } });
  }

  if (action === 'release') {
    if (task.assigned_user_id !== user.id && !isAdmin) {
      throw new HttpError(403, 'Hanya PIC atau admin yang bisa melepas task');
    }
    const reason = String(body?.reason || '').trim();
    if (!reason) throw new HttpError(400, 'Alasan pelepasan wajib diisi');
    const updated = await prisma.order_tasks.update({
      where: { id: task.id },
      data: {
        status: 'AVAILABLE',
        assigned_user_id: null,
        assigned_at: null,
        release_reason: reason.slice(0, 300),
        updated_at: now,
      },
    });
    await logTaskActivity(tid, task.id, 'Task Released', user.id, user.name, reason);
    return updated;
  }

  if (action === 'status') {
    const status = String(body?.status || '').trim().toUpperCase();
    if (!TASK_STATUSES.includes(status as any)) throw new HttpError(400, 'Status tidak valid');
    if (task.assigned_user_id && task.assigned_user_id !== user.id && !isAdmin) {
      throw new HttpError(403, 'Hanya PIC atau admin yang bisa mengubah status');
    }
    const updated = await prisma.order_tasks.update({
      where: { id: task.id },
      data: {
        status,
        completed_at: status === 'COMPLETED' ? now : null,
        updated_at: now,
      },
    });
    await logTaskActivity(
      tid, task.id,
      status === 'COMPLETED' ? 'Task Completed' : 'Status Changed',
      user.id, user.name, `${task.status} → ${status}`,
    );
    return updated;
  }

  if (action === 'assign') {
    if (!isAdmin) throw new HttpError(403, 'Hanya admin yang bisa mengalihkan PIC');
    const targetId = String(body?.user_id || '').trim() || null;
    if (targetId) {
      const target = await prisma.users.findFirst({ where: { id: targetId, tenant_id: tid, active: true } });
      if (!target) throw new HttpError(400, 'User tujuan tidak ditemukan');
    }
    const updated = await prisma.order_tasks.update({
      where: { id: task.id },
      data: {
        assigned_user_id: targetId,
        assigned_at: targetId ? now : null,
        status: targetId ? (task.status === 'AVAILABLE' ? 'CLAIMED' : task.status) : 'AVAILABLE',
        updated_at: now,
      },
    });
    await logTaskActivity(tid, task.id, 'PIC Changed', user.id, user.name, targetId || 'dikosongkan');
    return updated;
  }

  if (action === 'project') {
    const name = String(body?.project_name || '').trim();
    const updated = await prisma.order_tasks.update({
      where: { id: task.id },
      data: { project_name: name ? name.slice(0, 200) : null, updated_at: now },
    });
    await logTaskActivity(tid, task.id, 'Project Renamed', user.id, user.name, name.slice(0, 200));
    return updated;
  }

  if (action === 'deadline') {
    const raw = body?.deadline;
    const deadline = raw ? new Date(raw) : null;
    if (deadline && Number.isNaN(deadline.getTime())) throw new HttpError(400, 'Tanggal deadline tidak valid');
    const updated = await prisma.order_tasks.update({
      where: { id: task.id },
      data: { deadline, updated_at: now },
    });
    await logTaskActivity(tid, task.id, 'Deadline Changed', user.id, user.name, deadline ? deadline.toISOString() : 'dikosongkan');
    return updated;
  }

  if (action === 'priority') {
    const priority = String(body?.priority || '').trim();
    if (!TASK_PRIORITIES.includes(priority as any)) throw new HttpError(400, 'Prioritas tidak valid');
    const updated = await prisma.order_tasks.update({
      where: { id: task.id },
      data: { priority, updated_at: now },
    });
    await logTaskActivity(tid, task.id, 'Priority Changed', user.id, user.name, priority);
    return updated;
  }

  if (action === 'description') {
    const desc = String(body?.description || '').trim();
    const updated = await prisma.order_tasks.update({
      where: { id: task.id },
      data: { description: desc ? desc.slice(0, 5000) : null, updated_at: now },
    });
    await logTaskActivity(tid, task.id, 'Description Changed', user.id, user.name, null);
    return updated;
  }

  if (action === 'items') {
    // Hanya task manual yang boleh mengubah item; task dari order mengikuti order.
    if (task.order_id) throw new HttpError(400, 'Item task dari pesanan tidak bisa diubah di sini');
    const items = cleanManualItems(body?.items);
    if (items.length === 0) throw new HttpError(400, 'Tambahkan minimal 1 produk');
    const updated = await prisma.order_tasks.update({
      where: { id: task.id },
      data: { items: JSON.stringify(items), updated_at: now },
    });
    await logTaskActivity(tid, task.id, 'Items Changed', user.id, user.name, `${items.length} item`);
    return updated;
  }

  throw new HttpError(400, 'Aksi tidak dikenal');
});
