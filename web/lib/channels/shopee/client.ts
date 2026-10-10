// Klien Shopee Open API v2 (server-side saja).
// Tanda tangan HMAC-SHA256 sesuai dokumentasi:
//   Public API : partner_id + api_path + timestamp
//   Shop API   : partner_id + api_path + timestamp + access_token + shop_id
// Tidak ada separator, api_path tanpa host, timestamp detik (Unix).
import crypto from 'node:crypto';

export interface ShopeeConfig {
  partnerId: string;
  partnerKey: string;
  environment: 'sandbox' | 'live';
}

export class ShopeeError extends Error {
  code: string;
  httpStatus: number;
  constructor(message: string, code = 'error', httpStatus = 502) {
    super(message);
    this.name = 'ShopeeError';
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

export function shopeeHosts(environment: string) {
  const live = String(environment) === 'live';
  return {
    api: live ? 'https://partner.shopeemobile.com' : 'https://openplatform.sandbox.test-stable.shopee.sg',
    auth: live ? 'https://open.shopee.com/auth' : 'https://open.sandbox.test-stable.shopee.com/auth',
  };
}

/** Basis URL publik produksi, dipakai bila tidak ada env yang menimpanya. */
export const DEFAULT_PUBLIC_BASE_URL = 'https://daneswara.com';

export const SHOPEE_CALLBACK_PATH = '/api/channels/shopee/oauth/callback';
export const SHOPEE_WEBHOOK_PATH = '/api/channels/shopee/webhook';

/**
 * Host yang TIDAK boleh dipakai sebagai URL callback/webhook: Shopee harus bisa
 * menjangkaunya dari internet. `0.0.0.0` dan `localhost` sering muncul karena
 * server mengikat ke semua antarmuka atau ada proxy di depannya, dan kalau ikut
 * terpakai, otorisasi gagal serta tanda tangan webhook tidak pernah cocok.
 */
function isUnreachableHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h === '::1' || h === '::') return true;
  if (h === '0.0.0.0' || h.startsWith('127.')) return true;
  if (h.startsWith('10.') || h.startsWith('192.168.')) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true;
  if (!h.includes('.') && h !== '::1') return true; // nama service internal, mis. "web"
  return false;
}

/**
 * Normalisasi kandidat base URL. Mengembalikan '' bila kosong, bukan http(s),
 * atau host-nya tidak bisa dijangkau Shopee. Host publik dipaksa https karena
 * Shopee Console menolak redirect/webhook non-TLS.
 */
function normalizeBase(candidate?: string | null): string {
  const raw = String(candidate || '').trim();
  if (!raw) return '';
  try {
    const u = new URL(raw);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return '';
    if (isUnreachableHost(u.hostname)) return '';
    return `https://${u.host}${u.pathname.replace(/\/$/, '')}`;
  } catch {
    return '';
  }
}

/**
 * Basis URL publik untuk redirect & webhook. Harus SAMA PERSIS dengan yang
 * didaftarkan di Shopee Console, karena tanda tangan webhook ikut memakainya.
 *
 * Urutan sumber: CHANNEL_PUBLIC_BASE_URL (khusus kanal penjualan) -> PUBLIC_BASE_URL
 * -> NEXT_PUBLIC_POS_URL -> origin permintaan (hanya kalau sudah publik) ->
 * DEFAULT_PUBLIC_BASE_URL. Origin yang menunjuk 0.0.0.0/localhost/IP privat
 * sengaja dibuang supaya tidak pernah tampil ke pengguna.
 */
export function callbackBase(origin?: string): string {
  const candidates = [
    process.env.CHANNEL_PUBLIC_BASE_URL,
    process.env.PUBLIC_BASE_URL,
    process.env.NEXT_PUBLIC_POS_URL,
    origin,
  ];
  for (const c of candidates) {
    const base = normalizeBase(c);
    if (base) return base;
  }
  return DEFAULT_PUBLIC_BASE_URL;
}

export function redirectUri(origin?: string): string {
  return `${callbackBase(origin)}${SHOPEE_CALLBACK_PATH}`;
}

export function webhookUrl(origin?: string): string {
  return `${callbackBase(origin)}${SHOPEE_WEBHOOK_PATH}`;
}

/**
 * Environment efektif. Nilai per-kanal dari database tetap jadi acuan, tapi
 * server bisa menimpanya lewat SHOPEE_ENVIRONMENT (`sandbox` / `live`) sehingga
 * perpindahan sandbox <-> produksi cukup ganti konfigurasi, tanpa ubah data.
 */
export function shopeeEnvironment(channelEnvironment?: string | null): 'sandbox' | 'live' {
  const override = String(process.env.SHOPEE_ENVIRONMENT || '').trim().toLowerCase();
  if (override === 'live' || override === 'production') return 'live';
  if (override === 'sandbox' || override === 'test') return 'sandbox';
  return String(channelEnvironment) === 'live' ? 'live' : 'sandbox';
}

function sign(cfg: ShopeeConfig, base: string): string {
  return crypto.createHmac('sha256', cfg.partnerKey).update(base).digest('hex');
}

export function publicSignature(cfg: ShopeeConfig, path: string) {
  const timestamp = Math.floor(Date.now() / 1000);
  return { timestamp, sign: sign(cfg, `${cfg.partnerId}${path}${timestamp}`) };
}

export function shopSignature(cfg: ShopeeConfig, path: string, accessToken: string, shopId: string) {
  const timestamp = Math.floor(Date.now() / 1000);
  return { timestamp, sign: sign(cfg, `${cfg.partnerId}${path}${timestamp}${accessToken}${shopId}`) };
}

/** Tanda tangan push/webhook: HMAC(url|raw_body). */
export function webhookSignature(partnerKey: string, callbackUrl: string, rawBody: string) {
  return crypto.createHmac('sha256', partnerKey).update(`${callbackUrl}|${rawBody}`).digest('hex');
}

/** URL otorisasi penjual (dibuat di server, state untuk anti-CSRF). */
export function buildAuthUrl(cfg: ShopeeConfig, redirectUri: string, state: string): string {
  const u = new URL(shopeeHosts(cfg.environment).auth);
  u.searchParams.set('partner_id', cfg.partnerId);
  u.searchParams.set('auth_type', 'seller');
  u.searchParams.set('redirect_uri', redirectUri);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('state', state);
  return u.toString();
}

// --- Throttling + retry -----------------------------------------------------
// Shopee membatasi kuota harian & rate per app. Semua request lewat satu antrean
// dengan jarak minimum, plus backoff eksponensial untuk rate limit / 5xx.
const MIN_INTERVAL_MS = 180;
let lastCall = 0;
let chain: Promise<unknown> = Promise.resolve();

function schedule<T>(fn: () => Promise<T>): Promise<T> {
  const run = async () => {
    const wait = Math.max(0, MIN_INTERVAL_MS - (Date.now() - lastCall));
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastCall = Date.now();
    return fn();
  };
  const next = chain.then(run, run);
  chain = next.catch(() => undefined);
  return next as Promise<T>;
}

const RETRYABLE = /rate_limit|error_server|error_timeout|too many/i;

async function request<T = any>(
  url: string,
  init: RequestInit,
  attempt = 0,
): Promise<T> {
  const res = await schedule(() => fetch(url, { ...init, cache: 'no-store' }));
  let json: any = null;
  const text = await res.text();
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { error: 'invalid_json', message: text.slice(0, 200) };
  }
  const errCode = String(json?.error || '');
  const retryable = (!res.ok && res.status >= 500) || (errCode && RETRYABLE.test(errCode));
  if (retryable && attempt < 3) {
    const delay = 500 * 2 ** attempt + Math.floor(Math.random() * 250);
    await new Promise((r) => setTimeout(r, delay));
    return request<T>(url, init, attempt + 1);
  }
  if (errCode) {
    throw new ShopeeError(json?.message || errCode, errCode, res.status || 502);
  }
  if (!res.ok) throw new ShopeeError(`Shopee HTTP ${res.status}`, 'http_error', res.status);
  return json as T;
}

function qs(params: Record<string, any>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    sp.set(k, String(v));
  }
  return sp.toString();
}

/** GET shop-level API. */
export async function shopGet<T = any>(
  cfg: ShopeeConfig,
  path: string,
  accessToken: string,
  shopId: string,
  params: Record<string, any> = {},
): Promise<T> {
  const { timestamp, sign: s } = shopSignature(cfg, path, accessToken, shopId);
  const url = `${shopeeHosts(cfg.environment).api}${path}?${qs({
    partner_id: cfg.partnerId,
    timestamp,
    access_token: accessToken,
    shop_id: shopId,
    sign: s,
    ...params,
  })}`;
  return request<T>(url, { method: 'GET' });
}

/** POST public API (token get / refresh). */
export async function publicPost<T = any>(cfg: ShopeeConfig, path: string, body: Record<string, any>): Promise<T> {
  const { timestamp, sign: s } = publicSignature(cfg, path);
  const url = `${shopeeHosts(cfg.environment).api}${path}?${qs({ partner_id: cfg.partnerId, timestamp, sign: s })}`;
  return request<T>(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// --- Endpoint yang dipakai --------------------------------------------------
export async function exchangeCodeForToken(cfg: ShopeeConfig, code: string, shopId: string) {
  const j = await publicPost(cfg, '/api/v2/auth/token/get', {
    code,
    partner_id: Number(cfg.partnerId),
    shop_id: Number(shopId),
  });
  if (!j?.access_token) throw new ShopeeError('Shopee tidak mengirim access token', 'no_token');
  return { accessToken: j.access_token, refreshToken: j.refresh_token, expiresIn: j.expire_in };
}

export async function refreshAccessToken(cfg: ShopeeConfig, refreshToken: string, shopId: string) {
  const j = await publicPost(cfg, '/api/v2/auth/access_token/get', {
    refresh_token: refreshToken,
    partner_id: Number(cfg.partnerId),
    shop_id: Number(shopId),
  });
  if (!j?.access_token) throw new ShopeeError('Gagal memperbarui access token Shopee', 'refresh_failed');
  return { accessToken: j.access_token, refreshToken: j.refresh_token || refreshToken, expiresIn: j.expire_in };
}

export async function getShopInfo(cfg: ShopeeConfig, accessToken: string, shopId: string) {
  return shopGet(cfg, '/api/v2/shop/get_shop_info', accessToken, shopId);
}

export const ORDER_DETAIL_FIELDS = [
  'buyer_user_id',
  'buyer_username',
  'estimated_shipping_fee',
  'recipient_address',
  'actual_shipping_fee',
  'note',
  'note_update_time',
  'item_list',
  'pay_time',
  'buyer_cancel_reason',
  'cancel_by',
  'cancel_reason',
  'actual_shipping_fee_confirmed',
  'package_list',
  'shipping_carrier',
  'payment_method',
  'total_amount',
  'invoice_data',
  'return_request_due_date',
  'payment_info',
].join(',');

/**
 * Daftar order pada satu jendela waktu (maks 15 hari per dokumentasi Shopee),
 * paginasi memakai cursor. order_status sengaja tidak dikirim = semua status.
 */
export async function getOrderList(
  cfg: ShopeeConfig,
  accessToken: string,
  shopId: string,
  opts: { timeFrom: number; timeTo: number; timeRangeField?: 'create_time' | 'update_time'; pageSize?: number },
): Promise<any[]> {
  const span = opts.timeTo - opts.timeFrom;
  if (span > 15 * 24 * 3600) throw new ShopeeError('Jendela waktu melebihi 15 hari', 'invalid_window', 400);
  const out: any[] = [];
  let cursor = '';
  for (let guard = 0; guard < 100; guard += 1) {
    const j: any = await shopGet(cfg, '/api/v2/order/get_order_list', accessToken, shopId, {
      time_range_field: opts.timeRangeField || 'update_time',
      time_from: opts.timeFrom,
      time_to: opts.timeTo,
      page_size: opts.pageSize || 100,
      cursor,
      response_optional_fields: 'order_status',
      request_order_status_pending: true,
    });
    const list = j?.response?.order_list || [];
    out.push(...list);
    if (!j?.response?.more) break;
    cursor = j?.response?.next_cursor || '';
    if (!cursor) break;
  }
  return out;
}

/** Detail order, maksimal 50 order_sn per permintaan. */
export async function getOrderDetail(
  cfg: ShopeeConfig,
  accessToken: string,
  shopId: string,
  orderSns: string[],
): Promise<any[]> {
  const out: any[] = [];
  for (let i = 0; i < orderSns.length; i += 50) {
    const batch = orderSns.slice(i, i + 50);
    const j: any = await shopGet(cfg, '/api/v2/order/get_order_detail', accessToken, shopId, {
      order_sn_list: batch.join(','),
      response_optional_fields: ORDER_DETAIL_FIELDS,
      request_order_status_pending: true,
    });
    out.push(...(j?.response?.order_list || []));
  }
  return out;
}
