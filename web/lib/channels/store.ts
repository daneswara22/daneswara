// Penyimpanan kanal penjualan + kredensialnya.
// ATURAN: fungsi di file ini adalah satu-satunya tempat token dibaca/ditulis.
// Tidak ada fungsi di sini yang mengembalikan token ke pemanggil HTTP.
import { prisma } from '../db';
import { newId } from '../http';
import { decryptSecret, encryptSecret } from '../crypto';
import { CHANNEL_LABEL, ChannelType } from './types';

export interface ChannelCreds {
  partnerId: string;
  partnerKey: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date | null;
  refreshExpiresAt: Date | null;
}

export async function getChannel(tenantId: string, type: ChannelType) {
  return prisma.sales_channels.findFirst({ where: { tenant_id: tenantId, type } });
}

export async function ensureChannel(tenantId: string, type: ChannelType) {
  const found = await getChannel(tenantId, type);
  if (found) return found;
  const now = new Date();
  return prisma.sales_channels.create({
    data: {
      id: newId(),
      tenant_id: tenantId,
      type,
      name: CHANNEL_LABEL[type] || type,
      status: 'disconnected',
      environment: 'sandbox',
      auto_sync: true,
      created_at: now,
      updated_at: now,
    },
  });
}

export async function listChannels(tenantId: string) {
  return prisma.sales_channels.findMany({ where: { tenant_id: tenantId }, orderBy: { created_at: 'asc' } });
}

export async function updateChannel(channelId: string, data: Record<string, any>) {
  return prisma.sales_channels.update({ where: { id: channelId }, data: { ...data, updated_at: new Date() } });
}

/** Ambil kredensial terdekripsi (server-side saja). */
export async function getCreds(channelId: string): Promise<ChannelCreds> {
  const row = await prisma.channel_credentials.findFirst({ where: { sales_channel_id: channelId } });
  return {
    partnerId: row?.partner_id || '',
    partnerKey: decryptSecret(row?.partner_key_enc),
    accessToken: decryptSecret(row?.access_token_enc),
    refreshToken: decryptSecret(row?.refresh_token_enc),
    expiresAt: row?.expires_at || null,
    refreshExpiresAt: row?.refresh_expires_at || null,
  };
}

async function upsertCreds(channelId: string, data: Record<string, any>) {
  const now = new Date();
  const existing = await prisma.channel_credentials.findFirst({ where: { sales_channel_id: channelId } });
  if (existing) {
    return prisma.channel_credentials.update({ where: { id: existing.id }, data: { ...data, updated_at: now } });
  }
  return prisma.channel_credentials.create({
    data: { id: newId(), sales_channel_id: channelId, ...data, created_at: now, updated_at: now },
  });
}

/** Simpan Partner ID / Partner Key (dari halaman admin). Key langsung dienkripsi. */
export async function savePartnerCreds(channelId: string, partnerId: string, partnerKey?: string) {
  const data: Record<string, any> = { partner_id: partnerId };
  if (partnerKey) data.partner_key_enc = encryptSecret(partnerKey);
  return upsertCreds(channelId, data);
}

/** Simpan/rotasi token. Selalu menimpa pasangan lama dalam satu operasi. */
export async function saveTokens(
  channelId: string,
  tokens: { accessToken: string; refreshToken: string; expiresIn?: number },
) {
  const now = Date.now();
  const expiresIn = Number(tokens.expiresIn) > 0 ? Number(tokens.expiresIn) : 4 * 3600;
  return upsertCreds(channelId, {
    access_token_enc: encryptSecret(tokens.accessToken),
    refresh_token_enc: encryptSecret(tokens.refreshToken),
    expires_at: new Date(now + expiresIn * 1000),
    refresh_expires_at: new Date(now + 30 * 24 * 3600 * 1000),
  });
}

export async function clearTokens(channelId: string) {
  return upsertCreds(channelId, {
    access_token_enc: null,
    refresh_token_enc: null,
    expires_at: null,
    refresh_expires_at: null,
  });
}

/** Bentuk aman untuk frontend: tidak ada token / partner key. */
export function channelPublicView(channel: any, creds?: ChannelCreds) {
  return {
    id: channel.id,
    type: channel.type,
    name: channel.name,
    status: channel.status,
    environment: channel.environment || 'sandbox',
    external_shop_id: channel.external_shop_id || '',
    shop_name: channel.shop_name || '',
    shop_region: channel.shop_region || '',
    auto_sync: !!channel.auto_sync,
    connected_at: channel.connected_at ? new Date(channel.connected_at).toISOString() : null,
    last_sync_at: channel.last_sync_at ? new Date(channel.last_sync_at).toISOString() : null,
    last_sync_status: channel.last_sync_status || null,
    last_error: channel.last_error || null,
    // hanya penanda konfigurasi, bukan nilainya
    partner_id: creds?.partnerId || '',
    has_partner_key: !!creds?.partnerKey,
    has_token: !!creds?.accessToken,
    token_expires_at: creds?.expiresAt ? new Date(creds.expiresAt).toISOString() : null,
  };
}
