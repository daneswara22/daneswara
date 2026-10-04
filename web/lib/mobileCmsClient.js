'use client';
/**
 * Util bersama halaman Mobile Platform Management.
 *
 * Drag & drop memakai HTML5 Drag and Drop API bawaan browser (tanpa dependency
 * baru). Setiap daftar yang bisa diurutkan juga tetap punya tombol naik/turun,
 * supaya urutan masih bisa diubah di perangkat sentuh dan lewat keyboard.
 */
import { useRef, useState } from 'react';

export const STATUS_OPTIONS = [
  { value: 'active', label: 'Active', tone: 'bg-emerald-100 text-emerald-700' },
  { value: 'draft', label: 'Draft', tone: 'bg-slate-200 text-slate-700' },
  { value: 'hidden', label: 'Hidden', tone: 'bg-amber-100 text-amber-700' },
  { value: 'out_of_stock', label: 'Out of Stock', tone: 'bg-rose-100 text-rose-700' },
];

export const SORT_OPTIONS = [
  { value: 'manual', label: 'Urutan Manual (drag & drop)' },
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'price_asc', label: 'Price Low → High' },
  { value: 'price_desc', label: 'Price High → Low' },
  { value: 'name_asc', label: 'Name A → Z' },
  { value: 'name_desc', label: 'Name Z → A' },
];

export const statusTone = (v) =>
  STATUS_OPTIONS.find((s) => s.value === v)?.tone || 'bg-slate-200 text-slate-700';

export const statusLabel = (v) => STATUS_OPTIONS.find((s) => s.value === v)?.label || v;

export const rp = (n) => `Rp ${Number(n || 0).toLocaleString('id-ID', { maximumFractionDigits: 0 })}`;

/** Profit & margin, rumus sama dengan server (lib/mobileCms.ts). */
export function profitOf(price, cost) {
  const p = Number(price) || 0;
  const c = Number(cost) || 0;
  const profit = p - c;
  return { profit, margin: p > 0 ? Math.round((profit / p) * 1000) / 10 : 0 };
}

/** Pindahkan satu elemen array tanpa merusak array aslinya. */
export function moveItem(list, from, to) {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/**
 * Hook drag & drop sederhana untuk daftar vertikal/grid.
 * onReorder(newList) dipanggil setelah item dilepas.
 */
export function useDragSort(list, onReorder) {
  const dragIndex = useRef(null);
  const [overIndex, setOverIndex] = useState(null);

  const handlers = (index) => ({
    draggable: true,
    onDragStart: (e) => {
      dragIndex.current = index;
      // Wajib di Firefox supaya event drop ikut terpicu.
      try {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(index));
      } catch {
        /* sebagian browser melarang akses dataTransfer di sini */
      }
    },
    onDragOver: (e) => {
      e.preventDefault();
      if (overIndex !== index) setOverIndex(index);
    },
    onDragLeave: () => setOverIndex((v) => (v === index ? null : v)),
    onDrop: (e) => {
      e.preventDefault();
      const from = dragIndex.current;
      dragIndex.current = null;
      setOverIndex(null);
      if (from == null || from === index) return;
      onReorder(moveItem(list, from, index));
    },
    onDragEnd: () => {
      dragIndex.current = null;
      setOverIndex(null);
    },
    'aria-grabbed': dragIndex.current === index ? 'true' : 'false',
  });

  const dropClass = (index) =>
    overIndex === index ? 'ring-2 ring-primary ring-offset-1 ring-offset-background' : '';

  return { handlers, dropClass };
}
