'use client';
/**
 * Tab Products — CRUD produk storefront HP.
 *
 * Catatan:
 *   - Delete memakai SOFT DELETE di server (kolom deleted_at), jadi data tidak
 *     langsung hilang permanen, dan selalu lewat dialog konfirmasi.
 *   - Urutan produk disimpan lewat PATCH /api/mobile-cms/products (drag & drop
 *     atau tombol naik/turun).
 *   - Profit & margin dihitung otomatis dari Harga Pokok dan Harga Jual.
 */
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Plus,
  Pencil,
  Copy,
  EyeOff,
  Eye,
  Trash2,
  Search,
  GripVertical,
  ChevronUp,
  ChevronDown,
  Star,
  Loader2,
  Upload,
  X,
  Image as ImageIcon,
} from 'lucide-react';
import api, { formatApiError, uploadImage } from '@/lib/api';
import {
  STATUS_OPTIONS,
  SORT_OPTIONS,
  statusLabel,
  statusTone,
  rp,
  profitOf,
  moveItem,
  useDragSort,
} from '@/lib/mobileCmsClient';
import ImagePicker from '@/components/mobilecms/ImagePicker';

const SELECT_CLASS =
  'h-9 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground';

const emptyForm = () => ({
  name: '',
  category_id: '',
  description: '',
  sku: '',
  price: '',
  cost: '',
  compare_price: '',
  discount: '',
  status: 'draft',
  is_featured: false,
  variants: [],
  images: [],
  main_image: '',
  thumbnail_image: '',
  banner_image: '',
});

/* ------------------------------------------------------------------ */
/* Galeri gambar produk (multi upload + drag & drop + gambar utama)    */
/* ------------------------------------------------------------------ */
function GalleryEditor({ form, setForm, media, onMediaAdded }) {
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const { handlers, dropClass } = useDragSort(form.images, (next) =>
    setForm((f) => ({ ...f, images: next })),
  );

  const uploadMany = async (files) => {
    const list = Array.from(files || []).filter((f) => f.type.startsWith('image/'));
    if (!list.length) return toast.error('Pilih berkas gambar');
    setBusy(true);
    const urls = [];
    const added = [];
    for (const file of list) {
      try {
        const info = await uploadImage(file, 'product');
        urls.push(info.url);
        added.push({ url: info.url, label: file.name, width: info.width, height: info.height });
      } catch (err) {
        toast.error(`${file.name}: ${formatApiError(err.response?.data?.detail) || 'gagal diunggah'}`);
      }
    }
    if (urls.length) {
      setForm((f) => {
        const images = [...f.images, ...urls].slice(0, 20);
        return { ...f, images, main_image: f.main_image || images[0] };
      });
      try {
        const { data } = await api.post('/mobile-cms/media', { items: added });
        onMediaAdded?.(data.items || []);
      } catch {
        /* pencatatan ke Media opsional */
      }
      toast.success(`${urls.length} gambar diunggah`);
    }
    setBusy(false);
  };

  const removeAt = (i) =>
    setForm((f) => {
      const images = f.images.filter((_, idx) => idx !== i);
      const main = images.includes(f.main_image) ? f.main_image : images[0] || '';
      return { ...f, images, main_image: main, thumbnail_image: images.includes(f.thumbnail_image) ? f.thumbnail_image : main };
    });

  return (
    <div className="space-y-2">
      <Label className="text-xs text-muted-foreground">
        Gallery Images — tarik untuk mengubah urutan, klik bintang untuk gambar utama
      </Label>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer?.files?.length) uploadMany(e.dataTransfer.files);
        }}
        className={`rounded-md border-2 border-dashed p-3 text-center transition ${
          dragOver ? 'border-primary bg-primary/5' : 'border-border bg-secondary'
        }`}
        data-testid="cms-gallery-dropzone"
      >
        <input
          id="cms-gallery-input"
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            const files = e.target.files;
            e.target.value = '';
            uploadMany(files);
          }}
          data-testid="cms-gallery-input"
        />
        <p className="text-[11px] text-muted-foreground">
          Tarik & lepas beberapa gambar ke sini, atau
        </p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="mt-2"
          disabled={busy}
          onClick={() => document.getElementById('cms-gallery-input')?.click()}
          data-testid="cms-gallery-browse"
        >
          {busy ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-1 h-3.5 w-3.5" />}
          Pilih Gambar (bisa banyak)
        </Button>
      </div>

      {form.images.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {form.images.map((url, i) => (
            <div
              key={`${url}-${i}`}
              {...handlers(i)}
              className={`group relative overflow-hidden rounded-md border bg-secondary ${dropClass(i)} ${
                form.main_image === url ? 'border-primary' : 'border-border'
              }`}
              data-testid={`cms-gallery-item-${i}`}
            >
              <img src={url} alt={`Gambar ${i + 1}`} className="aspect-square w-full object-contain" />
              <span className="absolute left-1 top-1 rounded bg-black/55 p-0.5 text-white">
                <GripVertical className="h-3 w-3" />
              </span>
              <div className="absolute inset-x-0 bottom-0 flex justify-between bg-black/55 px-1 py-0.5">
                <button
                  type="button"
                  title="Jadikan gambar utama"
                  onClick={() => setForm((f) => ({ ...f, main_image: url }))}
                  data-testid={`cms-gallery-main-${i}`}
                >
                  <Star className={`h-3.5 w-3.5 ${form.main_image === url ? 'text-amber-400' : 'text-white'}`} />
                </button>
                <button type="button" title="Hapus gambar" onClick={() => removeAt(i)} data-testid={`cms-gallery-remove-${i}`}>
                  <X className="h-3.5 w-3.5 text-white" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <ImagePicker
          label="Thumbnail Image (kartu produk di HP)"
          value={form.thumbnail_image}
          onChange={(v) => setForm((f) => ({ ...f, thumbnail_image: v }))}
          media={media}
          onMediaAdded={onMediaAdded}
          testId="cms-thumb-picker"
          hint="Dikosongkan = ikut gambar utama."
        />
        <ImagePicker
          label="Mobile Banner Image"
          value={form.banner_image}
          onChange={(v) => setForm((f) => ({ ...f, banner_image: v }))}
          media={media}
          onMediaAdded={onMediaAdded}
          testId="cms-banner-picker"
          hint="Dipakai untuk banner lebar di halaman HP."
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Variasi produk                                                      */
/* ------------------------------------------------------------------ */
function VariantEditor({ form, setForm }) {
  const update = (i, key, val) =>
    setForm((f) => ({
      ...f,
      variants: f.variants.map((v, idx) => (idx === i ? { ...v, [key]: val } : v)),
    }));
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs text-muted-foreground">Variasi Produk (Ukuran · Warna · Stok)</Label>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setForm((f) => ({ ...f, variants: [...f.variants, { size: '', color: '', stock: 0 }] }))}
          data-testid="cms-variant-add"
        >
          <Plus className="mr-1 h-3.5 w-3.5" /> Tambah Variasi
        </Button>
      </div>
      {form.variants.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">Belum ada variasi. Produk tetap bisa dijual tanpa variasi.</p>
      ) : (
        <div className="space-y-2">
          {form.variants.map((v, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_90px_36px] items-center gap-2">
              <Input
                value={v.size}
                placeholder="Ukuran (S / M / 10cm)"
                onChange={(e) => update(i, 'size', e.target.value)}
                data-testid={`cms-variant-size-${i}`}
              />
              <Input
                value={v.color}
                placeholder="Warna"
                onChange={(e) => update(i, 'color', e.target.value)}
                data-testid={`cms-variant-color-${i}`}
              />
              <Input
                value={v.stock}
                inputMode="numeric"
                placeholder="Stok"
                onChange={(e) => update(i, 'stock', e.target.value.replace(/[^0-9]/g, ''))}
                data-testid={`cms-variant-stock-${i}`}
              />
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => setForm((f) => ({ ...f, variants: f.variants.filter((_, idx) => idx !== i) }))}
                data-testid={`cms-variant-remove-${i}`}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Panel utama                                                         */
/* ------------------------------------------------------------------ */
export default function ProductsPanel({ draft, reload, onMediaAdded }) {
  const products = draft?.products || [];
  const categories = draft?.categories || [];
  const media = draft?.media || [];

  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');
  const [sort, setSort] = useState('manual');

  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [delTarget, setDelTarget] = useState(null);
  const [order, setOrder] = useState(null); // urutan sementara saat drag

  const list = useMemo(() => {
    let items = order ? order.map((id) => products.find((p) => p.id === id)).filter(Boolean) : products;
    const needle = q.trim().toLowerCase();
    if (needle) {
      items = items.filter(
        (p) =>
          p.name.toLowerCase().includes(needle) ||
          (p.sku || '').toLowerCase().includes(needle) ||
          (p.description || '').toLowerCase().includes(needle),
      );
    }
    if (status) items = items.filter((p) => p.status === status);
    if (category) items = items.filter((p) => p.category_id === category);
    const cmp = {
      newest: (a, b) => String(b.created_at).localeCompare(String(a.created_at)),
      oldest: (a, b) => String(a.created_at).localeCompare(String(b.created_at)),
      price_asc: (a, b) => a.price - b.price,
      price_desc: (a, b) => b.price - a.price,
      name_asc: (a, b) => a.name.localeCompare(b.name, 'id'),
      name_desc: (a, b) => b.name.localeCompare(a.name, 'id'),
    }[sort];
    return cmp ? [...items].sort(cmp) : items;
  }, [products, order, q, status, category, sort]);

  const manualMode = sort === 'manual' && !q && !status && !category;

  const persistOrder = async (ids) => {
    setOrder(ids);
    try {
      await api.patch('/mobile-cms/products', { ids });
      await reload();
      setOrder(null);
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || 'Gagal menyimpan urutan');
      setOrder(null);
    }
  };

  const { handlers, dropClass } = useDragSort(
    list.map((p) => p.id),
    (nextIds) => persistOrder(nextIds),
  );

  const openCreate = () => {
    setEditId(null);
    setForm(emptyForm());
    setOpen(true);
  };

  const openEdit = (p) => {
    setEditId(p.id);
    setForm({
      name: p.name,
      category_id: p.category_id || '',
      description: p.description || '',
      sku: p.sku || '',
      price: String(p.price || ''),
      cost: String(p.cost || ''),
      compare_price: String(p.compare_price || ''),
      discount: String(p.discount || ''),
      status: p.status,
      is_featured: p.is_featured,
      variants: (p.variants || []).map((v) => ({ ...v })),
      images: [...(p.images || [])],
      main_image: p.main_image || '',
      thumbnail_image: p.thumbnail_image || '',
      banner_image: p.banner_image || '',
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) return toast.error('Nama produk wajib diisi');
    setSaving(true);
    const payload = {
      ...form,
      price: Number(form.price) || 0,
      cost: Number(form.cost) || 0,
      compare_price: Number(form.compare_price) || 0,
      discount: Number(form.discount) || 0,
      variants: form.variants.map((v) => ({ ...v, stock: Number(v.stock) || 0 })),
    };
    try {
      if (editId) await api.put(`/mobile-cms/products/${editId}`, payload);
      else await api.post('/mobile-cms/products', payload);
      toast.success(editId ? 'Produk diperbarui' : 'Produk ditambahkan');
      setOpen(false);
      await reload();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || 'Gagal menyimpan produk');
    } finally {
      setSaving(false);
    }
  };

  const duplicate = async (p) => {
    try {
      await api.post(`/mobile-cms/products/${p.id}?op=duplicate`);
      toast.success('Produk diduplikat sebagai Draft');
      await reload();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || 'Gagal menduplikat produk');
    }
  };

  const toggleHide = async (p) => {
    const next = p.status === 'hidden' ? 'active' : 'hidden';
    try {
      await api.patch(`/mobile-cms/products/${p.id}`, { status: next });
      toast.success(next === 'hidden' ? 'Produk disembunyikan' : 'Produk ditampilkan kembali');
      await reload();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || 'Gagal mengubah status');
    }
  };

  const confirmDelete = async () => {
    if (!delTarget) return;
    try {
      await api.delete(`/mobile-cms/products/${delTarget.id}`);
      toast.success('Produk dihapus (soft delete, data masih tersimpan)');
      setDelTarget(null);
      await reload();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || 'Gagal menghapus produk');
    }
  };

  const live = profitOf(form.price, form.cost);

  return (
    <div className="space-y-4" data-testid="cms-products-panel">
      {/* Search, filter, sorting */}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search Product…"
            className="pl-8"
            data-testid="cms-product-search"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className={SELECT_CLASS}
          data-testid="cms-product-filter-status"
        >
          <option value="">Semua Status</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className={SELECT_CLASS}
          data-testid="cms-product-filter-category"
        >
          <option value="">Semua Kategori</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className={SELECT_CLASS}
          data-testid="cms-product-sort"
        >
          {SORT_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {list.length} produk{manualMode ? ' · urutan bisa ditarik (drag & drop)' : ''}
        </p>
        <Button size="sm" onClick={openCreate} data-testid="cms-product-add">
          <Plus className="mr-1 h-4 w-4" /> Add New Product
        </Button>
      </div>

      {/* Daftar produk */}
      {list.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center" data-testid="cms-product-empty">
          <ImageIcon className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">
            Belum ada produk yang cocok. Tekan <b>Add New Product</b> untuk mulai.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {list.map((p, i) => (
            <div
              key={p.id}
              {...(manualMode ? handlers(i) : {})}
              className={`flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-3 ${dropClass(i)}`}
              data-testid={`cms-product-row-${p.id}`}
            >
              {manualMode && (
                <span className="cursor-grab text-muted-foreground" title="Tarik untuk mengubah urutan">
                  <GripVertical className="h-4 w-4" />
                </span>
              )}
              <img
                src={p.thumbnail_image || p.main_image || '/assets/mockups/logo-a4.webp'}
                alt={p.name}
                className="h-12 w-12 shrink-0 rounded-md border border-border object-contain"
              />
              <div className="min-w-[160px] flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-semibold">{p.name}</span>
                  {p.is_featured && <Star className="h-3.5 w-3.5 shrink-0 text-amber-500" />}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {p.sku ? `SKU ${p.sku} · ` : ''}
                  {categories.find((c) => c.id === p.category_id)?.name || 'Tanpa kategori'} · stok {p.stock_total}
                </div>
              </div>
              <div className="min-w-[150px] text-right text-[11px] leading-tight">
                <div className="text-sm font-semibold">{rp(p.price)}</div>
                <div className="text-muted-foreground">Pokok {rp(p.cost)}</div>
                <div className="text-emerald-600">
                  Profit {rp(p.profit)} · {p.margin}%
                </div>
              </div>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${statusTone(p.status)}`}>
                {statusLabel(p.status)}
              </span>
              <div className="flex shrink-0 items-center gap-1">
                {manualMode && (
                  <>
                    <Button
                      size="icon"
                      variant="ghost"
                      disabled={i === 0}
                      onClick={() => persistOrder(moveItem(list.map((x) => x.id), i, i - 1))}
                      data-testid={`cms-product-up-${p.id}`}
                    >
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      disabled={i === list.length - 1}
                      onClick={() => persistOrder(moveItem(list.map((x) => x.id), i, i + 1))}
                      data-testid={`cms-product-down-${p.id}`}
                    >
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </>
                )}
                <Button size="icon" variant="ghost" onClick={() => openEdit(p)} data-testid={`cms-product-edit-${p.id}`}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => duplicate(p)} data-testid={`cms-product-duplicate-${p.id}`}>
                  <Copy className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => toggleHide(p)} data-testid={`cms-product-hide-${p.id}`}>
                  {p.status === 'hidden' ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </Button>
                <Button size="icon" variant="ghost" onClick={() => setDelTarget(p)} data-testid={`cms-product-delete-${p.id}`}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Dialog tambah / ubah produk */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto" data-testid="cms-product-dialog">
          <DialogHeader>
            <DialogTitle>{editId ? 'Edit Produk' : 'Tambah Produk Baru'}</DialogTitle>
            <DialogDescription>
              Perubahan tersimpan sebagai draft. Tekan <b>Publish Changes</b> di atas agar tampil ke pelanggan.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Nama Produk *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  data-testid="cms-form-name"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Kategori</Label>
                <select
                  value={form.category_id}
                  onChange={(e) => setForm((f) => ({ ...f, category_id: e.target.value }))}
                  className={SELECT_CLASS}
                  data-testid="cms-form-category"
                >
                  <option value="">Tanpa kategori</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Deskripsi</Label>
              <Textarea
                value={form.description}
                rows={3}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                data-testid="cms-form-description"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">SKU</Label>
                <Input
                  value={form.sku}
                  onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
                  data-testid="cms-form-sku"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Status Produk</Label>
                <select
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                  className={SELECT_CLASS}
                  data-testid="cms-form-status"
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end justify-between gap-2 rounded-md border border-border px-3 py-2">
                <Label className="text-xs text-muted-foreground">Produk Pilihan</Label>
                <Switch
                  checked={form.is_featured}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, is_featured: v }))}
                  data-testid="cms-form-featured"
                />
              </div>
            </div>

            {/* Harga */}
            <div className="rounded-md border border-border p-3">
              <h4 className="text-sm font-semibold">Harga</h4>
              <div className="mt-3 grid gap-3 sm:grid-cols-4">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Harga Pokok / Cost</Label>
                  <Input
                    value={form.cost}
                    inputMode="numeric"
                    onChange={(e) => setForm((f) => ({ ...f, cost: e.target.value.replace(/[^0-9]/g, '') }))}
                    data-testid="cms-form-cost"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Harga Jual *</Label>
                  <Input
                    value={form.price}
                    inputMode="numeric"
                    onChange={(e) => setForm((f) => ({ ...f, price: e.target.value.replace(/[^0-9]/g, '') }))}
                    data-testid="cms-form-price"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Harga Coret</Label>
                  <Input
                    value={form.compare_price}
                    inputMode="numeric"
                    onChange={(e) => setForm((f) => ({ ...f, compare_price: e.target.value.replace(/[^0-9]/g, '') }))}
                    data-testid="cms-form-compare-price"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Diskon (%)</Label>
                  <Input
                    value={form.discount}
                    inputMode="numeric"
                    onChange={(e) => setForm((f) => ({ ...f, discount: e.target.value.replace(/[^0-9]/g, '') }))}
                    data-testid="cms-form-discount"
                  />
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-4 rounded-md bg-secondary p-3 text-sm">
                <span>
                  Profit:{' '}
                  <b className={live.profit >= 0 ? 'text-emerald-600' : 'text-destructive'} data-testid="cms-form-profit">
                    {rp(live.profit)}
                  </b>
                </span>
                <span>
                  Margin: <b data-testid="cms-form-margin">{live.margin}%</b>
                </span>
              </div>
            </div>

            <VariantEditor form={form} setForm={setForm} />
            <GalleryEditor form={form} setForm={setForm} media={media} onMediaAdded={onMediaAdded} />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} data-testid="cms-form-cancel">
              Batal
            </Button>
            <Button onClick={save} disabled={saving} data-testid="cms-form-save">
              {saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />} Simpan Produk
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Konfirmasi hapus */}
      <Dialog open={!!delTarget} onOpenChange={(v) => !v && setDelTarget(null)}>
        <DialogContent className="max-w-md" data-testid="cms-product-delete-dialog">
          <DialogHeader>
            <DialogTitle>Are you sure you want to delete this product?</DialogTitle>
            <DialogDescription>
              {delTarget?.name} akan dihapus dari storefront HP. Penghapusan bersifat <b>soft delete</b>, jadi
              datanya masih tersimpan di database dan bisa dipulihkan lewat database bila diperlukan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDelTarget(null)} data-testid="cms-delete-cancel">
              Batal
            </Button>
            <Button variant="destructive" onClick={confirmDelete} data-testid="cms-delete-confirm">
              Ya, Hapus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
