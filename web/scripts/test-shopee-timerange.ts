/**
 * Uji TERARAH untuk create_time / update_time dan batas jendela waktu sinkron
 * Shopee. Semua panggilan Shopee DIPALSUKAN lewat override global.fetch:
 * tidak ada jaringan, tidak ada kredensial asli, kredensial Sandbox yang
 * tersimpan tidak disentuh.
 *
 * Berkas ini hanya MEMBACA perilaku kode; tidak ada perubahan kode sumber.
 * Beberapa pemeriksaan sengaja MENDOKUMENTASIKAN batasan yang ditemukan
 * (ditandai "TEMUAN") supaya perilakunya tercatat, bukan diklaim benar.
 *
 * Jalankan: npx tsx scripts/test-shopee-timerange.ts
 */
import 'dotenv/config';
import { prisma } from '../lib/db';
import { newId } from '../lib/http';
import { savePartnerCreds, saveTokens } from '../lib/channels/store';
import { SHOPEE_MAX_WINDOW_SECONDS } from '../lib/channels/shopee/client';
import { runShopeeSync } from '../lib/channels/shopee/sync';

const TENANT_NAME = 'ZZ_TEST_SHOPEE_TIMERANGE';
const SHOP_ID = '880099';
const PARTNER_ID = '2000002';
const PARTNER_KEY = 'ZZ_TEST_PK_timerange';
const ACCESS_TOKEN = 'ZZ_TEST_AT_timerange';
const REFRESH_TOKEN = 'ZZ_TEST_RT_timerange';

const results: Array<{ name: string; ok: boolean; info: string }> = [];
const findings: string[] = [];

function check(name: string, ok: boolean, info = '') {
  results.push({ name, ok, info });
  console.log(`${ok ? '\u2705' : '\u274c'} ${name}${info ? ` \u2014 ${info}` : ''}`);
}
function note(text: string) {
  findings.push(text);
  console.log(`\u2139\ufe0f  TEMUAN: ${text}`);
}

const realFetch = globalThis.fetch;
let calls: URL[] = [];

function mockFetch(handler: (url: URL, index: number) => { status?: number; body: any }) {
  calls = [];
  (globalThis as any).fetch = async (input: any) => {
    const url = new URL(String(input));
    const r = handler(url, calls.length);
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
  request_id: 'req-1',
  response: { order_list: orders, more, next_cursor: nextCursor },
});

const detailBody = (sns: string[]) => ({
  error: '',
  message: '',
  request_id: 'req-2',
  response: {
    order_list: sns.map((sn) => ({
      order_sn: sn,
      order_status: 'READY_TO_SHIP',
      create_time: Math.floor(Date.now() / 1000) - 7200,
      update_time: Math.floor(Date.now() / 1000),
      total_amount: 99000,
      estimated_shipping_fee: 9000,
      payment_method: 'ShopeePay',
      buyer_username: 'zz_test_buyer',
      recipient_address: { name: 'ZZ Test', phone: '08000000', full_address: 'Jl. Uji 2', city: 'Denpasar' },
      item_list: [
        {
          item_id: 7101,
          item_name: 'ZZ_TEST Kaos',
          item_sku: 'ZZ-KAOS-1',
          model_id: 2,
          model_quantity_purchased: 2,
          model_original_price: 50000,
          model_discounted_price: 45000,
        },
      ],
    })),
  },
});

const isList = (u: URL) => u.pathname.endsWith('/order/get_order_list');
const listCalls = () => calls.filter(isList);
const p = (u: URL, k: string) => u.searchParams.get(k) || '';

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

async function main() {
  const { tenantId, channelId } = await setup();
  try {
    // ---- 1. create_time vs update_time sampai ke parameter API -----------
    mockFetch(() => ({ body: listBody([]) }));
    const upd = await runShopeeSync({ tenantId, syncType: 'manual', days: 7 });
    check(
      'Default (tanpa parameter) memakai update_time di request Shopee',
      listCalls().every((u) => p(u, 'time_range_field') === 'update_time') && upd.diagnostics.time_range_field === 'update_time',
      p(listCalls()[0], 'time_range_field'),
    );

    mockFetch(() => ({ body: listBody([]) }));
    const crt = await runShopeeSync({ tenantId, syncType: 'manual', days: 7, timeRangeField: 'create_time' });
    check(
      'create_time diteruskan apa adanya ke parameter time_range_field',
      listCalls().every((u) => p(u, 'time_range_field') === 'create_time') && crt.diagnostics.time_range_field === 'create_time',
      p(listCalls()[0], 'time_range_field'),
    );
    check(
      'create_time tidak mengubah panjang rentang (7 hari tetap 7 hari)',
      crt.diagnostics.time_to - crt.diagnostics.time_from === 7 * 24 * 3600 && crt.diagnostics.days === 7,
    );

    mockFetch(() => ({ body: listBody([]) }));
    const bogus = await runShopeeSync({ tenantId, syncType: 'manual', days: 7, timeRangeField: 'paid_time' as any });
    check(
      'Nilai time_range_field asing diturunkan ke update_time, tidak diteruskan ke Shopee',
      bogus.diagnostics.time_range_field === 'update_time' &&
        listCalls().every((u) => p(u, 'time_range_field') === 'update_time'),
      bogus.diagnostics.time_range_field,
    );

    // ---- 2. Batas awal/akhir jendela waktu -------------------------------
    mockFetch(() => ({ body: listBody([]) }));
    const long = await runShopeeSync({ tenantId, syncType: 'backfill', days: 90, timeRangeField: 'create_time' });
    const wins = listCalls().map((u) => ({ from: Number(p(u, 'time_from')), to: Number(p(u, 'time_to')) }));
    check(
      'Jendela pertama mulai tepat di batas awal rentang',
      wins[0]?.from === long.diagnostics.time_from,
      `${wins[0]?.from} vs ${long.diagnostics.time_from}`,
    );
    check(
      'Jendela terakhir berhenti tepat di batas akhir rentang (tidak melewati sekarang)',
      wins[wins.length - 1]?.to === long.diagnostics.time_to,
      `${wins[wins.length - 1]?.to} vs ${long.diagnostics.time_to}`,
    );
    check(
      'Setiap jendela yang dikirim <= 15 hari (batas resmi Shopee)',
      wins.every((w) => w.to - w.from > 0 && w.to - w.from <= SHOPEE_MAX_WINDOW_SECONDS),
      `maks ${Math.max(...wins.map((w) => w.to - w.from))}s`,
    );
    const gaps = wins.slice(1).map((w, i) => w.from - wins[i].to);
    check(
      'Jendela berurutan tanpa celah DAN tanpa tumpang tindih (selisih tepat 1 detik)',
      gaps.every((g) => g === 1),
      `selisih antar jendela: ${gaps.join(', ')}`,
    );
    check(
      '90 hari terbagi jadi 6 jendela berurutan',
      long.diagnostics.windows === wins.length && wins.length === 6,
      `jendela=${long.diagnostics.windows}`,
    );

    // ---- 3. Timestamp & timezone ----------------------------------------
    const nowEpoch = Math.floor(Date.now() / 1000);
    check(
      'Timestamp dikirim sebagai epoch detik UTC, bukan string tanggal lokal',
      wins.every((w) => Number.isInteger(w.from) && Number.isInteger(w.to) && Math.abs(w.to - nowEpoch) < 95 * 24 * 3600),
    );
    const logRow = await prisma.channel_sync_logs.findFirst({ where: { id: long.log_id } });
    const msg = String(logRow?.message || '');
    check('Keterangan log memuat acuan tanggal yang dipakai', msg.includes('create_time'), msg.slice(0, 48));
    if (msg.includes('T') && msg.includes('Z')) {
      note(
        'Rentang pada keterangan log dicetak dalam UTC (ISO ...Z) sementara aplikasi memakai TIMEZONE=Asia/Makassar. ' +
          'Angka epoch yang dikirim ke Shopee benar, tapi jamnya bisa membingungkan saat dibandingkan dengan Shopee Seller Centre (WITA).',
      );
    }

    // ---- 4. Rentang kosong vs berisi, dengan create_time ----------------
    mockFetch(() => ({ body: listBody([]) }));
    const emptyCreate = await runShopeeSync({ tenantId, syncType: 'manual', days: 7, timeRangeField: 'create_time' });
    check(
      'create_time + rentang kosong -> ok_empty & success (bukan gagal)',
      emptyCreate.api_status === 'ok_empty' && emptyCreate.status === 'success' && emptyCreate.orders_checked === 0,
      `${emptyCreate.status}/${emptyCreate.api_status}`,
    );

    const SN = 'ZZ_TEST_TR_0001';
    mockFetch((u) => (isList(u) ? { body: listBody([{ order_sn: SN }]) } : { body: detailBody([SN]) }));
    const filled = await runShopeeSync({ tenantId, syncType: 'manual', days: 7, timeRangeField: 'create_time' });
    check(
      'create_time + ada pesanan -> ok & pesanan terbuat',
      filled.api_status === 'ok' && filled.orders_created === 1 && filled.orders_checked === 1,
      `${filled.status}/${filled.api_status}`,
    );

    // ---- 5. Idempotensi upsert -------------------------------------------
    mockFetch((u) => (isList(u) ? { body: listBody([{ order_sn: SN }]) } : { body: detailBody([SN]) }));
    const again = await runShopeeSync({ tenantId, syncType: 'manual', days: 7, timeRangeField: 'create_time' });
    const rows = await prisma.orders.count({ where: { tenant_id: tenantId, external_order_id: SN } });
    check(
      'Sinkron ulang bersifat idempoten: tetap 1 baris, tidak dibuat ulang',
      rows === 1 && again.orders_created === 0 && again.orders_updated + again.orders_skipped === 1,
      `baris=${rows}, update=${again.orders_updated}, tanpa ubah=${again.orders_skipped}`,
    );

    // order_sn yang sama muncul dua kali dalam satu respons daftar
    mockFetch((u) =>
      isList(u) ? { body: listBody([{ order_sn: SN }, { order_sn: SN }]) } : { body: detailBody([SN]) },
    );
    const dup = await runShopeeSync({ tenantId, syncType: 'manual', days: 7 });
    const rows2 = await prisma.orders.count({ where: { tenant_id: tenantId, external_order_id: SN } });
    check(
      'order_sn ganda dalam satu respons di-dedupe (mentah 2, unik 1, tetap 1 baris)',
      dup.diagnostics.raw_orders === 2 && dup.diagnostics.unique_order_sns === 1 && rows2 === 1,
      `mentah=${dup.diagnostics.raw_orders}, unik=${dup.diagnostics.unique_order_sns}`,
    );

    // ---- 6. Lebih dari satu halaman -------------------------------------
    const SNS = ['ZZ_TEST_TR_P1', 'ZZ_TEST_TR_P2', 'ZZ_TEST_TR_P3'];
    mockFetch((u, i) => {
      if (!isList(u)) return { body: detailBody(SNS) };
      const page = calls.filter(isList).length;
      if (page === 0) return { body: listBody([{ order_sn: SNS[0] }], true, 'cur-1') };
      if (page === 1) return { body: listBody([{ order_sn: SNS[1] }], true, 'cur-2') };
      return { body: listBody([{ order_sn: SNS[2] }], false, '') };
    });
    const paged = await runShopeeSync({ tenantId, syncType: 'manual', days: 7, timeRangeField: 'create_time' });
    const lc = listCalls();
    check(
      '3 halaman cursor diikuti: pages=3, cursor berurutan, 3 pesanan terbuat',
      paged.diagnostics.pages === 3 &&
        p(lc[0], 'cursor') === '' &&
        p(lc[1], 'cursor') === 'cur-1' &&
        p(lc[2], 'cursor') === 'cur-2' &&
        paged.orders_created === 3,
      `pages=${paged.diagnostics.pages}, dibuat=${paged.orders_created}`,
    );
    check(
      'Semua halaman memakai acuan tanggal & rentang yang sama',
      lc.every((u) => p(u, 'time_range_field') === 'create_time' && p(u, 'time_from') === p(lc[0], 'time_from')),
    );

    // ---- 7. more=true tanpa next_cursor ---------------------------------
    mockFetch((u) => (isList(u) ? { body: listBody([{ order_sn: 'ZZ_TEST_TR_X' }], true, '') } : { body: detailBody([]) }));
    const badCursor = await runShopeeSync({ tenantId, syncType: 'manual', days: 7, timeRangeField: 'create_time' });
    check(
      'more=true tanpa next_cursor -> failed/invalid_cursor, tidak diklaim lengkap',
      badCursor.status === 'failed' && badCursor.api_status === 'invalid_cursor' && badCursor.orders_created === 0,
      `${badCursor.status}/${badCursor.api_status}`,
    );

    // ---- 8. Kegagalan API di tengah rentang panjang ----------------------
    // Jendela ke-2 dibuat gagal PERMANEN (dikenali dari time_from), supaya
    // retry error_server tidak menyelamatkannya dan isolasi per jendela teruji.
    let baseFrom = 0;
    mockFetch((u) => {
      if (!isList(u)) return { body: detailBody(['ZZ_TEST_TR_W0', 'ZZ_TEST_TR_W2']) };
      const from = Number(p(u, 'time_from'));
      if (!baseFrom) baseFrom = from;
      const idx = Math.round((from - baseFrom) / (SHOPEE_MAX_WINDOW_SECONDS + 1));
      if (idx === 1) return { body: { error: 'error_server', message: 'jendela 2 gagal terus' } };
      return { body: listBody([{ order_sn: `ZZ_TEST_TR_W${idx}` }]) };
    });
    const midFail = await runShopeeSync({ tenantId, syncType: 'backfill', days: 45, timeRangeField: 'create_time' });
    const savedWin = await prisma.orders.count({
      where: { tenant_id: tenantId, external_order_id: { startsWith: 'ZZ_TEST_TR_W' } },
    });
    check(
      'Kegagalan permanen jendela ke-2 diisolasi: jendela lain tetap tersimpan, status partial',
      midFail.status === 'partial' &&
        midFail.api_status === 'error_server' &&
        midFail.diagnostics.windows === 2 &&
        midFail.diagnostics.windows_planned === 3 &&
        midFail.diagnostics.failed_windows.length === 1 &&
        midFail.diagnostics.failed_windows[0].index === 2 &&
        savedWin === 2,
      `${midFail.status}/${midFail.api_status}, jendela=${midFail.diagnostics.windows}/${midFail.diagnostics.windows_planned}, tersimpan=${savedWin}`,
    );

    // ---- 9. Kegagalan pengambilan detail --------------------------------
    const many = Array.from({ length: 60 }, (_, i) => `ZZ_TEST_TR_B${String(i).padStart(2, '0')}`);
    mockFetch((u) => {
      if (isList(u)) return { body: listBody(many.map((sn) => ({ order_sn: sn }))) };
      const detailCall = calls.filter((c) => !isList(c)).length;
      // Batch pertama sukses (50), batch kedua (10) gagal total.
      if (detailCall === 0) return { body: detailBody(many.slice(0, 50)) };
      return { body: { error: 'error_server', message: 'batch 2 gagal' } };
    });
    const batchFail = await runShopeeSync({ tenantId, syncType: 'manual', days: 7, timeRangeField: 'create_time' });
    const savedBatch = await prisma.orders.count({ where: { tenant_id: tenantId, external_order_id: { startsWith: 'ZZ_TEST_TR_B' } } });
    check(
      'Kegagalan batch detail ke-2 TIDAK membuang hasil batch ke-1 (50 tersimpan, status partial)',
      batchFail.status === 'partial' &&
        batchFail.api_status === 'error_server' &&
        savedBatch === 50 &&
        batchFail.orders_created === 50 &&
        batchFail.orders_detail_missing === 10 &&
        batchFail.diagnostics.failed_detail_batches.length === 1,
      `${batchFail.status}/${batchFail.api_status}, tersimpan=${savedBatch}, hilang=${batchFail.orders_detail_missing}`,
    );

    // Detail sebagian hilang (bukan error API)
    mockFetch((u) =>
      isList(u)
        ? { body: listBody([{ order_sn: 'ZZ_TEST_TR_M1' }, { order_sn: 'ZZ_TEST_TR_M2' }]) }
        : { body: detailBody(['ZZ_TEST_TR_M1']) },
    );
    const miss = await runShopeeSync({ tenantId, syncType: 'manual', days: 7, timeRangeField: 'create_time' });
    check(
      'Detail tidak kembali -> orders_detail_missing terpisah, pesanan lain tetap tersimpan',
      miss.orders_detail_missing === 1 && miss.orders_created === 1 && miss.orders_skipped === 0 && miss.status === 'partial',
      `detail_hilang=${miss.orders_detail_missing}, dibuat=${miss.orders_created}, status=${miss.status}`,
    );

    // ---- 10. Rahasia tidak tercatat -------------------------------------
    const logs = await prisma.channel_sync_logs.findMany({ where: { tenant_id: tenantId } });
    const blob = logs.map((l) => `${l.message}|${l.api_status}`).join(' || ');
    check(
      'Tidak ada partner key / token pada keterangan log',
      ![PARTNER_KEY, ACCESS_TOKEN, REFRESH_TOKEN].some((s) => blob.includes(s)),
      `${logs.length} baris log`,
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
  if (findings.length) {
    console.log(`\n${findings.length} temuan terdokumentasi:`);
    findings.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
  }
  if (failed.length) {
    console.log('GAGAL:', failed.map((f) => f.name).join(', '));
    process.exit(1);
  }
  console.log('\n\ud83c\udf89 Semua pemeriksaan rentang waktu Shopee lulus.');
}

main()
  .catch((e) => {
    console.error('Uji gagal:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
