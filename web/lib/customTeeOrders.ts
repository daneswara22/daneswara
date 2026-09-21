// Helpers for the Custom Tees order flow (draft -> submitted order).
// The order keeps the COMPLETE design payload (objects, positions, sizes,
// rotation, text, clipart, layer order, product, size, color, and the
// placement per shirt view) so admin can inspect the real submitted design.
import { prisma } from './db';
import { storage } from './storage';
import { HttpError } from './http';

export const CUSTOM_TEE_VIEWS = ['Depan', 'Belakang', 'Lengan Kiri', 'Lengan Kanan', 'Label'] as const;
export const CUSTOM_TEE_STATUSES = ['Draft', 'Baru', 'Diproses', 'Selesai', 'Dibatalkan'] as const;
export const NEW_STATUS = 'Baru';
export const DRAFT_STATUS = 'Draft';

export type DesignViews = Record<string, any[]>;

export function emptyDesignViews(): DesignViews {
  const out: DesignViews = {};
  for (const v of CUSTOM_TEE_VIEWS) out[v] = [];
  return out;
}

/** Count every design object across all shirt views. */
export function countObjects(views: DesignViews): number {
  return Object.values(views || {}).reduce(
    (n, arr) => n + (Array.isArray(arr) ? arr.length : 0),
    0,
  );
}

/**
 * Normalise a design payload: keeps every layer property untouched, but turns
 * inline `data:image/...` sources (customer uploads) into persistent WebP URLs
 * on R2 so the stored order still renders later.
 */
export async function normalizeDesignViews(raw: any): Promise<DesignViews> {
  const src = raw && typeof raw === 'object' ? raw : {};
  const out: DesignViews = emptyDesignViews();
  for (const key of Object.keys(src)) {
    const layers = Array.isArray(src[key]) ? src[key] : [];
    const normalized: any[] = [];
    for (const layer of layers) {
      if (!layer || typeof layer !== 'object') continue;
      const copy: any = { ...layer };
      if (typeof copy.src === 'string' && copy.src.startsWith('data:image')) {
        try {
          const url = await storage.normalizeImageField(copy.src, 'custom-tees');
          if (url) copy.src = url;
        } catch (e) {
          console.warn('[custom-tees] upload layer failed, keeping inline data', e);
        }
      }
      normalized.push(copy);
    }
    out[key] = normalized;
  }
  return out;
}

/** Single-tenant preview/public flow: resolve the tenant that owns the shop. */
export async function resolvePublicTenantId(): Promise<string> {
  const t = await prisma.tenants.findFirst({ orderBy: { created_at: 'asc' }, select: { id: true } });
  if (!t) throw new HttpError(500, 'Tenant belum tersedia');
  return t.id;
}

export async function nextOrderCode(tenantId: string): Promise<string> {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const prefix = `CT-${yy}${mm}${dd}-`;
  // Ambil nomor terakhir hari ini lalu naikkan; ulangi kalau ternyata sudah dipakai
  // (count() saja bisa bentrok setelah ada baris yang dihapus).
  const last = await prisma.custom_tee_orders.findFirst({
    where: { tenant_id: tenantId, order_code: { startsWith: prefix } },
    orderBy: { order_code: 'desc' },
    select: { order_code: true },
  });
  let seq = last ? (parseInt(last.order_code.slice(prefix.length), 10) || 0) : 0;
  for (let i = 0; i < 50; i += 1) {
    seq += 1;
    const code = `${prefix}${String(seq).padStart(4, '0')}`;
    const clash = await prisma.custom_tee_orders.findFirst({ where: { order_code: code }, select: { id: true } });
    if (!clash) return code;
  }
  return `${prefix}${Date.now().toString().slice(-5)}`;
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * One design can cover several shirt sizes: keep the per-size quantity list
 * plus a derived summary string and total pcs.
 */
export function normalizeSizeItems(items: any, fallbackSize: string, fallbackQty: number) {
  const list = (Array.isArray(items) ? items : [])
    .map((it) => ({ size: String(it?.size || '').trim(), qty: Math.max(1, Number(it?.qty) || 0) }))
    .filter((it) => it.size && it.qty > 0);
  if (list.length === 0) {
    const size = String(fallbackSize || '').split(',')[0].trim() || 'L';
    list.push({ size, qty: Math.max(1, Number(fallbackQty) || 1) });
  }
  return {
    items: list,
    label: list.map((it) => it.size).join(', ').slice(0, 120),
    total: list.reduce((a, it) => a + it.qty, 0),
  };
}
