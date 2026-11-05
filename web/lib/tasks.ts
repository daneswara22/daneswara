/**
 * Task To Do — helper bersama untuk pembuatan task otomatis dan pencatatan
 * aktivitas ringan.
 *
 * Prinsip:
 *  - Satu order = satu task. Dijaga oleh UNIQUE INDEX `uq_order_tasks_order`
 *    sehingga percobaan ganda tidak mungkin menghasilkan dua baris.
 *  - Tidak menyalin data pelanggan/produk/transaksi. Task hanya menyimpan
 *    `order_id`; sisanya dibaca dari tabel `orders` saat ditampilkan.
 *  - Pembuatan task tidak boleh menggagalkan penyimpanan order. Semua error
 *    ditelan dan dicatat ke console.
 */
import { prisma } from './db';
import { newId } from './http';
import { ensureTaskSchema } from './schemaGuard';

export const TASK_STATUSES = ['AVAILABLE', 'CLAIMED', 'IN PROGRESS', 'COMPLETED', 'ON HOLD'] as const;
export const TASK_PRIORITIES = ['Normal', 'High', 'Urgent'] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

/** Nomor task berurutan per tenant: TSK-000001. */
async function nextTaskNumber(tenantId: string): Promise<string> {
  const n = await prisma.order_tasks.count({ where: { tenant_id: tenantId } });
  return `TSK-${String(n + 1).padStart(6, '0')}`;
}

export type ManualItem = { name: string; qty: number; price: number; note?: string };

/** Bersihkan item manual: nama wajib, qty & harga angka >= 0. */
export function cleanManualItems(raw: any): ManualItem[] {
  const list = Array.isArray(raw) ? raw : [];
  return list
    .map((i: any) => ({
      name: String(i?.name || '').trim().slice(0, 200),
      qty: Math.max(0, Math.floor(Number(i?.qty) || 0)),
      price: Math.max(0, Math.floor(Number(i?.price) || 0)),
      note: i?.note ? String(i.note).trim().slice(0, 300) : undefined,
    }))
    .filter((i) => i.name);
}

/**
 * Buat task manual (tanpa order). Dipakai tombol "Tambah Task" di menu Task To Do.
 * order_id dibiarkan null; item disimpan sebagai JSON di kolom `items`.
 */
export async function createManualTask(
  tenantId: string,
  input: {
    projectName?: string | null;
    description?: string | null;
    items?: any;
    priority?: TaskPriority;
    deadline?: Date | null;
    assignedUserId?: string | null;
  },
) {
  await ensureTaskSchema();
  const now = new Date();
  const items = cleanManualItems(input.items);
  const assigned = input.assignedUserId || null;
  const task = await prisma.order_tasks.create({
    data: {
      id: newId(),
      tenant_id: tenantId,
      order_id: null,
      task_number: await nextTaskNumber(tenantId),
      project_name: input.projectName ? String(input.projectName).slice(0, 200) : null,
      description: input.description ? String(input.description).slice(0, 5000) : null,
      items: items.length ? JSON.stringify(items) : null,
      priority: input.priority || 'Normal',
      status: assigned ? 'CLAIMED' : 'AVAILABLE',
      assigned_user_id: assigned,
      assigned_at: assigned ? now : null,
      deadline: input.deadline || null,
      created_at: now,
      updated_at: now,
    },
  });
  await logTaskActivity(tenantId, task.id, 'Task Created', null, null, 'manual');
  return task;
}

/**
 * Buat task untuk sebuah order. Idempoten: kalau task untuk order itu sudah
 * ada, kembalikan yang lama tanpa membuat baris baru.
 *
 * @returns task yang dibuat/ditemukan, atau null kalau gagal (order tetap aman).
 */
export async function createTaskForOrder(
  tenantId: string,
  orderId: string,
  opts: { projectName?: string | null; deadline?: Date | null; priority?: TaskPriority } = {},
) {
  try {
    await ensureTaskSchema();

    const existing = await prisma.order_tasks.findUnique({ where: { order_id: orderId } });
    if (existing) return existing;

    const now = new Date();
    const task = await prisma.order_tasks.create({
      data: {
        id: newId(),
        tenant_id: tenantId,
        order_id: orderId,
        task_number: await nextTaskNumber(tenantId),
        project_name: opts.projectName || null,
        priority: opts.priority || 'Normal',
        status: 'AVAILABLE',
        deadline: opts.deadline || null,
        created_at: now,
        updated_at: now,
      },
    });

    await logTaskActivity(tenantId, task.id, 'Task Created', null, null);
    return task;
  } catch (e: any) {
    // Unique constraint = task sudah dibuat oleh request lain. Bukan error.
    if (e?.code === 'P2002') {
      return prisma.order_tasks.findUnique({ where: { order_id: orderId } }).catch(() => null);
    }
    console.error('[task] gagal membuat task untuk order', orderId, e?.message);
    return null;
  }
}

/** Catat satu baris aktivitas. Kegagalan tidak boleh mengganggu alur utama. */
export async function logTaskActivity(
  tenantId: string,
  taskId: string,
  action: string,
  userId?: string | null,
  userName?: string | null,
  detail?: string | null,
) {
  try {
    await prisma.order_task_activities.create({
      data: {
        id: newId(),
        tenant_id: tenantId,
        task_id: taskId,
        action,
        detail: detail ? String(detail).slice(0, 300) : null,
        user_id: userId || null,
        user_name: userName || null,
        created_at: new Date(),
      },
    });
  } catch (e: any) {
    console.error('[task] gagal mencatat aktivitas', action, e?.message);
  }
}

/** Deadline dianggap "mendekat" kalau <= 2 hari lagi dan belum lewat. */
export const DEADLINE_SOON_MS = 2 * 24 * 60 * 60 * 1000;

export function deadlineState(deadline: Date | string | null | undefined, status: string) {
  if (!deadline || status === 'COMPLETED') return 'none' as const;
  const t = new Date(deadline).getTime();
  const now = Date.now();
  if (t < now) return 'overdue' as const;
  if (t - now <= DEADLINE_SOON_MS) return 'soon' as const;
  return 'ok' as const;
}
