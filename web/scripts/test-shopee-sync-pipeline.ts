/**
 * Uji pipeline sinkronisasi pesanan Shopee dengan respons API yang DIPALSUKAN
 * (global.fetch di-mock), jadi tidak ada panggilan jaringan, tidak butuh
 * kredensial asli, dan kredensial Sandbox yang sudah tersimpan tidak disentuh.
 *
 * Yang diverifikasi:
 *   1. batas resmi Shopee: jendela maks 15 hari, page_size 1..100, batch detail 50
 *   2. validasi parameter: time_range_field, rentang terbalik, rentang kelewat panjang
 *   3. respons kosong -> api_status `ok_empty`, status tetap success (bukan gagal)
 *   4. respons berisi pesanan -> api_status `ok`, pesanan terbuat
 *   5. paginasi cursor: next_cursor diteruskan, more=true tanpa cursor = error
 *   6. detail pesanan tidak kembali -> dihitung orders_detail_missing, bukan skip
 *   7. error API (error_param) -> gagal; error_rate_limit -> dicoba ulang
 *   8. baris daftar tanpa order_sn tidak hilang diam-diam
 *   9. rentang panjang dipecah jadi beberapa jendela, masing-masing < 15 hari
 *  10. create_time dipakai hanya bila diminta; default tetap update_time
 *  11. log & pesan hasil tidak memuat partner key / access token / refresh token
 *
 * Semua data uji memakai tenant & order berawalan ZZ_TEST_ dan dihapus di akhir.
 * Jalankan: npx tsx scripts/test-shopee-sync-pipeline.ts
 */
import 'dotenv/config';
import { prisma } from '../lib/db';
import { newId } from '../lib/http';
import { savePartnerCreds, saveTokens } from '../lib/channels/store';
import {
  SHOPEE_DETAIL_BATCH_MAX,
  SHOPEE_LIST_PAGE_SIZE_MAX,
  SHOPEE_MAX_WINDOW_SECONDS,
  ShopeeConfig,
  getOrderDetailOutcome,
  getOrderListOutcome,
} from '../lib/channels/shopee/client';
import { runShopeeSync } from '../lib/channels/shopee/sync';

const TENANT_NAME = 'ZZ_TEST_SHOPEE_PIPELINE';
const SHOP_ID = '880088';
const PARTNER_ID = '2000001';
const PARTNER_KEY = 'ZZ_TEST_PARTNER_KEY_jangan_pernah_tercatat';
const ACCESS_TOKEN = 'ZZ_TEST_ACCESS_TOKEN_jangan_pernah_tercatat';
const REFRESH_TOKEN = 'ZZ_TEST_REFRESH_TOKEN_jangan_pernah_tercatat';
const SN1 = 'ZZ_TEST_PIPE_0001';
const SN2 = 'ZZ_TEST_PIPE_0002';

const cfg: ShopeeConfig = { partnerId: PARTNER_ID, partnerKey: PARTNER_KEY, environment: 'sandbox' };
const results: Array<{ name: string; ok: boolean; info: string }> = [];

function check(name: string, ok: boolean, info = '') {
  results.push({ name, ok, info });
  console.log(`${ok ? '\u2705' : '\u274c'} ${name}${info ? ` \u2014 ${info}` : ''}`);
}

// --- Mock fetch --------------------------------------------------------------
const realFetch = globalThis.fetch;
let calls: string[] = [];

type MockHandler = (url: URL, index: number) => { status?: number; body: any };

function mockFetch(handler: MockHandler) {
  calls = [];
  (globalThis as any).fetch = async (input: any) => {
    const url = new URL(String(input));
    const index = calls.length;
    calls.push(url.toString());
    const r = handler(url, index);
    return new Response(JSON.stringify(r.body), {
      status: r.status || 200,
      headers: { 'content-type': 'application/json' },
    });
  };
}

function restoreFetch() {
  (globalThis as any).fetch = realFetch;
}

const listBody = (orders: any[], more = false, nextCursor = '') => ({
  error: '',
  message: '',
  request_id: 'req-list-1',
  response: { order_list: orders, more, next_cursor: nextCursor },
});

function detailBody(sns: string[], warning: string[] = []) {
  return {
    error: '',
    message: '',
    request_id: 'req-detail-1',
    warning,
    response: {
      order_list: sns.map((sn) => ({
        order_sn: sn,
        order_status: 'READY_TO_SHIP',
        create_time: Math.floor(Date.now() / 1000) - 3600,
        update_time: Math.floor(Date.now() / 1000),
        total_amount: 150000,
        estimated_shipping_fee: 10000,
        payment_method: 'ShopeePay',
        buyer_username: 'zz_test_buyer',
        recipient_address: { name: 'ZZ Test', phone: '080000000000', full_address: 'Jl. Uji 1', city: 'Denpasar' },
        item_list: [
          {
            item_id: 7001,
            item_name: 'ZZ_TEST Mug',
            item_sku: 'ZZ-MUG-1',
            model_id: 1,
            model_quantity_purchased: 1,
            model_original_price: 150000,
            model_discounted_price: 150000,
          },
        ],
      })),
    },
  };
}

const isList = (u: URL) => u.pathname.endsWith('/order/get_order_list');

// --- Setup / teardown --------------------------------------------------------
async function setup() {
  const now = new Date();
  const tenantId = newId();
  await prisma.tenants.create({ data: { id: tenantId, name: TENANT_NAME, created_at: now } });
  const channel = await prisma.sales_channels.create({
    data: {
      id: newId(),
      tenant_id: tenantId,
      type: 'shopee',
      name: 'Shopee',
      status: 'connected',
      environment: 'sandbox',
      external_shop_id: SHOP_ID,
      auto_sync: false,
      created_at: now,
      updated_at: now,
    },
  });
  await savePartnerCreds(channel.id, PARTNER_ID, PARTNER_KEY);
  await saveTokens(channel.id, { accessToken: ACCESS_TOKEN, refreshToken: REFRESH_TOKEN, expiresIn: 4 * 3600 });
  return { tenantId, channelId: channel.id };
}

async function teardown(tenantId: string, channelId: string) {
  await prisma.custom_tee_orders.deleteMany({ where: { external_order_id: { in: [SN1, SN2] } } });
  await prisma.orders.deleteMany({ where: { tenant_id: tenantId } });
  await prisma.channel_products.deleteMany({ where: { sales_channel_id: channelId } });
  await prisma.channel_sync_logs.deleteMany({ where: { tenant_id: tenantId } });
  await prisma.activities.deleteMany({ where: { tenant_id: tenantId } });
  await prisma.channel_credentials.deleteMany({ where: { sales_channel_id: channelId } });
  await prisma.sales_channels.deleteMany({ where: { id: channelId } });
  await prisma.tenants.deleteMany({ where: { id: tenantId } });
}

async function expectThrow(fn: () => Promise<any>): Promise<string> {
  try {
    await fn();
    return '';
  } catch (e: any) {
    return String(e?.code || e?.message || 'error');
  }
}

function hasSecret(text: string): boolean {
  return [PARTNER_KEY, ACCESS_TOKEN, REFRESH_TOKEN].some((s) => text.includes(s));
}

async function main() {
  const { tenantId, channelId } = await setup();
  try {
    // --- 1. Batas resmi Shopee --------------------------------------------
    check(
      'Konstanta batas Shopee sesuai dokumentasi (15 hari, 100, 50)',
      SHOPEE_MAX_WINDOW_SECONDS === 15 * 24 * 3600 &&
        SHOPEE_LIST_PAGE_SIZE_MAX === 100 &&
        SHOPEE_DETAIL_BATCH_MAX === 50,
    );

    // --- 2. Validasi parameter --------------------------------------------
    mockFetch(() => ({ body: listBody([]) }));
    const now = Math.floor(Date.now() / 1000);
    const errTooLong = await expectThrow(() =>
      getOrderListOutcome(cfg, ACCESS_TOKEN, SHOP_ID, { timeFrom: now - 16 * 24 * 3600, timeTo: now }),
    );
    const errReversed = await expectThrow(() =>
      getOrderListOutcome(cfg, ACCESS_TOKEN, SHOP_ID, { timeFrom: now, timeTo: now - 10 }),
    );
    const errField = await expectThrow(() =>
      getOrderListOutcome(cfg, ACCESS_TOKEN, SHOP_ID, {
        timeFrom: now - 3600,
        timeTo: now,
        timeRangeField: 'paid_time' as any,
      }),
    );
    check('Rentang > 15 hari ditolak sebelum memanggil API', errTooLong === 'invalid_window' && calls.length === 0, errTooLong);
    check('Rentang terbalik ditolak', errReversed === 'invalid_window', errReversed);
    check('time_range_field tidak sah ditolak', errField === 'invalid_time_range_field', errField);

    // --- 3. Paginasi cursor ----------------------------------------------
    mockFetch((u, i) =>
      i === 0
        ? { body: listBody([{ order_sn: SN1 }], true, 'cursor-xyz') }
        : { body: listBody([{ order_sn: SN2 }], false, '') },
    );
    const paged = await getOrderListOutcome(cfg, ACCESS_TOKEN, SHOP_ID, { timeFrom: now - 3600, timeTo: now });
    check(
      'Paginasi mengikuti next_cursor dan berhenti saat more=false',
      paged.pages === 2 && paged.orderSns.length === 2 && new URL(calls[1]).searchParams.get('cursor') === 'cursor-xyz',
      `halaman=${paged.pages}, cursor2=${new URL(calls[1]).searchParams.get('cursor')}`,
    );
    check(
      'page_size dikirim sesuai batas maksimum 100',
      new URL(calls[0]).searchParams.get('page_size') === '100',
    );

    mockFetch(() => ({ body: listBody([{ order_sn: SN1 }], true, '') }));
    const errCursor = await expectThrow(() =>
      getOrderListOutcome(cfg, ACCESS_TOKEN, SHOP_ID, { timeFrom: now - 3600, timeTo: now }),
    );
    check('more=true tanpa next_cursor dianggap error, bukan data lengkap', errCursor === 'invalid_cursor', errCursor);

    // --- 4. Baris tanpa order_sn -----------------------------------------
    mockFetch(() => ({ body: listBody([{ order_sn: SN1 }, { order_status: 'UNPAID' }]) }));
    const dropped = await getOrderListOutcome(cfg, ACCESS_TOKEN, SHOP_ID, { timeFrom: now - 3600, timeTo: now });
    check(
      'Baris daftar tanpa order_sn dihitung, tidak hilang diam-diam',
      dropped.droppedRows === 1 && dropped.orderSns.length === 1,
      `dropped=${dropped.droppedRows}`,
    );

    // --- 5. Detail sebagian gagal ----------------------------------------
    mockFetch(() => ({ body: detailBody([SN1], ['order ZZ_TEST_PIPE_0002 tidak tersedia']) }));
    const partial = await getOrderDetailOutcome(cfg, ACCESS_TOKEN, SHOP_ID, [SN1, SN2]);
    check(
      'Detail yang tidak kembali dilaporkan sebagai missing + warning',
      partial.orders.length === 1 && partial.missing.length === 1 && partial.warnings.length === 1,
      `missing=${partial.missing.join(',')}`,
    );

    // --- 6. Error API -----------------------------------------------------
    mockFetch(() => ({ body: { error: 'error_param', message: 'Parameter salah', request_id: 'r1' } }));
    const errParam = await expectThrow(() =>
      getOrderListOutcome(cfg, ACCESS_TOKEN, SHOP_ID, { timeFrom: now - 3600, timeTo: now }),
    );
    check('HTTP 200 dengan error_param tetap dianggap gagal', errParam === 'error_param' && calls.length === 1, errParam);

    mockFetch((u, i) =>
      i === 0 ? { body: { error: 'error_rate_limit', message: 'slow down' } } : { body: listBody([]) },
    );
    const retried = await getOrderListOutcome(cfg, ACCESS_TOKEN, SHOP_ID, { timeFrom: now - 3600, timeTo: now });
    check('error_rate_limit dicoba ulang lalu berhasil', calls.length === 2 && retried.raw.length === 0, `panggilan=${calls.length}`);

    // --- 7. runShopeeSync: respons kosong --------------------------------
    mockFetch(() => ({ body: listBody([]) }));
    const empty = await runShopeeSync({ tenantId, syncType: 'manual', days: 7 });
    check(
      'Respons kosong -> api_status ok_empty & status success',
      empty.api_status === 'ok_empty' && empty.status === 'success' && empty.orders_checked === 0 && empty.errors_count === 0,
      `${empty.status}/${empty.api_status}`,
    );
    check(
      'Diagnostik mencatat rentang, jendela, halaman, dan jumlah mentah',
      empty.diagnostics.time_range_field === 'update_time' &&
        empty.diagnostics.days === 7 &&
        empty.diagnostics.windows === 1 &&
        empty.diagnostics.pages === 1 &&
        empty.diagnostics.raw_orders === 0 &&
        empty.diagnostics.time_to - empty.diagnostics.time_from === 7 * 24 * 3600,
      `jendela=${empty.diagnostics.windows}, halaman=${empty.diagnostics.pages}`,
    );
    const emptyLog = await prisma.channel_sync_logs.findFirst({ where: { id: empty.log_id } });
    check(
      'Log DB menyimpan api_status ok_empty dengan keterangan yang jelas',
      emptyLog?.api_status === 'ok_empty' && String(emptyLog?.message).includes('tidak ada pesanan'),
      String(emptyLog?.message).slice(0, 60),
    );

    // --- 8. runShopeeSync: ada pesanan -----------------------------------
    mockFetch((u) => (isList(u) ? { body: listBody([{ order_sn: SN1 }]) } : { body: detailBody([SN1]) }));
    const created = await runShopeeSync({ tenantId, syncType: 'manual', days: 3 });
    check(
      'Respons berisi pesanan -> api_status ok & pesanan terbuat',
      created.api_status === 'ok' && created.status === 'success' && created.orders_checked === 1 && created.orders_created === 1,
      `${created.status}/${created.api_status} baru=${created.orders_created}`,
    );
    check(
      'Sinkron ulang tidak membuat pesanan baru (update atau tanpa perubahan)',
      await (async () => {
        mockFetch((u) => (isList(u) ? { body: listBody([{ order_sn: SN1 }]) } : { body: detailBody([SN1]) }));
        const again = await runShopeeSync({ tenantId, syncType: 'manual', days: 3 });
        const rows = await prisma.orders.count({ where: { tenant_id: tenantId, external_order_id: SN1 } });
        return again.orders_created === 0 && again.orders_updated + again.orders_skipped === 1 && rows === 1;
      })(),
    );

    // --- 9. runShopeeSync: detail gagal ----------------------------------
    mockFetch((u) =>
      isList(u) ? { body: listBody([{ order_sn: SN1 }, { order_sn: SN2 }]) } : { body: detailBody([SN1]) },
    );
    const missing = await runShopeeSync({ tenantId, syncType: 'manual', days: 3 });
    check(
      'Detail gagal dihitung terpisah: hilang 1, pesanan lain tetap diproses',
      missing.orders_detail_missing === 1 &&
        missing.orders_created + missing.orders_updated + missing.orders_skipped === 1 &&
        missing.orders_failed === 0 &&
        missing.status === 'partial',
      `detail_hilang=${missing.orders_detail_missing}, baru=${missing.orders_created}, update=${missing.orders_updated}, tanpa ubah=${missing.orders_skipped}, status=${missing.status}`,
    );

    // --- 10. runShopeeSync: error API ------------------------------------
    mockFetch(() => ({ body: { error: 'error_auth', message: 'token tidak sah', request_id: 'r9' } }));
    const failed = await runShopeeSync({ tenantId, syncType: 'manual', days: 3 });
    check(
      'Error API -> status failed dengan api_status dari Shopee',
      failed.status === 'failed' && failed.api_status === 'error_auth' && failed.orders_checked === 0,
      `${failed.status}/${failed.api_status}`,
    );
    check(
      'ok_empty tidak pernah dipakai saat API error',
      failed.api_status !== 'ok_empty',
    );

    // --- 11. Rentang panjang & create_time -------------------------------
    mockFetch(() => ({ body: listBody([]) }));
    const long = await runShopeeSync({ tenantId, syncType: 'backfill', days: 30, timeRangeField: 'create_time' });
    const spans = calls.map((c) => {
      const p = new URL(c).searchParams;
      return Number(p.get('time_to')) - Number(p.get('time_from'));
    });
    check(
      '30 hari dipecah jadi beberapa jendela, semuanya <= 15 hari',
      long.diagnostics.windows === 2 && spans.every((s) => s > 0 && s <= SHOPEE_MAX_WINDOW_SECONDS),
      `jendela=${long.diagnostics.windows}, span maks=${Math.max(...spans)}s`,
    );
    check(
      'create_time dipakai hanya bila diminta',
      calls.every((c) => new URL(c).searchParams.get('time_range_field') === 'create_time') &&
        long.diagnostics.time_range_field === 'create_time',
    );
    mockFetch(() => ({ body: listBody([]) }));
    const def = await runShopeeSync({ tenantId, syncType: 'manual' });
    check(
      'Default tetap update_time dan 7 hari (perilaku lama tidak berubah)',
      def.diagnostics.time_range_field === 'update_time' && def.diagnostics.days === 7,
      `${def.diagnostics.time_range_field}/${def.diagnostics.days}`,
    );

    // --- 12. order_sns eksplisit tidak dimutasi --------------------------
    mockFetch(() => ({ body: detailBody([SN1]) }));
    const explicit = [SN1];
    await runShopeeSync({ tenantId, syncType: 'webhook', orderSns: explicit });
    check('Argumen order_sns pemanggil tidak dimutasi', explicit.length === 1 && explicit[0] === SN1, `panjang=${explicit.length}`);

    // --- 13. Tidak ada rahasia yang tercatat -----------------------------
    const logs = await prisma.channel_sync_logs.findMany({ where: { tenant_id: tenantId } });
    const activities = await prisma.activities.findMany({ where: { tenant_id: tenantId } });
    const blob = [
      ...logs.map((l) => `${l.message}|${l.api_status}`),
      ...activities.map((a) => `${a.title}|${a.description}`),
      JSON.stringify(empty.diagnostics),
      empty.message,
      created.message,
      missing.message,
      failed.message,
    ].join(' || ');
    check('Log & pesan hasil tidak memuat partner key / token', !hasSecret(blob), `${logs.length} baris log diperiksa`);
  } finally {
    restoreFetch();
    await teardown(tenantId, channelId);
  }

  const left = await prisma.tenants.count({ where: { name: TENANT_NAME } });
  check('Data uji dibersihkan', left === 0);

  const failedChecks = results.filter((r) => !r.ok);
  console.log('\n\u2500\u2500\u2500 Ringkasan \u2500\u2500\u2500');
  console.log(`${results.length - failedChecks.length}/${results.length} lulus`);
  if (failedChecks.length) {
    console.log('GAGAL:', failedChecks.map((f) => f.name).join(', '));
    process.exit(1);
  }
  console.log('\ud83c\udf89 Semua uji pipeline sinkronisasi Shopee lulus.');
}

main()
  .catch((e) => {
    console.error('Uji gagal:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
