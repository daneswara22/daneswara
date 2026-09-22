/**
 * Skema harga dasar Custom Tees.
 * ---------------------------------------------------------------------------
 * Dipakai oleh `POST /api/public/custom-tees/quote` supaya perhitungan harga
 * terjadi di server (tidak bisa diubah dari browser) dan angkanya konsisten
 * antara halaman publik `/custom` dan halaman admin `/custom-tees`.
 *
 * SEMUA ANGKA DI SINI BOLEH DIUBAH. Tiga cara, urut prioritas:
 *   1. ubah langsung konstanta di bawah, atau
 *   2. isi env `CUSTOM_TEE_PRICING_JSON` dengan JSON berisi sebagian kunci saja,
 *      contoh: CUSTOM_TEE_PRICING_JSON={"base_by_size":{"L":99000},"qty_tiers":[{"min_qty":24,"percent":12}]}
 *   3. panggil `quoteCustomTee(input, overrides)` dari kode lain.
 *
 * Angkanya adalah ESTIMASI: hasilnya selalu ditandai "estimasi" di UI dan CS
 * tetap mengonfirmasi harga final ke pelanggan.
 */

export type SizeItem = { size: string; qty: number };

export interface CustomTeePricing {
  currency: string;
  /** Harga kaos + jahit per pcs untuk tiap ukuran (rupiah). */
  base_by_size: Record<string, number>;
  /** Dipakai kalau ukuran tidak ada di `base_by_size`. */
  base_fallback: number;
  /** Biaya cetak per pcs untuk setiap sisi yang ada desainnya. */
  print_by_view: Record<string, number>;
  /** Dipakai kalau nama sisi tidak ada di `print_by_view`. */
  print_fallback: number;
  /** Biaya tambahan per objek desain, di luar objek pertama tiap sisi. */
  extra_object_fee: number;
  /** Batas objek per sisi yang belum dikenai `extra_object_fee`. */
  free_objects_per_view: number;
  /** Diskon bertingkat berdasarkan total pcs (dicek dari yang terbesar). */
  qty_tiers: { min_qty: number; percent: number }[];
  /** Minimal order dalam pcs. */
  min_qty: number;
  /** Biaya penanganan untuk order kecil (di bawah `small_order_below`). */
  small_order_fee: number;
  small_order_below: number;
  note: string;
}

export const CUSTOM_TEE_PRICING: CustomTeePricing = {
  currency: 'IDR',
  base_by_size: {
    S: 95000,
    M: 95000,
    L: 95000,
    XL: 95000,
    '2XL': 105000,
    '3XL': 115000,
    '4XL': 125000,
    '5XL': 135000,
  },
  base_fallback: 95000,
  print_by_view: {
    Depan: 25000,
    Belakang: 25000,
    'Lengan Kiri': 10000,
    'Lengan Kanan': 10000,
    Label: 7500,
  },
  print_fallback: 15000,
  extra_object_fee: 5000,
  free_objects_per_view: 2,
  qty_tiers: [
    { min_qty: 100, percent: 20 },
    { min_qty: 48, percent: 15 },
    { min_qty: 24, percent: 10 },
    { min_qty: 12, percent: 5 },
  ],
  min_qty: 1,
  small_order_fee: 15000,
  small_order_below: 3,
  note:
    'Harga ini estimasi otomatis. Harga final dikonfirmasi CS setelah desain diperiksa ' +
    '(tingkat kerumitan, jenis bahan, dan ongkos kirim bisa menyesuaikan).',
};

/** Gabungkan konstanta di atas dengan env `CUSTOM_TEE_PRICING_JSON` + override manual. */
export function resolvePricing(overrides?: Partial<CustomTeePricing>): CustomTeePricing {
  let fromEnv: Partial<CustomTeePricing> = {};
  const raw = process.env.CUSTOM_TEE_PRICING_JSON;
  if (raw) {
    try {
      fromEnv = JSON.parse(raw);
    } catch {
      console.warn('[custom-tee-pricing] CUSTOM_TEE_PRICING_JSON bukan JSON valid, diabaikan');
    }
  }
  const merged: CustomTeePricing = {
    ...CUSTOM_TEE_PRICING,
    ...fromEnv,
    ...overrides,
    base_by_size: { ...CUSTOM_TEE_PRICING.base_by_size, ...fromEnv.base_by_size, ...overrides?.base_by_size },
    print_by_view: { ...CUSTOM_TEE_PRICING.print_by_view, ...fromEnv.print_by_view, ...overrides?.print_by_view },
  };
  merged.qty_tiers = [...(merged.qty_tiers || [])].sort((a, b) => b.min_qty - a.min_qty);
  return merged;
}

export interface QuoteLine {
  label: string;
  detail: string;
  qty: number;
  unit_price: number;
  amount: number;
}

export interface CustomTeeQuote {
  currency: string;
  total_qty: number;
  lines: QuoteLine[];
  subtotal: number;
  discount_percent: number;
  discount_amount: number;
  small_order_fee: number;
  total: number;
  price_per_pcs: number;
  next_tier: { min_qty: number; percent: number; add_qty: number } | null;
  note: string;
}

const round = (n: number) => Math.round(n);

/**
 * Hitung estimasi harga.
 *
 * @param size_items  daftar ukuran + jumlah, mis. [{ size: 'L', qty: 12 }]
 * @param views       objek desain per sisi, mis. { Depan: [obj, obj], Belakang: [] }
 */
export function quoteCustomTee(
  input: { size_items: SizeItem[]; views?: Record<string, any[]> },
  overrides?: Partial<CustomTeePricing>,
): CustomTeeQuote {
  const p = resolvePricing(overrides);
  const items = (input.size_items || []).filter((it) => it && it.qty > 0);
  const totalQty = items.reduce((a, it) => a + it.qty, 0);

  const lines: QuoteLine[] = [];

  // 1) Kaos per ukuran
  for (const it of items) {
    const unit = p.base_by_size[it.size] ?? p.base_fallback;
    lines.push({
      label: `Kaos ukuran ${it.size}`,
      detail: `${it.qty} pcs x ${unit.toLocaleString('id-ID')}`,
      qty: it.qty,
      unit_price: unit,
      amount: unit * it.qty,
    });
  }

  // 2) Cetak per sisi yang dipakai (dikali total pcs)
  const views = input.views && typeof input.views === 'object' ? input.views : {};
  for (const [view, layers] of Object.entries(views)) {
    const count = Array.isArray(layers) ? layers.length : 0;
    if (count === 0) continue;
    const unit = p.print_by_view[view] ?? p.print_fallback;
    lines.push({
      label: `Cetak sisi ${view}`,
      detail: `${count} objek - ${totalQty} pcs x ${unit.toLocaleString('id-ID')}`,
      qty: totalQty,
      unit_price: unit,
      amount: unit * totalQty,
    });
    const extra = Math.max(0, count - p.free_objects_per_view);
    if (extra > 0 && p.extra_object_fee > 0) {
      lines.push({
        label: `Objek tambahan sisi ${view}`,
        detail: `${extra} objek x ${totalQty} pcs x ${p.extra_object_fee.toLocaleString('id-ID')}`,
        qty: totalQty,
        unit_price: p.extra_object_fee * extra,
        amount: p.extra_object_fee * extra * totalQty,
      });
    }
  }

  const subtotal = round(lines.reduce((a, l) => a + l.amount, 0));

  const tier = p.qty_tiers.find((t) => totalQty >= t.min_qty);
  const discountPercent = tier?.percent || 0;
  const discountAmount = round((subtotal * discountPercent) / 100);

  const smallOrderFee = totalQty > 0 && totalQty < p.small_order_below ? p.small_order_fee : 0;
  const total = Math.max(0, subtotal - discountAmount + smallOrderFee);

  const upcoming = [...p.qty_tiers].reverse().find((t) => t.min_qty > totalQty);

  return {
    currency: p.currency,
    total_qty: totalQty,
    lines,
    subtotal,
    discount_percent: discountPercent,
    discount_amount: discountAmount,
    small_order_fee: smallOrderFee,
    total,
    price_per_pcs: totalQty > 0 ? round(total / totalQty) : 0,
    next_tier: upcoming
      ? { min_qty: upcoming.min_qty, percent: upcoming.percent, add_qty: upcoming.min_qty - totalQty }
      : null,
    note: p.note,
  };
}
