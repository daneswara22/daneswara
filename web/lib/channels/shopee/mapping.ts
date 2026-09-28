// Pemetaan produk marketplace -> produk internal.
// Aturan penting: produk yang belum dipetakan TIDAK menolak pesanan.
// Pesanan tetap masuk, produknya ditandai UNMAPPED agar admin bisa memetakan.
import { prisma } from '../../db';
import { newId } from '../../http';

export interface ExternalItem {
  externalProductId: string;
  externalVariationId: string;
  sku: string;
  name: string;
  variationName: string;
}

export interface MappingResult {
  id: string;
  internal_product_id: string | null;
  custom_product_key: string | null;
  is_custom: boolean;
  mapping_status: string;
}

const CUSTOM_HINT = /(custom|desain sendiri|design sendiri|sablon custom|custom tee)/i;

/**
 * Cari padanan otomatis: pertama lewat SKU produk internal (paling akurat),
 * lalu lewat nama jenis produk Custom Tees. Kalau tidak ketemu -> UNMAPPED.
 */
async function autoMatch(tenantId: string, item: ExternalItem) {
  const sku = (item.sku || '').trim();
  if (sku) {
    const p = await prisma.products.findFirst({ where: { tenant_id: tenantId, sku }, select: { id: true } });
    if (p) return { internal_product_id: p.id, custom_product_key: null as string | null, is_custom: false };
  }
  const name = (item.name || '').trim();
  if (name) {
    const p = await prisma.products.findFirst({ where: { tenant_id: tenantId, name }, select: { id: true } });
    if (p) return { internal_product_id: p.id, custom_product_key: null as string | null, is_custom: false };
  }
  // Jenis produk Custom Tees (kaos/hoodie custom) -> alur Custom Tees yang ada.
  const customs = await prisma.custom_products.findMany({
    where: { tenant_id: tenantId, is_active: true, deleted_at: null },
    select: { product_key: true, title: true },
  });
  const haystack = `${item.name} ${item.variationName} ${item.sku}`.toLowerCase();
  for (const c of customs) {
    const title = (c.title || '').toLowerCase().trim();
    if (title && title.length > 3 && haystack.includes(title)) {
      return { internal_product_id: null, custom_product_key: c.product_key, is_custom: true };
    }
  }
  if (CUSTOM_HINT.test(haystack) && customs.length > 0) {
    return { internal_product_id: null, custom_product_key: customs[0].product_key, is_custom: true };
  }
  return { internal_product_id: null, custom_product_key: null as string | null, is_custom: false };
}

/** Catat/perbarui produk marketplace yang terlihat pada pesanan. */
export async function upsertChannelProduct(
  tenantId: string,
  channelId: string,
  item: ExternalItem,
): Promise<MappingResult> {
  const now = new Date();
  const key = {
    sales_channel_id: channelId,
    external_product_id: String(item.externalProductId || '0'),
    external_variation_id: String(item.externalVariationId || '0'),
  };
  const existing = await prisma.channel_products.findFirst({ where: key });
  if (existing) {
    const patch: Record<string, any> = { last_seen_at: now, updated_at: now };
    if (item.sku && item.sku !== existing.external_sku) patch.external_sku = item.sku;
    if (item.name && item.name !== existing.external_name) patch.external_name = item.name;
    if (item.variationName !== existing.external_variation) patch.external_variation = item.variationName;
    // Kalau masih UNMAPPED, coba cocokkan lagi (mis. admin baru tambah produk).
    if (existing.mapping_status === 'UNMAPPED') {
      const auto = await autoMatch(tenantId, item);
      if (auto.internal_product_id || auto.custom_product_key) {
        patch.internal_product_id = auto.internal_product_id;
        patch.custom_product_key = auto.custom_product_key;
        patch.is_custom = auto.is_custom;
        patch.mapping_status = 'MAPPED';
      }
    }
    const row = await prisma.channel_products.update({ where: { id: existing.id }, data: patch });
    return {
      id: row.id,
      internal_product_id: row.internal_product_id,
      custom_product_key: row.custom_product_key,
      is_custom: row.is_custom,
      mapping_status: row.mapping_status,
    };
  }
  const auto = await autoMatch(tenantId, item);
  const mapped = auto.internal_product_id || auto.custom_product_key ? 'MAPPED' : 'UNMAPPED';
  const row = await prisma.channel_products.create({
    data: {
      id: newId(),
      tenant_id: tenantId,
      sales_channel_id: channelId,
      external_product_id: key.external_product_id,
      external_variation_id: key.external_variation_id,
      external_sku: item.sku || null,
      external_name: item.name || null,
      external_variation: item.variationName || null,
      internal_product_id: auto.internal_product_id,
      custom_product_key: auto.custom_product_key,
      is_custom: auto.is_custom,
      mapping_status: mapped,
      last_seen_at: now,
      created_at: now,
      updated_at: now,
    },
  });
  return {
    id: row.id,
    internal_product_id: row.internal_product_id,
    custom_product_key: row.custom_product_key,
    is_custom: row.is_custom,
    mapping_status: row.mapping_status,
  };
}
