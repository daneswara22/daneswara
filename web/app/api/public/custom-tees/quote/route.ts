import { NextRequest } from 'next/server';
import { handle, readBody } from '@/lib/handler';
import { customTeeQuoteSchema } from '@/lib/schemas';
import { normalizeSizeItems } from '@/lib/customTeeOrders';
import { quoteCustomTee } from '@/lib/customTeePricing';

export const dynamic = 'force-dynamic';

/**
 * POST /api/public/custom-tees/quote
 *
 * Estimasi harga untuk desainer Custom Tees. Publik (tanpa login) supaya
 * halaman `/custom` bisa menampilkan angka, tetapi perhitungannya tetap di
 * server sehingga harga tidak bisa dimanipulasi dari browser.
 *
 * Tidak menulis apa pun ke database.
 *
 * Body: { size_items: [{ size, qty }], size?, qty?, design?: { [sisi]: objek[] } }
 */
export const POST = handle(async (req: NextRequest) => {
  const data = customTeeQuoteSchema.parse(await readBody(req));
  const sizes = normalizeSizeItems(data.size_items, data.size, data.qty);

  // Untuk harga kita hanya butuh JUMLAH objek per sisi, bukan isi desainnya.
  const counts: Record<string, any[]> = {};
  for (const [view, layers] of Object.entries(data.design || {})) {
    counts[view] = Array.isArray(layers) ? layers : [];
  }

  return quoteCustomTee({ size_items: sizes.items, views: counts });
});
