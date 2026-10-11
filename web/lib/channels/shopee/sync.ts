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
  SHOPEE_DETAIL_BATCH_MAX,
  SHOPEE_MAX_WINDOW_SECONDS,
  ShopeeConfig,
  ShopeeError,
  ShopeeTimeRangeField,
  getOrderDetailOutcome,
  getOrderListOutcome,
  refreshAccessToken,
  shopeeEnvironment,
} from './client';
import { legacyStatus, mapPaymentStatus, mapShippingStatus, mapShopeeStatus } from './status';
import { upsertChannelProduct } from './mapping';
import { NEW_STATUS, emptyDesignViews } from '../../customTeeOrders';

export interface SyncCounters {
  /** order_sn unik yang diterima dari daftar Shopee (atau yang diminta eksplisit). */
  orders_checked: number;
  orders_created: number;
  orders_updated: number;
  /** Detail diterima tapi tidak ada perubahan data dari Shopee. */
  orders_skipped: number;
  /** Order yang ada di daftar tapi detailnya tidak dikembalikan Shopee. */
  orders_detail_missing: number;
  /** Detail diterima tapi gagal diproses/disimpan di sisi kita. */
  orders_failed: number;
  errors_count: number;
}

/** Kegagalan satu jendela waktu; tanpa kredensial, token, atau URL bertanda tangan. */
export interface WindowFailure {
  index: number;
  time_from: number;
  time_to: number;
  code: string;
  message: string;
}

/** Kegagalan satu batch pengambilan detail. */
export interface DetailBatchFailure {
  index: number;
  size: number;
  code: string;
  message: string;
  /** Contoh order_sn pertama saja, untuk memudahkan penelusuran. */
  sample_order_sns: string[];
}

export interface SyncOutcome extends SyncCounters {
  status: 'success' | 'partial' | 'failed';
  /**
   * `ok` = API valid dan ada pesanan, `ok_empty` = API valid tapi daftar pesanan
   * kosong (bukan kegagalan), selain itu kode error dari Shopee.
   */
  api_status: string;
  message: string;
  log_id: string;
  /** Rincian pemanggilan API untuk penelusuran, tanpa rahasia apa pun. */
  diagnostics: {
    time_range_field: string;
    time_from: number;
    time_to: number;
    /** Rentang dalam zona waktu toko, untuk dibaca manusia. */
    time_from_local: string;
    time_to_local: string;
    days: number;
    /** Jendela yang DIMINTA (termasuk yang gagal). */
    windows_planned: number;
    /** Jendela yang berhasil diambil seluruh halamannya. */
    windows: number;
    pages: number;
    raw_orders: number;
    unique_order_sns: number;
    dropped_rows: number;
    /** Batch detail yang berhasil. */
    detail_batches: number;
    detail_batches_planned: number;
    failed_windows: WindowFailure[];
    failed_detail_batches: DetailBatchFailure[];
    warnings: string[];
  };
}

/**
 * Panjang maksimum satu jendela. Batas resmi Shopee adalah jarak 15 hari antara
 * time_from dan time_to (inklusif di kedua ujung), jadi nilai ini dipakai apa
 * adanya dan jendela berikutnya mulai satu detik setelah jendela sebelumnya
 * berakhir: tidak ada detik yang terlewat maupun terhitung dua kali.
 */
const WINDOW_SPAN = SHOPEE_MAX_WINDOW_SECONDS;

/**
 * Field yang selalu berubah tiap sinkron dan TIDAK menandakan perubahan data
 * pesanan dari Shopee.
 */
const VOLATILE_FIELDS = new Set(['synced_at', 'updated_at']);

/** Pecah daftar jadi beberapa batch berukuran tetap. */
function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Normalisasi nilai agar Decimal, Date, null, dan angka bisa dibandingkan. */
function normalizeValue(v: any): string {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return String(v.getTime());
  if (typeof v === 'object' && typeof v.toString === 'function') return v.toString(); // Prisma Decimal
  if (typeof v === 'number') return String(v);
  return String(v);
}

/**
 * Apakah data dari Shopee identik dengan baris yang sudah tersimpan?
 * Dipakai untuk membedakan "diperbarui" dari "dilewati" (Skip) secara jujur:
 * Skip berarti Shopee memang tidak mengirim perubahan apa pun.
 */
export function isSameOrderData(existing: Record<string, any>, incoming: Record<string, any>): boolean {
  for (const [key, value] of Object.entries(incoming)) {
    if (VOLATILE_FIELDS.has(key)) continue;
    if (normalizeValue(existing[key]) !== normalizeValue(value)) return false;
  }
  return true;
}

/**
 * Waktu untuk dibaca manusia pada keterangan log. Zona dari env TIMEZONE
 * (default Asia/Makassar) supaya cocok dengan Shopee Seller Centre milik toko;
 * angka epoch yang dikirim ke Shopee tetap UTC dan tidak diubah.
 */
export function formatLocalTime(epochSeconds: number): string {
  const zone = process.env.TIMEZONE || 'Asia/Makassar';
  try {
    const parts = new Intl.DateTimeFormat('id-ID', {
      timeZone: zone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(new Date(epochSeconds * 1000));
    const get = (t: string) => parts.find((p) => p.type === t)?.value || '';
    return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')} ${zone}`;
  } catch {
    return new Date(epochSeconds * 1000).toISOString();
  }
}

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
  let action: 'created' | 'updated' | 'unchanged' = 'updated';
  if (existing) {
    if (isSameOrderData(existing, data)) {
      // Tidak ada perubahan isi dari Shopee -> dihitung "dilewati" (Skip).
      // Hanya penanda waktu pemeriksaan yang disegarkan, bukan data pesanan.
      order = await prisma.orders.update({ where: { id: existing.id }, data: { synced_at: now } });
      action = 'unchanged';
    } else {
      order = await prisma.orders.update({ where: { id: existing.id }, data });
      action = 'updated';
    }
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
  timeRangeField?: ShopeeTimeRangeField;
}): Promise<SyncOutcome> {
  const tenantId = options.tenantId;
  const syncType = options.syncType || 'manual';
  const started = new Date();
  const counters: SyncCounters = {
    orders_checked: 0,
    orders_created: 0,
    orders_updated: 0,
    orders_skipped: 0,
    orders_detail_missing: 0,
    orders_failed: 0,
    errors_count: 0,
  };
  const errors: string[] = [];
  const warnings: string[] = [];
  const failedWindows: WindowFailure[] = [];
  const failedBatches: DetailBatchFailure[] = [];
  let channelId = '';
  let apiStatus = 'ok';
  /** Kode error pertama; dipakai sebagai api_status bila ada kegagalan apa pun. */
  let firstErrorCode = '';

  const noteError = (code: string, text: string) => {
    counters.errors_count += 1;
    if (!firstErrorCode) firstErrorCode = code || 'error';
    errors.push(text);
  };

  // Default perilaku TIDAK berubah: 7 hari terakhir memakai update_time.
  const days = Math.min(120, Math.max(1, Number(options.days) || 7));
  const timeRangeField: ShopeeTimeRangeField = options.timeRangeField === 'create_time' ? 'create_time' : 'update_time';
  const explicitSns = (options.orderSns || []).slice(); // salinan: jangan mutasi argumen pemanggil
  const timeTo = Math.floor(Date.now() / 1000);
  const timeFrom = timeTo - days * 24 * 3600;
  const byOrderSn = explicitSns.length > 0;
  const diagnostics: SyncOutcome['diagnostics'] = {
    time_range_field: timeRangeField,
    time_from: byOrderSn ? 0 : timeFrom,
    time_to: byOrderSn ? 0 : timeTo,
    time_from_local: byOrderSn ? '' : formatLocalTime(timeFrom),
    time_to_local: byOrderSn ? '' : formatLocalTime(timeTo),
    days: byOrderSn ? 0 : days,
    windows_planned: 0,
    windows: 0,
    pages: 0,
    raw_orders: 0,
    unique_order_sns: 0,
    dropped_rows: 0,
    detail_batches: 0,
    detail_batches_planned: 0,
    failed_windows: failedWindows,
    failed_detail_batches: failedBatches,
    warnings: [],
  };

  try {
    const known = await getChannel(tenantId, 'shopee');
    if (known) channelId = known.id;
    const ctx = await shopeeContext(tenantId);
    channelId = ctx.channel.id;

    let orderSns = explicitSns;
    if (!byOrderSn) {
      const collected: string[] = [];
      // Jendela berurutan tanpa tumpang tindih dan tanpa celah: jendela
      // berikutnya mulai satu detik setelah jendela sebelumnya berakhir, dan
      // jendela terakhir berhenti tepat di time_to.
      let windowIndex = 0;
      for (let start = timeFrom; start <= timeTo; ) {
        const end = Math.min(timeTo, start + WINDOW_SPAN);
        windowIndex += 1;
        diagnostics.windows_planned += 1;
        try {
          const listed = await getOrderListOutcome(ctx.cfg, ctx.accessToken, ctx.shopId, {
            timeFrom: start,
            timeTo: end,
            timeRangeField,
          });
          diagnostics.windows += 1;
          diagnostics.pages += listed.pages;
          diagnostics.raw_orders += listed.raw.length;
          diagnostics.dropped_rows += listed.droppedRows;
          collected.push(...listed.orderSns);
        } catch (e: any) {
          // Satu jendela gagal TIDAK membatalkan jendela lain. Dicatat eksplisit
          // supaya terlihat rentang mana yang perlu diambil ulang.
          const code = String(e?.code || 'error');
          failedWindows.push({
            index: windowIndex,
            time_from: start,
            time_to: end,
            code,
            message: String(e?.message || e).slice(0, 200),
          });
          noteError(
            code,
            `jendela ${windowIndex} gagal (${formatLocalTime(start)}..${formatLocalTime(end)}): ${code}`,
          );
        }
        start = end + 1;
      }
      // Baris tanpa order_sn tidak boleh hilang diam-diam: hitung sebagai error
      // supaya perubahan bentuk respons Shopee langsung terlihat di log.
      if (diagnostics.dropped_rows > 0) {
        noteError('invalid_order_row', `${diagnostics.dropped_rows} baris daftar order tanpa order_sn`);
      }
      orderSns = Array.from(new Set(collected));
    }
    diagnostics.unique_order_sns = orderSns.length;
    counters.orders_checked = orderSns.length;

    // Detail diambil & disimpan PER BATCH: batch yang gagal tidak membuang hasil
    // batch lain, dan pesanan yang gagal tidak dihitung sebagai tersimpan.
    const batches = chunk(orderSns, SHOPEE_DETAIL_BATCH_MAX);
    diagnostics.detail_batches_planned = batches.length;
    for (let b = 0; b < batches.length; b += 1) {
      const batch = batches[b];
      try {
        const detailed = await getOrderDetailOutcome(ctx.cfg, ctx.accessToken, ctx.shopId, batch);
        diagnostics.detail_batches += 1;
        if (detailed.warnings.length) {
          warnings.push(...detailed.warnings);
          diagnostics.warnings = warnings.slice(0, 10);
        }
        for (const detail of detailed.orders) {
          try {
            const res = await upsertShopeeOrder(tenantId, ctx.channel, detail);
            if (res.action === 'created') counters.orders_created += 1;
            else if (res.action === 'updated') counters.orders_updated += 1;
            else counters.orders_skipped += 1;
          } catch (e: any) {
            // Gagal disimpan -> bukan "dilewati", bukan "tersimpan".
            counters.orders_failed += 1;
            noteError('upsert_failed', `${detail?.order_sn}: ${String(e?.message || e).slice(0, 160)}`);
          }
        }
        if (detailed.missing.length) {
          // Detail tidak kembali walau API membalas sukses.
          counters.orders_detail_missing += detailed.missing.length;
          noteError(
            'detail_missing',
            `detail tidak kembali untuk ${detailed.missing.length} order (${detailed.missing.slice(0, 5).join(', ')})`,
          );
        }
      } catch (e: any) {
        // Seluruh batch gagal: seluruh order_sn batch ini dihitung detail hilang,
        // batch lain tetap diproses.
        const code = String(e?.code || 'error');
        counters.orders_detail_missing += batch.length;
        failedBatches.push({
          index: b + 1,
          size: batch.length,
          code,
          message: String(e?.message || e).slice(0, 200),
          sample_order_sns: batch.slice(0, 3),
        });
        noteError(code, `batch detail ${b + 1}/${batches.length} (${batch.length} order) gagal: ${code}`);
      }
    }

    // API valid tapi tidak ada pesanan -> bedakan dari kegagalan.
    if (counters.orders_checked === 0 && counters.errors_count === 0) apiStatus = 'ok_empty';
  } catch (e: any) {
    // Kegagalan di luar jendela/batch (mis. kredensial atau token).
    noteError(String(e?.code || 'error'), String(e?.message || e));
  }

  // Jangan pernah melaporkan sukses penuh bila ada kegagalan yang belum selesai.
  if (counters.errors_count > 0) apiStatus = firstErrorCode || 'error';

  const status: SyncOutcome['status'] =
    counters.errors_count === 0
      ? 'success'
      : counters.orders_created + counters.orders_updated + counters.orders_skipped > 0
        ? 'partial'
        : 'failed';
  const finished = new Date();

  // Ringkasan yang bisa dibaca manusia + angka mentah, TANPA partner key,
  // access token, refresh token, atau URL bertanda tangan.
  const scope = byOrderSn
    ? `order_sn eksplisit: ${explicitSns.length}`
    : `${timeRangeField} ${diagnostics.time_from_local}..${diagnostics.time_to_local} (${days} hari, ${diagnostics.windows}/${diagnostics.windows_planned} jendela, ${diagnostics.pages} halaman)`;
  const summary = [
    `${apiStatus}`,
    scope,
    `mentah ${diagnostics.raw_orders}`,
    `unik ${diagnostics.unique_order_sns}`,
    `tanpa order_sn ${diagnostics.dropped_rows}`,
    `batch detail ${diagnostics.detail_batches}/${diagnostics.detail_batches_planned}`,
    `baru ${counters.orders_created}`,
    `update ${counters.orders_updated}`,
    `tanpa perubahan ${counters.orders_skipped}`,
    `detail hilang ${counters.orders_detail_missing}`,
    `gagal simpan ${counters.orders_failed}`,
    failedWindows.length
      ? `jendela gagal: ${failedWindows.map((w) => `${w.index}(${w.code})`).join(',')}`
      : '',
    failedBatches.length
      ? `batch gagal: ${failedBatches.map((f) => `${f.index}(${f.code},${f.size})`).join(',')}`
      : '',
  ]
    .filter(Boolean)
    .join(' | ');
  const message = [
    errors.length ? errors.slice(0, 5).join(' | ') : apiStatus === 'ok_empty' ? 'OK (tidak ada pesanan pada rentang ini)' : 'OK',
    summary,
    warnings.length ? `warning Shopee: ${warnings.slice(0, 3).join(' ; ')}` : '',
  ]
    .filter(Boolean)
    .join(' || ')
    .slice(0, 2000);

  // Jejak server untuk penelusuran; sengaja tanpa kredensial apa pun.
  console.info(
    '[shopee-sync]',
    JSON.stringify({
      tenant_id: tenantId,
      sync_type: syncType,
      status,
      api_status: apiStatus,
      ...diagnostics,
      ...counters,
      duration_ms: finished.getTime() - started.getTime(),
    }),
  );

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

  return { ...counters, status, api_status: apiStatus, message, log_id: log.id, diagnostics };
}
