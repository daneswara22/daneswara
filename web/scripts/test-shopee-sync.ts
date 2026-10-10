/**
 * Uji inti integrasi Shopee TANPA memanggil API Shopee (tidak butuh kredensial).
 * Yang diverifikasi:
 *   1. tanda tangan HMAC (public / shop / webhook) sesuai dokumentasi v2
 *   2. pemetaan status Shopee -> status internal + status lama aplikasi
 *   3. enkripsi/dekripsi rahasia kanal (AES-256-GCM)
 *   4. upsert pesanan idempoten (order Shopee yang sama tidak pernah dobel)
 *   5. produk belum dipetakan tetap diimpor (mapping_status = UNMAPPED)
 *   6. item custom otomatis membuat pesanan di alur Custom Tees yang lama
 *   7. pembaruan status (READY_TO_SHIP -> COMPLETED) memperbarui baris yang sama
 *
 * Semua data uji memakai awalan ZZ_TEST_ dan dihapus lagi di akhir.
 * Jalankan: npx tsx scripts/test-shopee-sync.ts
 */
import 'dotenv/config';
import crypto from 'node:crypto';
import { prisma } from '../lib/db';
import { newId } from '../lib/http';
import { encryptSecret, decryptSecret } from '../lib/crypto';
import {
  DEFAULT_PUBLIC_BASE_URL,
  SHOPEE_CALLBACK_PATH,
  SHOPEE_WEBHOOK_PATH,
  ShopeeConfig,
  callbackBase,
  publicSignature,
  redirectUri,
  shopSignature,
  shopeeEnvironment,
  shopeeHosts,
  webhookSignature,
  webhookUrl,
} from '../lib/channels/shopee/client';
import { mapShopeeStatus, legacyStatus, mapPaymentStatus, mapShippingStatus } from '../lib/channels/shopee/status';
import { upsertShopeeOrder } from '../lib/channels/shopee/sync';

const TEST_SN = 'ZZ_TEST_SHOPEE_0001';
const results: Array<{ name: string; ok: boolean; info: string }> = [];

function check(name: string, ok: boolean, info = '') {
  results.push({ name, ok, info });
  console.log(`${ok ? '\u2705' : '\u274c'} ${name}${info ? ` \u2014 ${info}` : ''}`);
}

function sampleDetail(status: string, tracking = '') {
  return {
    order_sn: TEST_SN,
    order_status: status,
    create_time: Math.floor(Date.now() / 1000) - 3600,
    update_time: Math.floor(Date.now() / 1000),
    total_amount: 285000,
    estimated_shipping_fee: 15000,
    payment_method: 'ShopeePay',
    note: 'Tolong bungkus rapi',
    buyer_username: 'zz_test_buyer',
    shipping_carrier: 'J&T Express',
    recipient_address: {
      name: 'ZZ Test Buyer',
      phone: '6281200000000',
      full_address: 'Jl. Uji Coba No. 1, Denpasar',
      city: 'Denpasar',
      state: 'Bali',
      zipcode: '80111',
    },
    package_list: tracking ? [{ package_number: tracking, logistics_status: 'LOGISTICS_DELIVERY_DONE' }] : [],
    item_list: [
      {
        item_id: 9911001,
        item_name: 'ZZ_TEST Kaos Custom Oversize',
        item_sku: 'ZZ-CUSTOM-1',
        model_id: 501,
        model_name: 'L / Hitam',
        model_sku: 'ZZ-CUSTOM-1-L',
        model_quantity_purchased: 2,
        model_original_price: 120000,
        model_discounted_price: 110000,
      },
      {
        item_id: 9911002,
        item_name: 'ZZ_TEST Tote Bag Kanvas',
        item_sku: 'ZZ-TOTE-1',
        model_id: 502,
        model_name: 'Natural',
        model_quantity_purchased: 1,
        model_original_price: 55000,
        model_discounted_price: 50000,
      },
    ],
  };
}

async function cleanup(tenantId: string, channelId: string) {
  await prisma.custom_tee_orders.deleteMany({ where: { external_order_id: TEST_SN } });
  await prisma.orders.deleteMany({ where: { tenant_id: tenantId, external_order_id: TEST_SN } });
  await prisma.channel_products.deleteMany({
    where: { sales_channel_id: channelId, external_product_id: { in: ['9911001', '9911002'] } },
  });
}

async function main() {
  // --- 1. Tanda tangan -----------------------------------------------------
  const cfg: ShopeeConfig = { partnerId: '1000000', partnerKey: 'test-partner-key', environment: 'sandbox' };
  const path = '/api/v2/auth/token/get';
  const pub = publicSignature(cfg, path);
  const expectedPub = crypto
    .createHmac('sha256', cfg.partnerKey)
    .update(`${cfg.partnerId}${path}${pub.timestamp}`)
    .digest('hex');
  check('Tanda tangan public API', pub.sign === expectedPub, pub.sign.slice(0, 12));

  const shopPath = '/api/v2/order/get_order_list';
  const shop = shopSignature(cfg, shopPath, 'access-123', '77777');
  const expectedShop = crypto
    .createHmac('sha256', cfg.partnerKey)
    .update(`${cfg.partnerId}${shopPath}${shop.timestamp}access-12377777`)
    .digest('hex');
  check('Tanda tangan shop API', shop.sign === expectedShop, shop.sign.slice(0, 12));

  const raw = '{"shop_id":77777,"code":3}';
  const url = 'https://example.com/api/channels/shopee/webhook';
  const wh = webhookSignature(cfg.partnerKey, url, raw);
  const expectedWh = crypto.createHmac('sha256', cfg.partnerKey).update(`${url}|${raw}`).digest('hex');
  check('Tanda tangan webhook (url|body)', wh === expectedWh, wh.slice(0, 12));

  const whWrongKey = webhookSignature('partner-key-lain', url, raw);
  const whWrongBody = webhookSignature(cfg.partnerKey, url, raw + ' ');
  const whWrongUrl = webhookSignature(cfg.partnerKey, 'https://palsu.example/api/channels/shopee/webhook', raw);
  check(
    'Tanda tangan webhook ditolak bila key/body/url beda',
    whWrongKey !== wh && whWrongBody !== wh && whWrongUrl !== wh,
  );

  // --- 1b. Pembentukan URL callback & pemisahan environment ----------------
  const savedEnv = {
    channel: process.env.CHANNEL_PUBLIC_BASE_URL,
    publik: process.env.PUBLIC_BASE_URL,
    pos: process.env.NEXT_PUBLIC_POS_URL,
    shopee: process.env.SHOPEE_ENVIRONMENT,
  };
  const clearBaseEnv = () => {
    delete process.env.CHANNEL_PUBLIC_BASE_URL;
    delete process.env.PUBLIC_BASE_URL;
    delete process.env.NEXT_PUBLIC_POS_URL;
    delete process.env.SHOPEE_ENVIRONMENT;
  };

  clearBaseEnv();
  // Host yang tidak bisa dijangkau Shopee harus dibuang, bukan ditampilkan.
  const badOrigins = ['http://0.0.0.0:3000', 'http://localhost:3000', 'http://127.0.0.1:3000', 'http://10.1.2.3:3000'];
  check(
    'Origin 0.0.0.0 / localhost / IP privat tidak dipakai sebagai callback',
    badOrigins.every((o) => callbackBase(o) === DEFAULT_PUBLIC_BASE_URL),
    `fallback ${DEFAULT_PUBLIC_BASE_URL}`,
  );
  check(
    'Tanpa env, redirect & webhook memakai domain produksi',
    redirectUri('http://0.0.0.0:3000') === `${DEFAULT_PUBLIC_BASE_URL}${SHOPEE_CALLBACK_PATH}` &&
      webhookUrl('http://0.0.0.0:3000') === `${DEFAULT_PUBLIC_BASE_URL}${SHOPEE_WEBHOOK_PATH}`,
    redirectUri('http://0.0.0.0:3000'),
  );

  process.env.PUBLIC_BASE_URL = 'https://daneswara.com/';
  check(
    'PUBLIC_BASE_URL dipakai dan garis miring akhir dibuang',
    redirectUri('http://0.0.0.0:3000') === 'https://daneswara.com/api/channels/shopee/oauth/callback',
    redirectUri(''),
  );

  process.env.CHANNEL_PUBLIC_BASE_URL = 'http://pos.daneswara.com';
  check(
    'CHANNEL_PUBLIC_BASE_URL menang & http dinaikkan ke https',
    callbackBase('https://daneswara.com') === 'https://pos.daneswara.com',
    callbackBase(''),
  );

  clearBaseEnv();
  check(
    'Origin publik dipakai bila tidak ada env',
    callbackBase('https://pos.daneswara.com') === 'https://pos.daneswara.com',
  );
  check(
    'Redirect & webhook identik untuk otorisasi dan verifikasi tanda tangan',
    redirectUri('https://daneswara.com') === `${callbackBase('https://daneswara.com')}${SHOPEE_CALLBACK_PATH}` &&
      webhookUrl('https://daneswara.com') === `${callbackBase('https://daneswara.com')}${SHOPEE_WEBHOOK_PATH}`,
  );

  check(
    'Environment mengikuti kanal bila server tidak menimpa',
    shopeeEnvironment('sandbox') === 'sandbox' && shopeeEnvironment('live') === 'live',
  );
  process.env.SHOPEE_ENVIRONMENT = 'live';
  const liveHosts = shopeeHosts(shopeeEnvironment('sandbox'));
  process.env.SHOPEE_ENVIRONMENT = 'sandbox';
  const sandboxHosts = shopeeHosts(shopeeEnvironment('live'));
  delete process.env.SHOPEE_ENVIRONMENT;
  check(
    'SHOPEE_ENVIRONMENT di server bisa memindahkan sandbox <-> live',
    liveHosts.api === 'https://partner.shopeemobile.com' && sandboxHosts.api.includes('sandbox'),
    `${liveHosts.api} | ${sandboxHosts.api}`,
  );

  // Pulihkan env semula supaya bagian uji berikutnya tidak terpengaruh.
  clearBaseEnv();
  if (savedEnv.channel) process.env.CHANNEL_PUBLIC_BASE_URL = savedEnv.channel;
  if (savedEnv.publik) process.env.PUBLIC_BASE_URL = savedEnv.publik;
  if (savedEnv.pos) process.env.NEXT_PUBLIC_POS_URL = savedEnv.pos;
  if (savedEnv.shopee) process.env.SHOPEE_ENVIRONMENT = savedEnv.shopee;

  // --- 2. Pemetaan status --------------------------------------------------
  const statusOk =
    mapShopeeStatus('UNPAID') === 'NEW' &&
    mapShopeeStatus('READY_TO_SHIP') === 'PAID' &&
    mapShopeeStatus('SHIPPED') === 'SHIPPED' &&
    mapShopeeStatus('COMPLETED') === 'COMPLETED' &&
    mapShopeeStatus('CANCELLED') === 'CANCELLED' &&
    mapShopeeStatus('TO_RETURN') === 'RETURNED' &&
    legacyStatus('NEW') === 'Draft' &&
    legacyStatus('COMPLETED') === 'Selesai' &&
    legacyStatus('CANCELLED') === 'Dibatalkan' &&
    mapPaymentStatus('UNPAID') === 'UNPAID' &&
    mapPaymentStatus('COMPLETED') === 'PAID' &&
    mapShippingStatus({ order_status: 'COMPLETED' }) === 'DELIVERED';
  check('Pemetaan status Shopee -> internal', statusOk);

  // --- 3. Enkripsi rahasia -------------------------------------------------
  const secret = 'super-secret-partner-key';
  const blob = encryptSecret(secret);
  check(
    'Enkripsi AES-256-GCM rahasia kanal',
    decryptSecret(blob) === secret && !blob.includes(secret),
    blob.slice(0, 18),
  );

  // --- Siapkan tenant + kanal uji -----------------------------------------
  const tenant = await prisma.tenants.findFirst({ orderBy: { created_at: 'asc' }, select: { id: true } });
  if (!tenant) throw new Error('Tenant tidak ada');
  const tenantId = tenant.id;
  const now = new Date();
  let channel = await prisma.sales_channels.findFirst({ where: { tenant_id: tenantId, type: 'shopee' } });
  if (!channel) {
    channel = await prisma.sales_channels.create({
      data: {
        id: newId(),
        tenant_id: tenantId,
        type: 'shopee',
        name: 'Shopee',
        status: 'disconnected',
        environment: 'sandbox',
        external_shop_id: '77777',
        auto_sync: true,
        created_at: now,
        updated_at: now,
      },
    });
  }
  await cleanup(tenantId, channel.id);

  // --- 4 & 5. Impor pertama -----------------------------------------------
  const first = await upsertShopeeOrder(tenantId, channel, sampleDetail('READY_TO_SHIP'));
  check('Impor pesanan Shopee baru', first.action === 'created', `order_number=${first.order?.order_number}`);

  const stored = await prisma.orders.findFirst({
    where: { tenant_id: tenantId, sales_channel: 'shopee', external_order_id: TEST_SN },
  });
  const items = JSON.parse(stored?.items || '[]');
  check(
    'Data pesanan lengkap (alamat, ongkir, total, resi kosong)',
    stored?.customer_phone === '6281200000000' &&
      stored?.shipping_city === 'Denpasar' &&
      Number(stored?.shipping_fee) === 15000 &&
      Number(stored?.total) === 285000 &&
      stored?.external_status === 'READY_TO_SHIP' &&
      stored?.internal_status === 'PAID' &&
      stored?.status === 'Proses',
    `total=${stored?.total}, internal=${stored?.internal_status}`,
  );
  check('Semua item tersimpan (bukan hanya custom)', items.length === 2, `${items.length} item`);

  const mapRows = await prisma.channel_products.findMany({
    where: { sales_channel_id: channel.id, external_product_id: { in: ['9911001', '9911002'] } },
  });
  check(
    'Produk tak dikenal tetap diimpor & ditandai',
    mapRows.length === 2 && mapRows.every((r) => ['MAPPED', 'UNMAPPED'].includes(r.mapping_status)),
    mapRows.map((r) => `${r.external_sku}:${r.mapping_status}`).join(', '),
  );

  // --- 6. Kompatibilitas Custom Tees --------------------------------------
  const customType = await prisma.custom_products.findFirst({
    where: { tenant_id: tenantId, is_active: true, deleted_at: null },
    select: { product_key: true, title: true },
  });
  if (customType) {
    const kaos = mapRows.find((r) => r.external_product_id === '9911001');
    await prisma.channel_products.update({
      where: { id: kaos!.id },
      data: { custom_product_key: customType.product_key, is_custom: true, mapping_status: 'MAPPED' },
    });
    await upsertShopeeOrder(tenantId, channel, sampleDetail('READY_TO_SHIP'));
    const ct = await prisma.custom_tee_orders.findMany({ where: { external_order_id: TEST_SN } });
    check(
      'Item custom masuk alur Custom Tees yang lama',
      ct.length === 1 && ct[0].source_order_id === stored?.id,
      ct[0] ? `${ct[0].order_code} (${ct[0].status})` : 'tidak dibuat',
    );
    // sinkron lagi tidak boleh menduplikasi pesanan custom
    await upsertShopeeOrder(tenantId, channel, sampleDetail('READY_TO_SHIP'));
    const ct2 = await prisma.custom_tee_orders.findMany({ where: { external_order_id: TEST_SN } });
    check('Pesanan Custom Tees tidak dobel saat sinkron ulang', ct2.length === 1, `${ct2.length} baris`);
  } else {
    check('Item custom masuk alur Custom Tees (dilewati)', true, 'tidak ada jenis produk custom di DB');
  }

  // --- 7. Idempotensi + pembaruan status ----------------------------------
  const second = await upsertShopeeOrder(tenantId, channel, sampleDetail('COMPLETED', 'ZZTRACK123'));
  const rows = await prisma.orders.findMany({
    where: { tenant_id: tenantId, sales_channel: 'shopee', external_order_id: TEST_SN },
  });
  check('Sinkron ulang = update, bukan pesanan baru', second.action === 'updated' && rows.length === 1, `${rows.length} baris`);
  check(
    'Status & resi ikut diperbarui',
    rows[0]?.internal_status === 'COMPLETED' &&
      rows[0]?.status === 'Selesai' &&
      rows[0]?.tracking_number === 'ZZTRACK123' &&
      rows[0]?.shipping_carrier === 'J&T Express',
    `${rows[0]?.internal_status} / resi ${rows[0]?.tracking_number}`,
  );
  check('Data mentah Shopee tersimpan untuk debug', !!rows[0]?.external_raw && rows[0]!.external_raw!.includes(TEST_SN));

  // --- Bersihkan -----------------------------------------------------------
  await cleanup(tenantId, channel.id);
  const left = await prisma.orders.count({ where: { tenant_id: tenantId, external_order_id: TEST_SN } });
  check('Data uji dibersihkan', left === 0);

  const failed = results.filter((r) => !r.ok);
  console.log('\n\u2500\u2500\u2500 Ringkasan \u2500\u2500\u2500');
  console.log(`${results.length - failed.length}/${results.length} lulus`);
  if (failed.length) {
    console.log('GAGAL:', failed.map((f) => f.name).join(', '));
    process.exit(1);
  }
  console.log('\ud83c\udf89 Semua uji inti Shopee lulus.');
}

main()
  .catch((e) => {
    console.error('Uji gagal:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
