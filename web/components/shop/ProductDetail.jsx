'use client';
/** Detail produk mobile: galeri, pilihan varian, harga dinamis, aksi sticky. */
import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Minus, Plus, Upload, X } from 'lucide-react';
import { rupiah } from '@/lib/api';
import { unitPrice, printBreakdown, pairMockup, PRINT_SIDES, DOUBLE_SIDE } from '@/lib/shopCatalog';
import { addToCart } from '@/lib/shopCart';
import MobileTopBar from '@/components/shop/MobileTopBar';

const MAX_UPLOAD = 2_500_000; // ~2,5 MB sebelum di-encode base64

export default function ProductDetail({ product }) {
  const router = useRouter();
  const fileRef = useRef(null);
  const [imgIdx, setImgIdx] = useState(0);
  const [side, setSide] = useState('Depan');
  const [print, setPrint] = useState(product.prints?.[0]?.v || '');
  const [print2, setPrint2] = useState(product.prints?.[1]?.v || product.prints?.[0]?.v || '');
  const [size, setSize] = useState(product.sizes?.[0]?.v || '');
  const [color, setColor] = useState(product.colors?.[0]?.v || '');
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState('');
  const [design, setDesign] = useState(null);
  const [designName, setDesignName] = useState('');

  const gallery = product.gallery?.length ? product.gallery : [product.thumb];
  const twoSided = side === DOUBLE_SIDE;
  const options = useMemo(
    () => ({
      ...(product.prints?.length ? { side } : {}),
      print,
      ...(twoSided ? { print2 } : {}),
      size,
      color,
    }),
    [product.prints, side, print, print2, twoSided, size, color],
  );
  const breakdown = printBreakdown(product, options);
  // Dua sisi: tampilkan mockup kombinasi yang sudah ada di /price-list.
  const comboMockup = pairMockup(product, options);
  const mainImage = comboMockup || gallery[imgIdx] || product.thumb;
  const unit = unitPrice(product, options, qty);
  const total = unit * qty;
  const unitLabel = product.unitLabel || 'pcs';

  const onPickFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) return toast.error('File harus berupa gambar');
    if (file.size > MAX_UPLOAD) return toast.error('Ukuran gambar maksimal 2,5 MB');
    const reader = new FileReader();
    reader.onload = () => {
      setDesign(String(reader.result || ''));
      setDesignName(file.name);
    };
    reader.onerror = () => toast.error('Gagal membaca file');
    reader.readAsDataURL(file);
  };

  const build = () => ({
    slug: product.slug,
    kind: product.kind,
    name: product.name,
    thumb: product.thumb,
    material: product.material || null,
    productKey: product.productKey || null,
    productTitle: product.productTitle || product.name,
    unitLabel,
    basePrice: product.base,
    bulkMin: product.bulkMin || null,
    bulkDiscount: product.bulkDiscount || 0,
    colorHex: product.colors?.find((c) => c.v === color)?.hex || '#ffffff',
    unitPrice: unit,
    qty,
    note: note.trim(),
    design,
    designName,
    // Ikut membawa sisi printing & opsi sisi belakang supaya tersimpan di pesanan.
    options,
  });

  const onAdd = () => {
    addToCart(build());
    toast.success('Ditambahkan ke keranjang');
  };

  const onBuyNow = () => {
    addToCart(build());
    router.push('/keranjang');
  };

  const chip = (on) =>
    `rounded-lg border px-3 py-2 text-[12px] font-medium transition ${
      on ? 'border-blue-700 bg-blue-50 text-blue-800' : 'border-slate-200 bg-white text-slate-700'
    }`;

  return (
    <div className="min-h-screen bg-slate-50 pb-32 md:pb-12" data-testid={`product-detail-${product.slug}`}>
      <MobileTopBar title={product.name} maxWidth="md:max-w-xl lg:max-w-5xl" />

      {/* Tablet: satu kolom terpusat. Desktop (lg+): dua kolom, galeri menetap di kiri. */}
      <div className="md:mx-auto md:max-w-xl md:px-6 md:py-6 lg:grid lg:max-w-5xl lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] lg:items-start lg:gap-6">
        {/* Galeri */}
        <div className="bg-white lg:sticky lg:top-[88px] md:overflow-hidden md:rounded-2xl md:border md:border-slate-200">
        <img src={mainImage} alt={product.name} className="aspect-square w-full bg-slate-100 object-cover" />
        {gallery.length > 1 && (
          <div className="flex gap-2 overflow-x-auto px-3 py-2.5">
            {gallery.map((g, i) => (
              <button
                type="button"
                key={g}
                onClick={() => setImgIdx(i)}
                data-testid={`gallery-thumb-${i}`}
                className={`dp-soft h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2 ${i === imgIdx ? 'border-blue-700' : 'border-slate-200'}`}
              >
                <img src={g} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}
        </div>

        {/* Kolom kanan: informasi, pilihan, dan aksi */}
        <div className="md:space-y-4 lg:min-w-0">

      {/* Opsi printing bergambar: data, mockup, dan harga sama dengan /price-list */}
      {product.prints?.length > 0 && (
        <section className="mt-2 bg-white py-3 md:mt-0 md:rounded-2xl md:border md:border-slate-200" data-testid="print-thumb-row">
          {/* Sisi yang dicetak */}
          <div className="px-4 pb-2 text-[12px] font-semibold text-slate-900">Sisi Printing</div>
          <div className="flex gap-2 overflow-x-auto px-4 pb-3">
            {PRINT_SIDES.map((sv) => (
              <button
                type="button"
                key={sv}
                onClick={() => setSide(sv)}
                data-testid={`opt-side-${sv}`}
                aria-pressed={side === sv}
                className={`shrink-0 rounded-lg border px-3 py-2 text-[12px] font-medium ${
                  side === sv ? 'border-blue-700 bg-blue-50 text-blue-800' : 'border-slate-200 bg-white text-slate-700'
                }`}
              >
                {sv}
              </button>
            ))}
          </div>

          <PrintPicker
            label={twoSided ? 'Printing Sisi Depan' : `Printing ${side}`}
            prints={product.prints}
            value={print}
            onChange={setPrint}
            testPrefix="print-thumb"
            fallbackThumb={product.thumb}
          />

          {twoSided && (
            <PrintPicker
              label="Printing Sisi Belakang"
              prints={product.prints}
              value={print2}
              onChange={setPrint2}
              testPrefix="print-thumb-back"
              fallbackThumb={product.thumb}
            />
          )}

          {/* Rincian biaya printing */}
          <div className="mx-4 mt-3 rounded-xl bg-slate-50 p-3 text-[12px]" data-testid="print-breakdown">
            <Row label={twoSided ? `Depan: ${print}` : `${side}: ${print}`} value={rupiah(breakdown.front?.add || 0)} />
            {twoSided && <Row label={`Belakang: ${print2}`} value={rupiah(breakdown.back?.add || 0)} />}
            {breakdown.discount > 0 && (
              <Row
                label="Diskon dua sisi"
                value={`-${rupiah(breakdown.discount)}`}
                tone="text-green-700"
                testId="print-discount"
              />
            )}
            <div className="mt-1.5 flex items-center justify-between border-t border-slate-200 pt-1.5 font-semibold text-slate-900">
              <span>Biaya printing</span>
              <span data-testid="print-total">{rupiah(breakdown.add)}</span>
            </div>
          </div>
        </section>
      )}

      {/* Harga + nama */}
      <section className="mt-2 bg-white px-4 py-4 md:mt-0 md:rounded-2xl md:border md:border-slate-200">
        <div className="text-[24px] font-bold leading-none text-blue-700" data-testid="detail-price">{rupiah(unit)}</div>
        <div className="mt-1 text-[11px] text-slate-500">per {unitLabel}</div>
        <h2 className="mt-2 text-[15px] font-semibold leading-snug text-slate-900">{product.name}</h2>
        <p className="mt-1.5 text-[13px] leading-relaxed text-slate-600">{product.desc}</p>
        {product.bulkNote && <p className="mt-2 rounded-lg bg-blue-50 px-3 py-2 text-[12px] text-blue-800">{product.bulkNote}</p>}
      </section>

      {/* Pilihan */}
      <section className="mt-2 space-y-5 bg-white px-4 py-4 md:mt-0 md:rounded-2xl md:border md:border-slate-200">
        {product.sizes && (
          <div>
            <div className="mb-2 text-[12px] font-semibold text-slate-900">Ukuran</div>
            <div className="flex flex-wrap gap-2">
              {product.sizes.map((o) => (
                <button type="button" key={o.v} onClick={() => setSize(o.v)} className={chip(size === o.v)} data-testid={`opt-size-${o.v}`}>
                  {o.v}
                </button>
              ))}
            </div>
          </div>
        )}

        {product.colors && (
          <div>
            <div className="mb-2 text-[12px] font-semibold text-slate-900">Warna</div>
            <div className="flex flex-wrap gap-2">
              {product.colors.map((o) => (
                <button
                  type="button"
                  key={o.v}
                  onClick={() => setColor(o.v)}
                  data-testid={`opt-color-${o.v}`}
                  className={`flex items-center gap-2 ${chip(color === o.v)}`}
                >
                  <span className="h-4 w-4 rounded-full border border-slate-300" style={{ background: o.hex }} />
                  {o.v}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Jumlah */}
        <div>
          <div className="mb-2 text-[12px] font-semibold text-slate-900">Jumlah ({unitLabel})</div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              data-testid="qty-minus"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-700"
            >
              <Minus size={15} />
            </button>
            <input
              value={qty}
              onChange={(e) => setQty(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
              inputMode="numeric"
              data-testid="qty-input"
              className="h-9 w-16 rounded-lg border border-slate-200 text-center text-[14px] font-semibold text-slate-900"
            />
            <button
              type="button"
              onClick={() => setQty((q) => q + 1)}
              data-testid="qty-plus"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-700"
            >
              <Plus size={15} />
            </button>
          </div>
        </div>

        {/* Upload desain */}
        {product.upload && (
          <div>
            <div className="mb-2 text-[12px] font-semibold text-slate-900">{product.uploadLabel || 'Upload desain'}</div>
            {design ? (
              <div className="flex items-center gap-3 rounded-lg border border-slate-200 p-2">
                <img src={design} alt="Desain" className="h-14 w-14 rounded-md bg-slate-100 object-contain" />
                <div className="min-w-0 flex-1 truncate text-[12px] text-slate-600">{designName}</div>
                <button
                  type="button"
                  onClick={() => { setDesign(null); setDesignName(''); }}
                  data-testid="design-remove"
                  className="rounded-full p-1.5 text-slate-500"
                  aria-label="Hapus desain"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                data-testid="design-upload"
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-blue-300 bg-blue-50/50 py-3 text-[12px] font-medium text-blue-700"
              >
                <Upload size={15} /> Pilih gambar (maks 2,5 MB)
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" onChange={onPickFile} className="hidden" />
          </div>
        )}

        {/* Catatan */}
        <div>
          <div className="mb-2 text-[12px] font-semibold text-slate-900">Catatan (opsional)</div>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            data-testid="detail-note"
            placeholder="Misal: posisi logo di dada kiri"
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-900 placeholder:text-slate-400"
          />
        </div>
      </section>

      {/* Aksi: menempel di bawah pada mobile, menyatu dengan kolom kanan pada md+ */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white px-3 py-2.5 md:static md:z-auto md:rounded-2xl md:border md:px-4 md:py-4"
        data-testid="detail-action-bar"
      >
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-[11px] text-slate-500">Total {qty} {unitLabel}</span>
          <span className="text-[16px] font-bold text-blue-700" data-testid="detail-total">{rupiah(total)}</span>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onAdd}
            data-testid="add-to-cart"
            className="flex-1 rounded-xl border border-blue-700 bg-white py-3 text-[13px] font-semibold text-blue-700"
          >
            + Keranjang
          </button>
          <button
            type="button"
            onClick={onBuyNow}
            data-testid="buy-now"
            className="flex-1 rounded-xl bg-blue-700 py-3 text-[13px] font-semibold text-white"
          >
            Beli Sekarang
          </button>
        </div>
      </div>
        </div>
      </div>
    </div>
  );
}

/** Satu baris rincian harga. */
function Row({ label, value, tone = 'text-slate-600', testId }) {
  return (
    <div className={`flex items-center justify-between ${tone}`} data-testid={testId}>
      <span className="mr-2 min-w-0 truncate">{label}</span>
      <span className="shrink-0 font-medium">{value}</span>
    </div>
  );
}

/** Baris kartu thumbnail opsi printing yang bisa di-scroll horizontal. */
function PrintPicker({ label, prints, value, onChange, testPrefix, fallbackThumb }) {
  return (
    <div>
      <div className="px-4 pb-2 text-[12px] font-semibold text-slate-900">{label}</div>
      <div className="flex gap-2 overflow-x-auto px-4 pb-1">
        {prints.map((o, i) => {
          const on = value === o.v;
          return (
            <button
              type="button"
              key={o.v}
              onClick={() => onChange(o.v)}
              data-testid={`${testPrefix}-${o.v}`}
              aria-pressed={on}
              className={`dp-soft relative w-[86px] shrink-0 overflow-hidden rounded-xl border-2 bg-white text-left ${
                on ? 'border-blue-700' : 'border-slate-200'
              }`}
            >
              <span
                className={`absolute left-1 top-1 z-10 flex h-[18px] w-[18px] items-center justify-center rounded-full text-[10px] font-bold ${
                  on ? 'bg-blue-700 text-white' : 'bg-slate-900/70 text-white'
                }`}
              >
                {i + 1}
              </span>
              <img
                src={o.thumb || fallbackThumb}
                alt={o.v}
                loading="lazy"
                className="aspect-square w-full bg-slate-100 object-contain"
              />
              {/* Dua baris: label panjang seperti "Tanpa Printing" tetap terbaca utuh */}
              <span className={`block px-2 pt-1.5 text-[11px] font-medium leading-snug line-clamp-2 h-[3em] ${on ? 'text-blue-800' : 'text-slate-700'}`}>
                {o.v}
              </span>
              <span className={`block truncate px-2 pb-2 text-[10px] ${on ? 'text-blue-700' : 'text-slate-500'}`}>
                {o.add > 0 ? `+${rupiah(o.add)}` : 'Tanpa biaya'}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
