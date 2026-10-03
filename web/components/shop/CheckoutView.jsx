'use client';
/**
 * Checkout mobile.
 *
 * TIDAK membuat sistem pesanan/pembayaran baru. Isi keranjang dikirim ke
 * endpoint publik yang SUDAH dipakai hari ini:
 *   - item sticker -> POST /api/public/sticker-orders   (alur Custom Sticker)
 *   - item lainnya -> POST /api/public/custom-tees/orders (alur Custom Tees)
 * Keduanya menyimpan pesanan berstatus "Baru" lalu CS mengonfirmasi, sama
 * seperti alur Custom Sticker di halaman /custom-sticker.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { CheckCircle2 } from 'lucide-react';
import api, { rupiah } from '@/lib/api';
import { getCart, clearSelected, addOrders, CART_EVENT } from '@/lib/shopCart';
import MobileTopBar from '@/components/shop/MobileTopBar';

const optionText = (o = {}) => Object.values(o).filter(Boolean).join(' · ');

/** Catatan gabungan: pilihan varian ikut tersimpan walau bukan kolom tabel. */
function buildNote(item) {
  const parts = [];
  if (optionText(item.options)) parts.push(optionText(item.options));
  if (item.designName) parts.push(`Desain: ${item.designName}`);
  if (item.note) parts.push(item.note);
  return parts.join(' | ').slice(0, 2000);
}

export default function CheckoutView() {
  const [items, setItems] = useState([]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(null);

  useEffect(() => {
    const sync = () => setItems(getCart().filter((i) => i.selected));
    sync();
    window.addEventListener(CART_EVENT, sync);
    return () => window.removeEventListener(CART_EVENT, sync);
  }, []);

  const total = items.reduce((a, i) => a + i.unitPrice * i.qty, 0);

  const submit = async () => {
    if (!name.trim() || !phone.trim()) return toast.error('Nama & nomor WhatsApp wajib diisi');
    if (items.length === 0) return toast.error('Belum ada produk dipilih');
    setSaving(true);
    try {
      const codes = [];
      for (const item of items) {
        const common = { customer_name: name.trim(), customer_phone: phone.trim() };
        const itemNote = [buildNote(item), note.trim()].filter(Boolean).join(' | ').slice(0, 2000);

        if (item.kind === 'sticker') {
          const { data } = await api.post('/public/sticker-orders', {
            ...common,
            material: item.material,
            sheets: item.qty,
            note: itemNote,
            preview: item.design || null,
            layout: { mode: 'upload', template: 'upload', per_sheet: null, source: 'mobile-shop' },
          });
          codes.push({ code: data.order_code, name: item.name, total: item.unitPrice * item.qty });
        } else {
          const { data } = await api.post('/public/custom-tees/orders', {
            ...common,
            product_key: item.productKey || item.slug,
            product_title: item.productTitle || item.name,
            size: item.options?.size || '-',
            qty: item.qty,
            color_name: item.options?.color || '-',
            color_hex: item.colorHex || '#ffffff',
            note: itemNote,
            design: item.design ? { Depan: [{ type: 'image', src: item.design, x: 0, y: 0, w: 0, h: 0 }] } : null,
          });
          codes.push({ code: data.order_code, name: item.name, total: item.unitPrice * item.qty });
        }
      }
      addOrders(codes.map((c) => ({ ...c, at: new Date().toISOString() })));
      clearSelected();
      setDone(codes);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal mengirim pesanan');
    } finally {
      setSaving(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen bg-slate-50" data-testid="checkout-done">
        <MobileTopBar title="Pesanan Terkirim" back={false} cart={false} />
        <div className="px-4 py-10 text-center">
          <CheckCircle2 size={56} className="mx-auto text-blue-700" />
          <h2 className="mt-3 text-[17px] font-semibold text-slate-900">Pesanan berhasil dikirim</h2>
          <p className="mt-1.5 text-[13px] leading-relaxed text-slate-600">
            CS kami akan menghubungi nomor {phone} untuk konfirmasi desain, harga final, dan pembayaran.
          </p>
          <div className="mt-5 space-y-2 text-left">
            {done.map((c) => (
              <div key={c.code} className="rounded-xl border border-slate-200 bg-white p-3" data-testid={`done-order-${c.code}`}>
                <div className="text-[13px] font-semibold text-slate-900">{c.name}</div>
                <div className="mt-0.5 text-[12px] text-slate-500">Kode: {c.code}</div>
                <div className="mt-1 text-[14px] font-bold text-blue-700">{rupiah(c.total)}</div>
              </div>
            ))}
          </div>
          <div className="mt-6 flex gap-2">
            <Link href="/pesanan-saya" className="flex-1 rounded-xl border border-blue-700 bg-white py-3 text-[13px] font-semibold text-blue-700" data-testid="done-orders">
              Lihat Pesanan
            </Link>
            <Link href="/belanja" className="flex-1 rounded-xl bg-blue-700 py-3 text-[13px] font-semibold text-white" data-testid="done-shop">
              Belanja Lagi
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-32" data-testid="checkout-view">
      <MobileTopBar title="Checkout" cart={false} />

      <section className="mt-2 bg-white px-4 py-4">
        <div className="text-[12px] font-semibold text-slate-900">Data Pemesan</div>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nama lengkap"
          data-testid="checkout-name"
          className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-[13px] text-slate-900 placeholder:text-slate-400"
        />
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          inputMode="tel"
          placeholder="Nomor WhatsApp"
          data-testid="checkout-phone"
          className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-[13px] text-slate-900 placeholder:text-slate-400"
        />
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="Catatan untuk seluruh pesanan (opsional)"
          data-testid="checkout-note"
          className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-[13px] text-slate-900 placeholder:text-slate-400"
        />
      </section>

      <section className="mt-2 bg-white px-4 py-4">
        <div className="text-[12px] font-semibold text-slate-900">Ringkasan ({items.length} produk)</div>
        <div className="mt-3 space-y-3">
          {items.map((i) => (
            <div key={i.id} className="flex gap-3" data-testid={`checkout-item-${i.slug}`}>
              <img src={i.design || i.thumb} alt={i.name} className="h-14 w-14 shrink-0 rounded-lg bg-slate-100 object-cover" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-medium text-slate-900">{i.name}</div>
                <div className="text-[11px] text-slate-500">
                  {optionText(i.options) || '-'} · {i.qty} {i.unitLabel || 'pcs'}
                </div>
              </div>
              <div className="text-[13px] font-semibold text-slate-900">{rupiah(i.unitPrice * i.qty)}</div>
            </div>
          ))}
          {items.length === 0 && (
            <p className="text-[13px] text-slate-500" data-testid="checkout-empty">
              Belum ada produk dipilih. <Link href="/keranjang" className="font-semibold text-blue-700">Buka keranjang</Link>
            </p>
          )}
        </div>
      </section>

      <p className="px-4 pt-4 text-[11px] leading-relaxed text-slate-500">
        Harga di atas estimasi. Setelah pesanan dikirim, CS mengonfirmasi desain, harga final, dan cara pembayaran
        melalui WhatsApp — sama seperti alur pesanan Custom Sticker.
      </p>

      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white px-3 py-2.5 md:left-1/2 md:right-auto md:w-full md:max-w-2xl md:-translate-x-1/2" data-testid="checkout-action-bar">
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-[11px] text-slate-500">Total estimasi</span>
          <span className="text-[16px] font-bold text-blue-700" data-testid="checkout-total">{rupiah(total)}</span>
        </div>
        <button
          type="button"
          onClick={submit}
          disabled={saving || items.length === 0}
          data-testid="checkout-submit"
          className="w-full rounded-xl bg-blue-700 py-3 text-[13px] font-semibold text-white disabled:bg-slate-300"
        >
          {saving ? 'Mengirim…' : 'Kirim Pesanan'}
        </button>
      </div>
    </div>
  );
}
