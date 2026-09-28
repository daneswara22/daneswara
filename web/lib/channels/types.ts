// Definisi generik "Sales Channel". Menambah marketplace baru = tambah entri di
// CHANNEL_TYPES + adapter di lib/channels/<type>/, tanpa mengubah sistem pesanan.

export type ChannelType = 'manual' | 'website' | 'shopee' | 'tokopedia' | 'tiktok' | 'lazada' | 'other';

export interface ChannelTypeDef {
  type: ChannelType;
  name: string;
  /** true = sudah ada adapter API-nya */
  supported: boolean;
  description: string;
}

export const CHANNEL_TYPES: ChannelTypeDef[] = [
  { type: 'manual', name: 'Manual / Toko', supported: true, description: 'Pesanan dari POS & kasir toko' },
  { type: 'website', name: 'Website', supported: true, description: 'Pesanan dari desainer Custom Tees di website' },
  { type: 'shopee', name: 'Shopee', supported: true, description: 'Sinkronisasi pesanan Shopee Seller lewat Shopee Open API v2' },
  { type: 'tokopedia', name: 'Tokopedia', supported: false, description: 'Belum tersedia' },
  { type: 'tiktok', name: 'TikTok Shop', supported: false, description: 'Belum tersedia' },
  { type: 'lazada', name: 'Lazada', supported: false, description: 'Belum tersedia' },
];

export const CHANNEL_LABEL: Record<string, string> = CHANNEL_TYPES.reduce(
  (acc, c) => ({ ...acc, [c.type]: c.name }),
  {} as Record<string, string>,
);

/** Status internal kanonik (tidak tergantung istilah marketplace). */
export const INTERNAL_STATUSES = [
  'NEW',
  'PAID',
  'PROCESSING',
  'PRODUCTION',
  'READY_TO_PACK',
  'PACKED',
  'SHIPPED',
  'COMPLETED',
  'CANCELLED',
  'RETURNED',
] as const;

export type InternalStatus = (typeof INTERNAL_STATUSES)[number];

/**
 * Jembatan ke status lama aplikasi (Draft / Proses / Selesai / Dibatalkan)
 * supaya dashboard, laporan, dan alur POS yang sudah ada tidak berubah.
 */
export const LEGACY_STATUS_BY_INTERNAL: Record<InternalStatus, string> = {
  NEW: 'Draft',
  PAID: 'Proses',
  PROCESSING: 'Proses',
  PRODUCTION: 'Proses',
  READY_TO_PACK: 'Proses',
  PACKED: 'Proses',
  SHIPPED: 'Proses',
  COMPLETED: 'Selesai',
  CANCELLED: 'Dibatalkan',
  RETURNED: 'Dibatalkan',
};

export const INTERNAL_STATUS_LABEL: Record<InternalStatus, string> = {
  NEW: 'Baru',
  PAID: 'Dibayar',
  PROCESSING: 'Diproses',
  PRODUCTION: 'Produksi',
  READY_TO_PACK: 'Siap Dikemas',
  PACKED: 'Dikemas',
  SHIPPED: 'Dikirim',
  COMPLETED: 'Selesai',
  CANCELLED: 'Dibatalkan',
  RETURNED: 'Dikembalikan',
};

export const MAPPING_STATUSES = ['MAPPED', 'UNMAPPED', 'IGNORED'] as const;
