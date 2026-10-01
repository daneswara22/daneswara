'use client';
/**
 * Helper katalog mobile di sisi klien.
 *
 * TIDAK ADA harga produk di file ini. Seluruh data (harga dasar, ukuran, warna,
 * biaya printing, harga stiker) diambil dari GET /api/public/shop-catalog yang
 * membacanya dari database.
 */
import { useEffect, useState } from 'react';
import api from '@/lib/api';

/** Harga satuan sesuai pilihan. Rumusnya sama dengan yang dipakai server. */
export function unitPrice(product, opts = {}, qty = 1) {
  if (!product) return 0;
  if (product.kind === 'sticker') {
    const q = Math.max(1, Math.floor(Number(qty) || 1));
    const min = product.bulkMin ?? Infinity;
    return q >= min ? product.base - (product.bulkDiscount || 0) : product.base;
  }
  let total = Number(product.base) || 0;
  total += (product.prints || []).find((x) => x.v === opts.print)?.add || 0;
  total += (product.sizes || []).find((x) => x.v === opts.size)?.add || 0;
  return total;
}

/** Harga satuan termurah, untuk label "Mulai dari" di daftar produk. */
export const startingPrice = (p) =>
  p?.prints?.length ? p.base + Math.min(...p.prints.map((x) => x.add)) : Number(p?.base) || 0;

/** Hitung ulang harga satuan item keranjang tanpa perlu memuat katalog. */
export function cartUnitPrice(item, qty) {
  const q = Math.max(1, Math.floor(Number(qty) || 1));
  if (item.kind === 'sticker' && item.bulkMin) {
    return q >= item.bulkMin ? item.basePrice - (item.bulkDiscount || 0) : item.basePrice;
  }
  return item.unitPrice;
}

let cache = null;

export function useShopCatalog() {
  const [items, setItems] = useState(cache || []);
  const [loading, setLoading] = useState(!cache);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    api
      .get('/public/shop-catalog')
      .then(({ data }) => {
        if (!alive) return;
        cache = data.items || [];
        setItems(cache);
      })
      .catch(() => alive && setError('Gagal memuat katalog produk'))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  return { items, loading, error };
}
