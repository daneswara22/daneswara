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

export const DOUBLE_SIDE = 'Depan + Belakang';
export const PRINT_SIDES = ['Depan', 'Belakang', DOUBLE_SIDE];

const findPrint = (product, v) => (product?.prints || []).find((x) => x.v === v) || null;

/**
 * Rincian biaya printing sesuai sisi yang dipilih.
 * Diskon dua sisi hanya berlaku kalau kedua sisi benar-benar dicetak.
 */
export function printBreakdown(product, opts = {}) {
  if (!product?.prints?.length) return { front: null, back: null, add: 0, discount: 0 };
  if (opts.side !== DOUBLE_SIDE) {
    const one = findPrint(product, opts.print);
    return { front: one, back: null, add: one?.add || 0, discount: 0 };
  }
  const front = findPrint(product, opts.print);
  const back = findPrint(product, opts.print2);
  const raw = (front?.add || 0) + (back?.add || 0);
  const discount = front?.add > 0 && back?.add > 0 ? product.doubleDiscount || 0 : 0;
  return { front, back, add: Math.max(0, raw - discount), discount };
}

/** Harga satuan sesuai pilihan. Rumusnya sama dengan yang dipakai server. */
export function unitPrice(product, opts = {}, qty = 1) {
  if (!product) return 0;
  if (product.kind === 'sticker') {
    const q = Math.max(1, Math.floor(Number(qty) || 1));
    const min = product.bulkMin ?? Infinity;
    return q >= min ? product.base - (product.bulkDiscount || 0) : product.base;
  }
  let total = Number(product.base) || 0;
  total += printBreakdown(product, opts).add;
  total += (product.sizes || []).find((x) => x.v === opts.size)?.add || 0;
  return total;
}

/** Mockup kombinasi dua sisi, kalau tersedia. */
export function pairMockup(product, opts = {}) {
  if (opts.side !== DOUBLE_SIDE) return null;
  const a = findPrint(product, opts.print);
  const b = findPrint(product, opts.print2);
  if (!a?.id || !b?.id) return null;
  return product.pairMockups?.[[a.id, b.id].sort().join('+')] || null;
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
