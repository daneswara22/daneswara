// Sinkronisasi pesanan Shopee -> sistem pesanan yang SUDAH ADA (tabel `orders`).
// Prinsip:
//  - idempoten: kunci unik (tenant_id, sales_channel, external_order_id)
//  - tidak pernah menghapus pesanan kalau API gagal
//  - inkremental: memakai update_time + jendela maksimal 15 hari
//  - produk custom tetap masuk alur Custom Tees yang lama
import { prisma } from '../../db';
import { newId } from '../../http';
import { getCreds, getChannel, saveTokens, updateChannel } from '../store';
import {
  ShopeeConfig,
  ShopeeError,
  getOrderDetail,
  getOrderList,
  refreshAccessToken,
  shopeeEnvironment,
} from './client';
import { legacyStatus, mapPaymentStatus, mapShippingStatus, mapShopeeStatus } from './status';
import { upsertChannelProduct } from './mapping';
import { NEW_STATUS, emptyDesignViews } from '../../customTeeOrders';

export interface SyncCounters {
  orders_checked: number;
  orders_created: number;
  orders_updated: number;
  orders_skipped: number;
  errors_count: number;
}

export interface SyncOutcome extends SyncCounters {
  status: 'success' | 'partial' | 'failed';
  message: string;
  log_id: string;
}

const WINDOW = 15 * 24 * 3600; // batas Shopee per permintaan (detik)

/** Konfigurasi + access token yang pasti masih valid (auto refresh). */
export async function shopeeContext(tenantId: string) {
  const channel = await getChannel(tenantId, 'shopee');
  if (!channel) throw new ShopeeError('Kanal Shopee belum dibuat', 'not_configured', 400);
  const creds = await getCreds(channel.id);
  if (!creds.partnerId || !creds.partnerKey) {
    throw new ShopeeError('Partner ID / Partner Key Shopee belum diisi', 'no_partner', 400);
  }
  const cfg: ShopeeConfig = {
    partnerId: creds.partnerId,
    partnerKey: creds.partnerKey,
    environment: shopeeEnvironment(channel.environment),
  };
  if (!channel.external_shop_id || !creds.accessToken) {
    throw new ShopeeError('Toko Shopee belum terhubung. Klik "Hubungkan Akun Shopee".', 'not_connected', 400);
  }
  let accessToken = creds.accessToken;
  const expiresAt = creds.expiresAt ? new Date(creds.expiresAt).getTime() : 0;
  if (!expiresAt || expiresAt - Date.now() < 10 * 60 * 1000) {
    if (!creds.refreshToken) throw new ShopeeError('Refresh token tidak ada, hubungkan ulang Shopee', 'no_refresh', 400);
    const next = await refreshAccessToken(cfg, creds.refreshToken, channel.external_shop_id);
    await saveTokens(channel.id, next);
    accessToken = next.accessToken;
  }
  return { channel, cfg, accessToken, shopId: channel.external_shop_id };
}

function num(v: any): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function itemsFromDetail(detail: any) {
  const list = Array.isArray(detail?.item_list) ? detail.item_list : [];
  return list.map((it: any) => {
    const qty = Math.max(1, num(it?.model_quantity_purchased) || num(it?.quantity_purchased) || 1);
    const price = num(it?.model_discounted_price) || num(it?.model_original_price) || 0;
    const original = num(it?.model_original_price) || price;
    return {
      raw: it,
      external_item_id: String(it?.item_id ?? ''),
      external_product_id: String(it?.item_id ?? '0'),
      external_variation_id: String(it?.model_id ?? '0'),
      name: String(it?.item_name || 'Produk Shopee'),
      sku: String(it?.item_sku || it?.model_sku || ''),
      variation_name: String(it?.model_name || ''),
      qty,
      price,
      discount: Math.max(0, (original - price) * qty),
    };
  });
}

async function ensureCustomTeeOrder(tenantId: string, order: any, detail: any, item: any, productKey: string) {
  const existing = await prisma.custom_tee_orders.findFirst({
    where: { tenant_id: tenantId, sales_channel: 'shopee', external_order_id: order.external_order_id },
  });
  const now = new Date();
  const sizeItems = [{ size: item.variation_name || 'L', qty: item.qty }];
  const base = {
    status: NEW_STATUS,
    customer_name: order.customer_name || 'Pembeli Shopee',
    customer_phone: order.customer_phone || '',
    product_key: productKey,
    product_title: item.name,
    size: (item.variation_name || 'L').slice(0, 120),
    size_items_json: JSON.stringify(sizeItems),
    qty: item.qty,
    color_name: '',
    color_hex: '',
    objects_count: 0,
    note: `Pesanan Shopee ${order.external_order_id} — desain menyusul dari pembeli.`,
    source_order_id: order.id,
    updated_at: now,
  };
  if (existing) {
    // Jangan menimpa desain / status yang sudah dikerjakan admin.
    await prisma.custom_tee_orders.update({
      where: { id: existing.id },
      data: { source_order_id: order.id, qty: item.qty, updated_at: now },
    });
    return existing.id;
  }
  const created = await prisma.custom_tee_orders.create({
    data: {
      id: newId(),
      tenant_id: tenantId,
      order_code: `SHP-${order.external_order_id}`.slice(0, 40),
      sales_channel: 'shopee',
      external_order_id: order.external_order_id,
      design_json: JSON.stringify(emptyDesignViews()),
      submitted_at: detail?.create_time ? new Date(num(detail.create_time) * 1000) : now,
      created_at: now,
      ...base,
    },
  });
  return created.id;
}

/** Simpan satu order Shopee (create/update) — idempoten. */
export async function upsertShopeeOrder(tenantId: string, channel: any, detail: any) {
  const orderSn = String(detail?.order_sn || '');
  if (!orderSn) return { action: 'skipped' as const };

  const rawItems = itemsFromDetail(detail);
  const items: any[] = [];
  let hasCustom = false;
  const customTargets: Array<{ item: any; productKey: string }> = [];
  for (const it of rawItems) {
    const mapping = await upsertChannelProduct(tenantId, channel.id, {
      externalProductId: it.external_product_id,
      externalVariationId: it.external_variation_id,
      sku: it.sku,
      name: it.name,
      variationName: it.variation_name,
    });
    if (mapping.is_custom && mapping.custom_product_key) {
      hasCustom = true;
      customTargets.push({ item: it, productKey: mapping.custom_product_key });
    }
    items.push({
      product_id: mapping.internal_product_id || null,
      name: it.name,
      price: it.price,
      qty: it.qty,
      cost: 0,
      discount: it.discount,
      note: it.variation_name ? `Varian: ${it.variation_name}` : '',
      sku: it.sku,
      variation_name: it.variation_name,
      external_item_id: it.external_item_id,
      external_product_id: it.external_product_id,
      external_variation_id: it.external_variation_id,
      mapping_status: mapping.mapping_status,
      is_custom: mapping.is_custom,
    });
  }

  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  const shippingFee = num(detail?.actual_shipping_fee) || num(detail?.estimated_shipping_fee);
  const total = num(detail?.total_amount) || subtotal + shippingFee;
  const discount = Math.max(0, subtotal + shippingFee - total);
  const internal = mapShopeeStatus(detail?.order_status);
  const payment = mapPaymentStatus(detail?.order_status);
  const addr = detail?.recipient_address || {};
  const pkg = Array.isArray(detail?.package_list) ? detail.package_list[0] : null;
  const paid = payment === 'PAID' ? total : 0;
  const now = new Date();

  const data: Record<string, any> = {
    customer_name: String(addr?.name || detail?.buyer_username || 'Pembeli Shopee').slice(0, 190),
    items: JSON.stringify(items),
    subtotal,
    discount,
    tax_rate: 0,
    tax: 0,
    total,
    deposit_amount: paid,
    deposit_method: payment === 'PAID' ? String(detail?.payment_method || 'Shopee') : null,
    remaining: Math.max(0, total - paid),
    note: String(detail?.note || ''),
    order_type: hasCustom ? 'Custom' : 'Reguler',
    channel: 'Shopee',
    status: legacyStatus(internal),
    payment_method: String(detail?.payment_method || 'Shopee').slice(0, 40),
    sales_channel: 'shopee',
    sales_channel_id: channel.id,
    external_order_id: orderSn,
    external_status: String(detail?.order_status || '').slice(0, 40),
    external_shop_id: channel.external_shop_id || null,
    internal_status: internal,
    payment_status: payment,
    shipping_status: mapShippingStatus(detail),
    customer_phone: String(addr?.phone || '').slice(0, 40),
    shipping_address: String(addr?.full_address || ''),
    shipping_city: String(addr?.city || addr?.district || '').slice(0, 120),
    shipping_province: String(addr?.state || '').slice(0, 120),
    shipping_postal: String(addr?.zipcode || '').slice(0, 20),
    shipping_fee: shippingFee,
    shipping_carrier: String(detail?.shipping_carrier || '').slice(0, 120),
    tracking_number: String(pkg?.package_number || detail?.tracking_number || '').slice(0, 80),
    customer_note: String(detail?.note || ''),
    order_date: detail?.create_time ? new Date(num(detail.create_time) * 1000) : now,
    completed_at: internal === 'COMPLETED' ? new Date(num(detail?.update_time) * 1000 || Date.now()) : null,
    synced_at: now,
    updated_at: now,
    external_raw: JSON.stringify(detail).slice(0, 4_000_000),
  };

  const existing = await prisma.orders.findFirst({
    where: { tenant_id: tenantId, sales_channel: 'shopee', external_order_id: orderSn },
  });

  let order: any;
  let action: 'created' | 'updated' = 'updated';
  if (existing) {
    order = await prisma.orders.update({ where: { id: existing.id }, data });
  } else {
    order = await prisma.orders.create({
      data: {
        id: newId(),
        tenant_id: tenantId,
        order_number: `SHP-${orderSn}`.slice(0, 40),
        customer_id: null,
        cashier: 'Shopee',
        invoice: null,
        settle_paid: null,
        created_at: data.order_date || now,
        ...data,
      } as any,
    });
    action = 'created';
  }

  for (const target of customTargets) {
    await ensureCustomTeeOrder(tenantId, order, detail, target.item, target.productKey);
  }

  return { action, order };
}

/**
 * Jalankan sinkronisasi. `days` = mundur berapa hari (default 7).
 * `orderSns` = sinkron pesanan tertentu saja (dipakai webhook).
 */
export async function runShopeeSync(options: {
  tenantId: string;
  syncType?: 'manual' | 'cron' | 'webhook' | 'backfill';
  days?: number;
  orderSns?: string[];
}): Promise<SyncOutcome> {
  const tenantId = options.tenantId;
  const syncType = options.syncType || 'manual';
  const started = new Date();
  const counters: SyncCounters = {
    orders_checked: 0,
    orders_created: 0,
    orders_updated: 0,
    orders_skipped: 0,
    errors_count: 0,
  };
  const errors: string[] = [];
  let channelId = '';
  let apiStatus = 'ok';

  try {
    const known = await getChannel(tenantId, 'shopee');
    if (known) channelId = known.id;
    const ctx = await shopeeContext(tenantId);
    channelId = ctx.channel.id;
    let orderSns = options.orderSns || [];
    if (orderSns.length === 0) {
      const days = Math.min(120, Math.max(1, Number(options.days) || 7));
      const to = Math.floor(Date.now() / 1000);
      const from = to - days * 24 * 3600;
      for (let start = from; start < to; start += WINDOW) {
        const end = Math.min(to, start + WINDOW - 1);
        const list = await getOrderList(ctx.cfg, ctx.accessToken, ctx.shopId, {
          timeFrom: start,
          timeTo: end,
          timeRangeField: 'update_time',
        });
        orderSns.push(...list.map((o: any) => String(o?.order_sn)).filter(Boolean));
      }
      orderSns = Array.from(new Set(orderSns));
    }
    counters.orders_checked = orderSns.length;

    if (orderSns.length > 0) {
      const details = await getOrderDetail(ctx.cfg, ctx.accessToken, ctx.shopId, orderSns);
      for (const detail of details) {
        try {
          const res = await upsertShopeeOrder(tenantId, ctx.channel, detail);
          if (res.action === 'created') counters.orders_created += 1;
          else if (res.action === 'updated') counters.orders_updated += 1;
          else counters.orders_skipped += 1;
        } catch (e: any) {
          counters.errors_count += 1;
          errors.push(`${detail?.order_sn}: ${e?.message || e}`);
        }
      }
      counters.orders_skipped += Math.max(0, orderSns.length - details.length);
    }
  } catch (e: any) {
    counters.errors_count += 1;
    apiStatus = e?.code || 'error';
    errors.push(e?.message || String(e));
  }

  const status: SyncOutcome['status'] =
    counters.errors_count === 0
      ? 'success'
      : counters.orders_created + counters.orders_updated > 0
        ? 'partial'
        : 'failed';
  const finished = new Date();
  const message = errors.length ? errors.slice(0, 5).join(' | ').slice(0, 2000) : 'OK';

  const log = await prisma.channel_sync_logs.create({
    data: {
      id: newId(),
      tenant_id: tenantId,
      sales_channel_id: channelId || 'unknown',
      sync_type: syncType,
      status,
      started_at: started,
      finished_at: finished,
      orders_checked: counters.orders_checked,
      orders_created: counters.orders_created,
      orders_updated: counters.orders_updated,
      orders_skipped: counters.orders_skipped,
      errors_count: counters.errors_count,
      api_status: apiStatus.slice(0, 40),
      message,
      created_at: finished,
    },
  });

  if (channelId) {
    await updateChannel(channelId, {
      last_sync_at: finished,
      last_sync_status: status,
      last_error: status === 'success' ? null : message,
    });
  }

  return { ...counters, status, message, log_id: log.id };
}
