/**
 * Chatroom pelanggan <-> admin.
 * ---------------------------------------------------------------------------
 * Identitas pelanggan memakai KODE TIKET (mis. `DNS-7KQ4M2`) supaya percakapan
 * bisa dilanjutkan dari perangkat lain tanpa perlu akun/login. Kode itulah
 * kuncinya, jadi dibuat acak (crypto) dengan alfabet tanpa huruf/angka yang
 * mirip (0/O, 1/I) supaya enak dibacakan lewat telepon.
 *
 * Realtime-nya pakai polling ringan (lihat komponen UI), bukan WebSocket,
 * karena lebih stabil di belakang ingress/proxy dan tidak butuh server khusus.
 */
import crypto from 'crypto';
import { prisma } from './db';
import { HttpError } from './http';

export const CHAT_STATUS = { OPEN: 'open', CLOSED: 'closed' } as const;
export const CHAT_SENDER = { CUSTOMER: 'customer', ADMIN: 'admin' } as const;

export const MAX_BODY_CHARS = 2000;
export const MAX_NAME_CHARS = 80;
export const MAX_CONTACT_CHARS = 120;

/* Alfabet tanpa 0/O/1/I/L supaya kode tiket tidak salah baca. */
const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const CODE_LEN = 6;

/** Bentuk kode tiket baru, mis. `DNS-7KQ4M2`. */
function randomTicketCode(): string {
  const bytes = crypto.randomBytes(CODE_LEN);
  let out = '';
  for (let i = 0; i < CODE_LEN; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return `DNS-${out}`;
}

/** Kode tiket unik untuk satu tenant (coba beberapa kali kalau kebetulan bentrok). */
export async function nextTicketCode(tenantId: string): Promise<string> {
  for (let i = 0; i < 12; i++) {
    const code = randomTicketCode();
    const exists = await prisma.chat_threads.findFirst({
      where: { tenant_id: tenantId, ticket_code: code },
      select: { id: true },
    });
    if (!exists) return code;
  }
  throw new HttpError(500, 'Gagal membuat kode tiket, coba lagi');
}

/** Samakan bentuk kode yang diketik pelanggan: huruf besar, boleh tanpa prefix. */
export function normalizeTicketCode(raw: string): string {
  const cleaned = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!cleaned) return '';
  const body = cleaned.startsWith('DNS') ? cleaned.slice(3) : cleaned;
  if (body.length !== CODE_LEN) return '';
  return `DNS-${body}`;
}

/** Rapikan teks pesan: buang spasi berlebih dan batasi panjangnya. */
export function cleanBody(raw: string): string {
  const body = String(raw || '').replace(/\r\n/g, '\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim();
  if (!body) throw new HttpError(400, 'Pesan tidak boleh kosong');
  if (body.length > MAX_BODY_CHARS) throw new HttpError(400, `Pesan maksimal ${MAX_BODY_CHARS} karakter`);
  return body;
}

export function cleanName(raw: string): string {
  const name = String(raw || '').trim().replace(/\s+/g, ' ');
  if (name.length < 2) throw new HttpError(400, 'Nama minimal 2 karakter');
  return name.slice(0, MAX_NAME_CHARS);
}

export function cleanContact(raw: string): string {
  const contact = String(raw || '').trim();
  if (contact.length < 5) throw new HttpError(400, 'Isi nomor WhatsApp atau email yang bisa dihubungi');
  return contact.slice(0, MAX_CONTACT_CHARS);
}

/** Cuplikan pesan terakhir untuk daftar percakapan admin. */
export function previewOf(body: string): string {
  return body.replace(/\s+/g, ' ').slice(0, 200);
}

/** Tenant untuk pengunjung publik (aplikasi ini single-tenant). */
export async function resolveChatTenantId(): Promise<string> {
  const t = await prisma.tenants.findFirst({ orderBy: { created_at: 'asc' }, select: { id: true } });
  if (!t) throw new HttpError(500, 'Tenant belum tersedia');
  return t.id;
}

export function serializeChatMessage(m: any) {
  return {
    id: m.id,
    sender: m.sender,
    sender_name: m.sender_name || '',
    body: m.body || '',
    created_at: m.created_at instanceof Date ? m.created_at.toISOString() : String(m.created_at),
  };
}

/** Bentuk data thread; sisi pelanggan tidak perlu tahu hitungan belum dibaca admin. */
export function serializeChatThread(t: any, opts: { forCustomer?: boolean } = {}) {
  const base = {
    id: t.id,
    ticket_code: t.ticket_code,
    customer_name: t.customer_name || '',
    status: t.status || CHAT_STATUS.OPEN,
    last_message_at: t.last_message_at instanceof Date ? t.last_message_at.toISOString() : String(t.last_message_at),
    last_message_preview: t.last_message_preview || '',
    last_sender: t.last_sender || CHAT_SENDER.CUSTOMER,
    created_at: t.created_at instanceof Date ? t.created_at.toISOString() : String(t.created_at),
  };
  if (opts.forCustomer) return { ...base, unread: Number(t.unread_customer || 0) };
  return {
    ...base,
    customer_contact: t.customer_contact || '',
    unread_admin: Number(t.unread_admin || 0),
    unread_customer: Number(t.unread_customer || 0),
  };
}

/** Ambil thread milik pelanggan berdasarkan kode tiket. */
export async function findThreadByCode(codeRaw: string) {
  const code = normalizeTicketCode(codeRaw);
  if (!code) throw new HttpError(400, 'Kode tiket tidak valid. Contoh yang benar: DNS-7KQ4M2');
  const tenantId = await resolveChatTenantId();
  const thread = await prisma.chat_threads.findFirst({ where: { tenant_id: tenantId, ticket_code: code } });
  if (!thread) throw new HttpError(404, 'Kode tiket tidak ditemukan. Cek lagi hurufnya ya.');
  return thread;
}
