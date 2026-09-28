// Enkripsi simetris untuk rahasia kanal penjualan (partner key, access token,
// refresh token). AES-256-GCM (authenticated) supaya isi DB tidak bisa dipakai
// kalau dumpnya bocor, dan tidak pernah dikirim balik ke frontend.
//
// Kunci diambil dari CHANNEL_ENC_KEY (64 hex) kalau ada; kalau tidak,
// diturunkan dari JWT_SECRET supaya tidak perlu env baru di produksi.
import crypto from 'node:crypto';
import { env } from './env';

const PREFIX = 'v1';

function encKey(): Buffer {
  const raw = (process.env.CHANNEL_ENC_KEY || '').trim();
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, 'hex');
  return crypto.createHash('sha256').update(`daneswara-channel::${raw || env.JWT_SECRET}`).digest();
}

/** Enkripsi teks rahasia. Hasil: "v1:<iv>:<tag>:<ciphertext>" (hex). */
export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encKey(), iv);
  const ct = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [PREFIX, iv.toString('hex'), tag.toString('hex'), ct.toString('hex')].join(':');
}

/** Dekripsi; mengembalikan '' kalau format/kunci tidak cocok (tidak melempar). */
export function decryptSecret(blob?: string | null): string {
  if (!blob) return '';
  const parts = String(blob).split(':');
  if (parts.length !== 4 || parts[0] !== PREFIX) return '';
  try {
    const [, ivHex, tagHex, ctHex] = parts;
    const decipher = crypto.createDecipheriv('aes-256-gcm', encKey(), Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    return Buffer.concat([decipher.update(Buffer.from(ctHex, 'hex')), decipher.final()]).toString('utf8');
  } catch {
    return '';
  }
}

/** Untuk UI: hanya menandakan rahasia sudah terpasang, tanpa membocorkan isi. */
export function maskSecret(plain?: string | null): string {
  const s = String(plain || '');
  if (!s) return '';
  return `••••••••${s.slice(-4)}`;
}
