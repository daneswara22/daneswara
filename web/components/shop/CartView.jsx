'use client';
/** Keranjang mobile: centang, ubah jumlah, hapus, lanjut checkout. */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Minus, Plus, Trash2, ShoppingCart } from 'lucide-react';
import { rupiah } from '@/lib/api';
import { cartUnitPrice } from '@/lib/shopCatalog';
import { getCart, updateItem, removeItem, selectAll, CART_EVENT } from '@/lib/shopCart';
import MobileTopBar from '@/components/shop/MobileTopBar';
import MobileBottomNav from '@/components/shop/MobileBottomNav';

export default function CartView() {
  const [items, setItems] = useState([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const sync = () => { setItems(getCart()); setReady(true); };
    sync();
    window.addEventListener(CART_EVENT, sync);
    return () => window.removeEventListener(CART_EVENT, sync);
  }, []);

  const chosen = items.filter((i) => i.selected);
  const total = chosen.reduce((a, i) => a + i.unitPrice * i.qty, 0);
  const allOn = items.length > 0 && chosen.length === items.length;

  const setQty = (item, next) => {
    const qty = Math.max(1, Math.floor(Number(next) || 1));
    // Harga satuan stiker turun mulai batas borongan, jadi dihitung ulang.
    updateItem(item.id, { qty, unitPrice: cartUnitPrice(item, qty) });
  };

  const optionText = (o = {}) => Object.values(o).filter(Boolean).join(' · ');

  return (
    <div className="min-h-screen bg-slate-50 pb-44" data-testid="cart-view">
      <MobileTopBar title={`Keranjang Saya (${items.length})`} cart={false} />

      {ready && items.length === 0 && (
        <div className="flex flex-col items-center gap-3 px-6 py-20 text-center" data-testid="cart-empty">
          <ShoppingCart size={44} className="text-slate-300" />
          <p className="text-[13px] text-slate-500">Keranjang masih kosong.</p>
          <Link href="/belanja" className="rounded-xl bg-blue-700 px-5 py-2.5 text-[13px] font-semibold text-white" data-testid="cart-shop-now">
            Mulai Belanja
          </Link>
        </div>
      )}

      <div className="space-y-2 px-3 pt-2">
        {items.map((i) => (
          <div key={i.id} className="rounded-xl border border-slate-200 bg-white p-3" data-testid={`cart-item-${i.slug}`}>
            {/* Baris atas: thumbnail & info tetap di kiri */}
            <div className="flex gap-3">
              <input
                type="checkbox"
                checked={!!i.selected}
                onChange={(e) => updateItem(i.id, { selected: e.target.checked })}
                data-testid={`cart-check-${i.slug}`}
                className="mt-1 h-[18px] w-[18px] shrink-0 accent-blue-700"
                aria-label={`Pilih ${i.name}`}
              />
              <img src={i.design || i.thumb} alt={i.name} className="h-[72px] w-[72px] shrink-0 rounded-lg bg-slate-100 object-cover" />
              <div className="min-w-0 flex-1">
                <div className="line-clamp-2 text-[13px] font-medium leading-snug text-slate-900">{i.name}</div>
                {optionText(i.options) && (
                  <div className="mt-1 inline-block max-w-full truncate rounded-md bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                    {optionText(i.options)}
                  </div>
                )}
                {i.designName && <div className="mt-1 truncate text-[11px] text-slate-400">Desain: {i.designName}</div>}
                <div className="mt-1.5 text-[15px] font-bold text-blue-700">{rupiah(i.unitPrice * i.qty)}</div>
              </div>
            </div>

            {/* Baris kontrol: satu baris penuh, tersebar rata, aman di layar sempit */}
            <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-slate-100 pt-2.5">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setQty(i, i.qty - 1)}
                  data-testid={`cart-minus-${i.slug}`}
                  className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-700"
                  aria-label="Kurangi"
                >
                  <Minus size={14} />
                </button>
                <span className="min-w-[30px] text-center text-[13px] font-semibold text-slate-900">{i.qty}</span>
                <button
                  type="button"
                  onClick={() => setQty(i, i.qty + 1)}
                  data-testid={`cart-plus-${i.slug}`}
                  className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-700"
                  aria-label="Tambah"
                >
                  <Plus size={14} />
                </button>
              </div>
              <span className="truncate text-[11px] text-slate-400">
                {rupiah(i.unitPrice)} / {i.unitLabel || 'pcs'}
              </span>
              <div className="flex items-center gap-1">
                <Link
                  href={`/belanja/${i.slug}`}
                  data-testid={`cart-edit-${i.slug}`}
                  className="rounded-md px-2 py-1.5 text-[12px] font-medium text-blue-700"
                >
                  Ubah
                </Link>
                <button
                  type="button"
                  onClick={() => removeItem(i.id)}
                  data-testid={`cart-remove-${i.slug}`}
                  className="rounded-md p-1.5 text-red-600"
                  aria-label="Hapus"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {items.length > 0 && (
        <div className="fixed bottom-[57px] left-0 right-0 z-50 border-t border-slate-200 bg-white px-3 py-2.5 md:left-1/2 md:right-auto md:w-full md:max-w-2xl md:-translate-x-1/2" data-testid="cart-action-bar">
          <div className="flex items-center gap-3">
            <label className="flex shrink-0 items-center gap-2 text-[12px] font-medium text-slate-700">
              <input
                type="checkbox"
                checked={allOn}
                onChange={(e) => selectAll(e.target.checked)}
                data-testid="cart-select-all"
                className="h-[18px] w-[18px] accent-blue-700"
              />
              Semua
            </label>
            <div className="flex-1 text-right">
              <div className="text-[11px] text-slate-500">Total</div>
              <div className="text-[15px] font-bold text-blue-700" data-testid="cart-total">{rupiah(total)}</div>
            </div>
            <Link
              href="/checkout"
              aria-disabled={chosen.length === 0}
              onClick={(e) => { if (chosen.length === 0) e.preventDefault(); }}
              data-testid="cart-checkout"
              className={`shrink-0 rounded-xl px-5 py-3 text-[13px] font-semibold text-white ${
                chosen.length === 0 ? 'pointer-events-none bg-slate-300' : 'bg-blue-700'
              }`}
            >
              Checkout ({chosen.length})
            </Link>
          </div>
        </div>
      )}

      <MobileBottomNav />
    </div>
  );
}
