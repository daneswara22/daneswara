// Harga Custom Sticker per lembar (sudah termasuk print + cut setengah putus).
// Pembelian 6 lembar atau lebih: harga per lembar dikurangi Rp 2.000.
export const STICKER_MATERIALS = [
  { value: 'BONTAX', label: 'BONTAX', price: 15000 },
  { value: 'VINYL', label: 'VINYL (Waterproof)', price: 25000 },
] as const;

export const STICKER_BULK_MIN = 6;
export const STICKER_BULK_DISCOUNT = 2000;

export function stickerUnitPrice(material: string, sheets: number): number {
  const m = STICKER_MATERIALS.find((x) => x.value === material);
  if (!m) return 0;
  const qty = Number(sheets) || 0;
  return qty >= STICKER_BULK_MIN ? m.price - STICKER_BULK_DISCOUNT : m.price;
}

export function stickerTotalPrice(material: string, sheets: number): number {
  const qty = Math.max(0, Math.floor(Number(sheets) || 0));
  return stickerUnitPrice(material, qty) * qty;
}

export const STICKER_STATUSES = ['Baru', 'Proses', 'Selesai', 'Batal'] as const;
