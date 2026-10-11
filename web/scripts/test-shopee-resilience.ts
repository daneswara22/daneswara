/**
 * Uji REGRESI isolasi kegagalan sinkronisasi Shopee (T3/T4) dan temuan
 * tambahan T1 (batas jendela), T2 (zona waktu log), T5 (definisi Skip).
 *
 * Semua panggilan Shopee DIPALSUKAN lewat override global.fetch: tidak ada
 * jaringan, tidak ada kredensial asli, kredensial Sandbox tidak disentuh.
 * Data uji memakai tenant & order berawalan ZZ_TEST_ dan dihapus di akhir.
 *
 * Jalankan: npx tsx scripts/test-shopee-resilience.ts
 */
import 'dotenv/config';
import { prisma } from '../lib/db';
import { newId } from '../lib/http';
import { savePartnerCreds, saveTokens } from '../lib/channels/store';
import { SHOPEE_MAX_WINDOW_SECONDS } from '../lib/channels/shopee/client';
import { formatLocalTime, isSameOrderData, runShopeeSync } from '../lib/channels/shopee/sync';

const TENANT_NAME = 'ZZ_TEST_SHOPEE_RESILIENCE';
const SHOP_ID = '880077';
const PARTNER_ID = '2000003';
const PARTNER_KEY = 'ZZ_TEST_PK_resilience';
const ACCESS_TOKEN = 'ZZ_TEST_AT_resilience';
const REFRESH_TOKEN = 'ZZ_TEST_RT_resilience';

const results: Array<{ name: string; ok: boolean; info: string }> = [];
function check(name: string, ok: boolean, info = '') {
  results.push({ name, ok, info });
  console.log(`${ok ? '\u2705' : '\u274c'} ${name}${info ? ` \u2014 ${info}` : ''}`);
}

const realFetch = globalThis.fetch;
let calls: URL[] = [];

function mockFetch(handler: (url: URL) => { status?: number; body: any }) {
  calls = [];
  (globalThis as any).fetch = async (input: any) => {
    const url = new URL(String(input));
    const r = handler(url);
    calls.push(url);
    return new Response(JSON.stringify(r.body), {
      status: r.status || 200,
      headers: { 'content-type': 'application/json' },
    });
  };
}

const listBody = (orders: any[], more = false, nextCursor = '') => ({
  error: '',
  message: '',
  request_id: 'req-list',
  response: { order_list: orders, more, next_cursor: nextCursor },
});

const errBody = (code: string) => ({ error: code, message: `simulasi ${code}`, request_id: 'req-err' });

/**
 * Detail pesanan dengan timestamp TETAP, supaya sinkron ulang dengan data yang
 * sama benar-benar terdeteksi "tanpa perubahan" (bukan berubah karena jam).
 */
const FIXED_CREATE = Math.floor(Date.UTC(2026, 0, 2, 3, 0, 0) / 1000);
const FIXED_UPDATE = Math.floor(Date.UTC(2026, 0, 2, 4, 0, 0) / 1000);

function orderDetail(sn: string, total: number | string = 99000) {
  return {
    order_sn: sn,
    order_status: 'READY_TO_SHIP',
    create_time: FIXED_CREATE,
    update_time: FIXED_UPDATE,
    total_amount: total,
    estimated_shipping_fee: 9000,
    payment_method: 'ShopeePay',
    buyer_username: 'zz_test_buyer',
    recipient_address: { name: 'ZZ Test', phone: '08000000', full_address: 'Jl. Uji 3', city: 'Denpasar' },
    item_list: [
      {
        item_id: 7201,
        item_name: 'ZZ_TEST Totebag',
        item_sku: 'ZZ-TOTE-1',
        model_id: 3,
        model_quantity_purchased: 1,
        model_original_price: total,
        model_discounted_price: total,
      },
    ],
  };
}

const detailBody = (sns: string[], total: number | string = 99000) => ({
  error: '',
  message: '',
  request_id: 'req-detail',
  response: { order_list: sns.map((sn) => orderDetail(sn, total)) },
});

const isList = (u: URL) => u.pathname.endsWith('/order/get_order_list');
const p = (u: URL, k: string) => u.searchParams.get(k) || '';
const sns = (u: URL) => p(u, 'order_sn_list').split(',').filter(Boolean);

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
  await prisma.custom_tee_orders.deleteMany({ where: { tenant_id: tenantId } });
  await prisma.orders.deleteMany({ where: { tenant_id: tenantId } });
  await prisma.channel_products.deleteMany({ where: { sales_channel_id: channelId } });
  await prisma.channel_sync_logs.deleteMany({ where: { tenant_id: tenantId } });
  await prisma.activities.deleteMany({ where: { tenant_id: tenantId } });
  await prisma.channel_credentials.deleteMany({ where: { sales_channel_id: channelId } });
  await prisma.sales_channels.deleteMany({ where: { id: channelId } });
  await prisma.tenants.deleteMany({ where: { id: tenantId } });
}

const saved = (tenantId: string, prefix: string) =>
  prisma.orders.count({ where: { tenant_id: tenantId, external_order_id: { startsWith: prefix } } });

async function main() {
  const { tenantId, channelId } = await setup();
  try {
    // =====================================================================
    // T3 — satu jendela gagal, jendela lain tetap diproses
    // =====================================================================
    // 45 hari -> 3 jendela. Jendela ke-2 gagal PERMANEN (dikenali dari
    // time_from), jendela 1 dan 3 mengirim 1 pesanan masing-masing.
    let base = 0;
    const winIdx = (u: URL) => {
      const from = Number(p(u, 'time_from'));
      if (!base) base = from;
      return Math.round((from - base) / (SHOPEE_MAX_WINDOW_SECONDS + 1));
    };
    mockFetch((u) => {
      if (!isList(u)) return { body: detailBody(sns(u)) };
      const i = winIdx(u);
      if (i === 1) return { body: errBody('error_server') };
      return { body: listBody([{ order_sn: `ZZ_TEST_RS_W${i}` }]) };
    });
    const win = await runShopeeSync({ tenantId, syncType: 'backfill', days: 45 });
    const winSaved = await saved(tenantId, 'ZZ_TEST_RS_W');
    check(
      'T3: jendela 2 gagal, jendela 1 & 3 tetap diproses dan tersimpan',
      winSaved === 2 && win.orders_created === 2 && win.orders_checked === 2,
      `tersimpan=${winSaved}, dibuat=${win.orders_created}, dicek=${win.orders_checked}`,
    );
    check(
      'T3: jendela gagal dicatat eksplisit di diagnostics',
      win.diagnostics.failed_windows.length === 1 &&
        win.diagnostics.failed_windows[0].index === 2 &&
        win.diagnostics.failed_windows[0].code === 'error_server' &&
        win.diagnostics.windows === 2 &&
        win.diagnostics.windows_planned === 3,
      `gagal=${JSON.stringify(win.diagnostics.failed_windows.map((w) => [w.index, w.code]))}, jendela=${win.diagnostics.windows}/${win.diagnostics.windows_planned}`,
    );
    check(
      'T3: hasil tidak diklaim sukses penuh (status partial, api_status kode error)',
      win.status === 'partial' && win.api_status === 'error_server' && win.errors_count === 1,
      `${win.status}/${win.api_status}`,
    );
    const winLog = await prisma.channel_sync_logs.findFirst({ where: { id: win.log_id } });
    check(
      'T3: log DB menyebut jendela mana yang gagal',
      String(winLog?.message).includes('jendela gagal: 2(error_server)') &&
        String(winLog?.message).includes('2/3 jendela'),
      String(winLog?.message).slice(0, 110),
    );

    // Sinkron ulang setelah jendela 2 pulih: tidak boleh duplikat
    mockFetch((u) => {
      if (!isList(u)) return { body: detailBody(sns(u)) };
      const i = winIdx(u);
      return { body: listBody([{ order_sn: `ZZ_TEST_RS_W${i}` }]) };
    });
    const retry = await runShopeeSync({ tenantId, syncType: 'backfill', days: 45 });
    const retrySaved = await saved(tenantId, 'ZZ_TEST_RS_W');
    check(
      'T3: sinkron ulang memulihkan jendela yang gagal tanpa duplikasi',
      retrySaved === 3 &&
        retry.orders_created === 1 &&
        retry.orders_skipped === 2 &&
        retry.status === 'success' &&
        retry.api_status === 'ok',
      `tersimpan=${retrySaved}, baru=${retry.orders_created}, tanpa ubah=${retry.orders_skipped}, ${retry.status}/${retry.api_status}`,
    );
    check(
      'T3: sinkron ulang ketiga tidak menambah baris & dihitung tanpa perubahan',
      await (async () => {
        mockFetch((u) => {
          if (!isList(u)) return { body: detailBody(sns(u)) };
          return { body: listBody([{ order_sn: `ZZ_TEST_RS_W${winIdx(u)}` }]) };
        });
        const third = await runShopeeSync({ tenantId, syncType: 'backfill', days: 45 });
        const rows = await saved(tenantId, 'ZZ_TEST_RS_W');
        return rows === 3 && third.orders_created === 0 && third.orders_skipped === 3 && third.status === 'success';
      })(),
    );

    // =====================================================================
    // T4 — batch 1 sukses, batch 2 gagal, batch 3 sukses
    // =====================================================================
    const many = Array.from({ length: 120 }, (_, i) => `ZZ_TEST_RS_B${String(i).padStart(3, '0')}`);
    mockFetch((u) => {
      if (isList(u)) return { body: listBody(many.map((sn) => ({ order_sn: sn }))) };
      const batch = sns(u);
      // Batch kedua = order ke-51..100 (dikenali dari anggota pertamanya).
      if (batch[0] === many[50]) return { body: errBody('error_server') };
      return { body: detailBody(batch) };
    });
    const batch = await runShopeeSync({ tenantId, syncType: 'manual', days: 7 });
    const batchSaved = await saved(tenantId, 'ZZ_TEST_RS_B');
    check(
      'T4: batch 2 gagal tapi batch 1 & 3 tetap tersimpan (50 + 20 = 70)',
      batchSaved === 70 && batch.orders_created === 70,
      `tersimpan=${batchSaved}, dibuat=${batch.orders_created}`,
    );
    check(
      'T4: pesanan batch gagal TIDAK dihitung tersimpan, tapi detail hilang',
      batch.orders_checked === 120 &&
        batch.orders_detail_missing === 50 &&
        batch.orders_skipped === 0 &&
        batch.orders_failed === 0 &&
        batch.orders_created + batch.orders_updated + batch.orders_detail_missing === 120,
      `dicek=${batch.orders_checked}, baru=${batch.orders_created}, hilang=${batch.orders_detail_missing}, tanpa ubah=${batch.orders_skipped}, gagal simpan=${batch.orders_failed}`,
    );
    check(
      'T4: batch gagal tercatat dengan indeks, ukuran, kode, dan contoh order_sn',
      batch.diagnostics.failed_detail_batches.length === 1 &&
        batch.diagnostics.failed_detail_batches[0].index === 2 &&
        batch.diagnostics.failed_detail_batches[0].size === 50 &&
        batch.diagnostics.failed_detail_batches[0].code === 'error_server' &&
        batch.diagnostics.failed_detail_batches[0].sample_order_sns.length === 3 &&
        batch.diagnostics.detail_batches === 2 &&
        batch.diagnostics.detail_batches_planned === 3,
      `batch=${batch.diagnostics.detail_batches}/${batch.diagnostics.detail_batches_planned}, gagal=${JSON.stringify(batch.diagnostics.failed_detail_batches[0]?.sample_order_sns)}`,
    );
    check(
      'T4: status partial & api_status kode Shopee (bukan ok / ok_empty)',
      batch.status === 'partial' && batch.api_status === 'error_server',
      `${batch.status}/${batch.api_status}`,
    );
    check(
      'T4: diagnostics batch gagal tidak memuat kredensial/token',
      !JSON.stringify(batch.diagnostics).includes(PARTNER_KEY) &&
        !JSON.stringify(batch.diagnostics).includes(ACCESS_TOKEN) &&
        !JSON.stringify(batch.diagnostics).includes(REFRESH_TOKEN),
    );

    // Batch gagal pulih pada sinkron berikutnya, tanpa duplikasi
    mockFetch((u) =>
      isList(u) ? { body: listBody(many.map((sn) => ({ order_sn: sn }))) } : { body: detailBody(sns(u)) },
    );
    const batchRetry = await runShopeeSync({ tenantId, syncType: 'manual', days: 7 });
    const batchRetrySaved = await saved(tenantId, 'ZZ_TEST_RS_B');
    check(
      'T4: sinkron ulang menyimpan 50 sisa tanpa menduplikasi 70 yang sudah ada',
      batchRetrySaved === 120 &&
        batchRetry.orders_created === 50 &&
        batchRetry.orders_skipped === 70 &&
        batchRetry.orders_updated === 0 &&
        batchRetry.status === 'success',
      `tersimpan=${batchRetrySaved}, baru=${batchRetry.orders_created}, tanpa ubah=${batchRetry.orders_skipped}`,
    );

    // Kegagalan penyimpanan (bukan kegagalan API) dihitung sendiri
    // order_sn jauh melebihi lebar kolom -> penyimpanan baris itu pasti gagal,
    // sementara pesanan lain pada batch yang sama harus tetap tersimpan.
    const TOO_LONG = `ZZ_TEST_RS_F_${'X'.repeat(200)}`;
    mockFetch((u) =>
      isList(u)
        ? { body: listBody([{ order_sn: TOO_LONG }, { order_sn: 'ZZ_TEST_RS_F2' }]) }
        : {
            body: {
              error: '',
              message: '',
              response: { order_list: [orderDetail(TOO_LONG), orderDetail('ZZ_TEST_RS_F2')] },
            },
          },
    );
    const bad = await runShopeeSync({ tenantId, syncType: 'manual', days: 7 });
    const badSaved = await saved(tenantId, 'ZZ_TEST_RS_F');
    check(
      'T4: satu pesanan gagal disimpan tidak menggagalkan pesanan lain di batch yang sama',
      bad.orders_failed === 1 &&
        bad.orders_created === 1 &&
        bad.orders_skipped === 0 &&
        bad.orders_detail_missing === 0 &&
        bad.status === 'partial' &&
        badSaved === 1,
      `gagal simpan=${bad.orders_failed}, baru=${bad.orders_created}, tersimpan=${badSaved}, status=${bad.status}`,
    );

    // =====================================================================
    // T1 — batas jendela tidak lagi tumpang tindih
    // =====================================================================
    mockFetch((u) => (isList(u) ? { body: listBody([]) } : { body: detailBody([]) }));
    const t1 = await runShopeeSync({ tenantId, syncType: 'backfill', days: 90 });
    const wins = calls.filter(isList).map((u) => ({ from: Number(p(u, 'time_from')), to: Number(p(u, 'time_to')) }));
    const gaps = wins.slice(1).map((w, i) => w.from - wins[i].to);
    check(
      'T1: jendela berurutan tanpa tumpang tindih (selisih tepat 1 detik)',
      gaps.every((g) => g === 1),
      `selisih=${gaps.join(',')}`,
    );
    check(
      'T1: patuh batas resmi (<=15 hari) dan menutup seluruh rentang sampai detik terakhir',
      wins.every((w) => w.to - w.from > 0 && w.to - w.from <= SHOPEE_MAX_WINDOW_SECONDS) &&
        wins[0].from === t1.diagnostics.time_from &&
        wins[wins.length - 1].to === t1.diagnostics.time_to,
      `jendela=${wins.length}, maks span=${Math.max(...wins.map((w) => w.to - w.from))}s`,
    );
    check(
      'T1: epoch yang dikirim ke Shopee tetap UTC dan tidak bergeser',
      t1.diagnostics.time_to - t1.diagnostics.time_from === 90 * 24 * 3600,
    );

    // =====================================================================
    // T2 — waktu log dalam zona Asia/Makassar
    // =====================================================================
    const zone = process.env.TIMEZONE || 'Asia/Makassar';
    check(
      'T2: diagnostics memuat rentang versi lokal berlabel zona toko',
      t1.diagnostics.time_from_local.includes(zone) && t1.diagnostics.time_to_local.includes(zone),
      t1.diagnostics.time_to_local,
    );
    const t1Log = await prisma.channel_sync_logs.findFirst({ where: { id: t1.log_id } });
    check(
      'T2: keterangan log memakai jam lokal, bukan ISO UTC',
      String(t1Log?.message).includes(zone) && !/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(String(t1Log?.message)),
      String(t1Log?.message).slice(0, 100),
    );
    // 2026-01-01 00:00:00 UTC = 08:00 WITA
    check(
      'T2: konversi zona benar (UTC+8 untuk Asia/Makassar)',
      formatLocalTime(Date.UTC(2026, 0, 1, 0, 0, 0) / 1000).startsWith('2026-01-01 08:00'),
      formatLocalTime(Date.UTC(2026, 0, 1, 0, 0, 0) / 1000),
    );

    // =====================================================================
    // T5 — definisi Skip
    // =====================================================================
    const SN = 'ZZ_TEST_RS_S1';
    mockFetch((u) => (isList(u) ? { body: listBody([{ order_sn: SN }]) } : { body: detailBody([SN], 123000) }));
    const s1 = await runShopeeSync({ tenantId, syncType: 'manual', days: 7 });
    mockFetch((u) => (isList(u) ? { body: listBody([{ order_sn: SN }]) } : { body: detailBody([SN], 123000) }));
    const s2 = await runShopeeSync({ tenantId, syncType: 'manual', days: 7 });
    mockFetch((u) => (isList(u) ? { body: listBody([{ order_sn: SN }]) } : { body: detailBody([SN], 155000) }));
    const s3 = await runShopeeSync({ tenantId, syncType: 'manual', days: 7 });
    const rows = await prisma.orders.findMany({ where: { tenant_id: tenantId, external_order_id: SN } });
    check(
      'T5: data sama -> Skip (tanpa perubahan); data berubah -> Update',
      s1.orders_created === 1 &&
        s2.orders_skipped === 1 &&
        s2.orders_updated === 0 &&
        s3.orders_updated === 1 &&
        s3.orders_skipped === 0 &&
        rows.length === 1,
      `buat=${s1.orders_created}, skip=${s2.orders_skipped}, update=${s3.orders_updated}`,
    );
    check(
      'T5: Skip benar-benar menyimpan nilai baru saat ada perubahan harga',
      Number(rows[0]?.total) === 155000,
      `total=${rows[0]?.total}`,
    );
    check(
      'T5: pembanding mengabaikan field volatil (synced_at/updated_at)',
      isSameOrderData({ total: 1000, synced_at: new Date(1), updated_at: new Date(1) }, { total: 1000, synced_at: new Date(2), updated_at: new Date(2) }) &&
        !isSameOrderData({ total: 1000 }, { total: 1001 }),
    );

    // =====================================================================
    // Regresi: perilaku default & rahasia
    // =====================================================================
    mockFetch((u) => (isList(u) ? { body: listBody([]) } : { body: detailBody([]) }));
    const def = await runShopeeSync({ tenantId, syncType: 'manual' });
    check(
      'Regresi: default tetap 7 hari / update_time dan ok_empty saat kosong',
      def.diagnostics.days === 7 &&
        def.diagnostics.time_range_field === 'update_time' &&
        def.api_status === 'ok_empty' &&
        def.status === 'success',
      `${def.diagnostics.days}/${def.diagnostics.time_range_field} ${def.status}/${def.api_status}`,
    );
    const logs = await prisma.channel_sync_logs.findMany({ where: { tenant_id: tenantId } });
    const acts = await prisma.activities.findMany({ where: { tenant_id: tenantId } });
    const blob = [...logs.map((l) => `${l.message}|${l.api_status}`), ...acts.map((a) => `${a.title}|${a.description}`)].join(' || ');
    check(
      'Keamanan: tidak ada partner key / token pada log & aktivitas',
      ![PARTNER_KEY, ACCESS_TOKEN, REFRESH_TOKEN].some((s) => blob.includes(s)),
      `${logs.length} log diperiksa`,
    );
  } finally {
    (globalThis as any).fetch = realFetch;
    await teardown(tenantId, channelId);
  }

  const left = await prisma.tenants.count({ where: { name: TENANT_NAME } });
  check('Data uji dibersihkan', left === 0);

  const failed = results.filter((r) => !r.ok);
  console.log('\n\u2500\u2500\u2500 Ringkasan \u2500\u2500\u2500');
  console.log(`${results.length - failed.length}/${results.length} lulus`);
  if (failed.length) {
    console.log('GAGAL:', failed.map((f) => f.name).join(' ; '));
    process.exit(1);
  }
  console.log('\ud83c\udf89 Semua uji ketahanan sinkronisasi Shopee lulus.');
}

main()
  .catch((e) => {
    console.error('Uji gagal:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
