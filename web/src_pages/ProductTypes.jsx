/**
 * Jenis Produk — halaman admin (/app/mockup-kaos)
 * ---------------------------------------------------------------------------
 * Menggantikan "Mockup Kaos" yang lama. Di sini admin mengelola:
 *   1. Info jenis produk  : nama, harga kaos, suplier, size region, model, bahan,
 *                           deskripsi, thumbnail, aktif/non-aktif, urutan.
 *   2. Varian warna       : nama + hex + thumbnail tampak depan (PNG/JPG yang
 *                           otomatis dikonversi ke WebP oleh /api/upload).
 *   3. Size chart         : per ukuran => lebar dada (cm) & panjang (cm).
 *
 * Data ini dipakai halaman publik:
 *   - /price-list  (pilih jenis kaos + ikon varian warna)
 *   - /custom      (tombol "Ganti Produk")
 *
 * Performa: daftar produk memakai pagination server (page/limit) dengan
 * lazy-load lewat IntersectionObserver, jadi hanya 9 kartu pertama yang diambil
 * dan sisanya menyusul saat di-scroll.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import api, { formatApiError, uploadImage } from "@/lib/api";
import { extractPaletteFromFile } from "@/lib/palette";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Plus, Pencil, Trash2, Shirt, Search, UploadCloud, Loader2, RefreshCw,
  Palette, Ruler, ImageOff, Check, X, PackageSearch, Eye, EyeOff, Layers,
} from "lucide-react";

const PAGE_SIZE = 9;
const SIZE_REGIONS = ["Asia / Local Size", "Eropa / USA"];
const EMPTY_PRODUCT = {
  title: "", subtitle: "", price: 0, supplier: "", size_region: SIZE_REGIONS[0],
  model: "", material: "", description: "", thumbnail_url: "", is_active: true, sort_order: 0,
};
const EMPTY_COLOR = { name: "", hex: "#111111", thumb_url: "" };
const EMPTY_SIZE = { label: "", chest_cm: "", length_cm: "" };

const rp = (n) => "Rp " + Number(n || 0).toLocaleString("id-ID");
const isLight = (hex) => {
  const h = String(hex || "").replace("#", "").slice(0, 6);
  if (h.length !== 6) return false;
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.72;
};

export default function ProductTypes() {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);       // load awal / ganti filter
  const [loadingMore, setLoadingMore] = useState(false);
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [activeOnly, setActiveOnly] = useState(false);

  // dialog produk
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_PRODUCT);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  // panel warna & size chart
  const [colorTarget, setColorTarget] = useState(null);
  const [sizeTarget, setSizeTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const sentinelRef = useRef(null);

  /* ------------------------------ data loading ----------------------------- */
  const fetchPage = useCallback(
    async (targetPage, { append }) => {
      const params = new URLSearchParams({ page: String(targetPage), limit: String(PAGE_SIZE) });
      if (debouncedQ.trim()) params.set("q", debouncedQ.trim());
      if (activeOnly) params.set("active", "1");
      const { data } = await api.get(`/custom-products?${params.toString()}`);
      setTotal(data.total || 0);
      setHasMore(!!data.has_more);
      setPage(data.page || targetPage);
      setItems((prev) => {
        const next = append ? [...prev, ...(data.items || [])] : data.items || [];
        // jaga-jaga duplikat kalau data berubah di tengah lazy-load
        const seen = new Set();
        return next.filter((it) => (seen.has(it.id) ? false : seen.add(it.id)));
      });
    },
    [debouncedQ, activeOnly],
  );

  const reload = useCallback(() => {
    setLoading(true);
    fetchPage(1, { append: false })
      .catch((e) => toast.error(formatApiError(e.response?.data?.detail)))
      .finally(() => setLoading(false));
  }, [fetchPage]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 350);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => { reload(); }, [reload]);

  const loadMore = useCallback(() => {
    if (loading || loadingMore || !hasMore) return;
    setLoadingMore(true);
    fetchPage(page + 1, { append: true })
      .catch((e) => toast.error(formatApiError(e.response?.data?.detail)))
      .finally(() => setLoadingMore(false));
  }, [fetchPage, hasMore, loading, loadingMore, page]);

  // lazy load: begitu sentinel terlihat, ambil halaman berikutnya
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => { if (entries.some((en) => en.isIntersecting)) loadMore(); },
      { rootMargin: "320px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [loadMore]);

  const patchItem = (updated) =>
    setItems((prev) => (prev || []).map((it) => (it.id === updated.id ? updated : it)));

  /* -------------------------------- produk -------------------------------- */
  const openAdd = () => { setForm(EMPTY_PRODUCT); setEditId(null); setFormOpen(true); };
  const openEdit = (p) => {
    setForm({
      title: p.title || "", subtitle: p.subtitle || "", price: p.price || 0,
      supplier: p.supplier || "", size_region: p.size_region || SIZE_REGIONS[0],
      model: p.model || "", material: p.material || "", description: p.description || "",
      thumbnail_url: p.thumbnail_url || "", is_active: p.is_active !== false, sort_order: p.sort_order || 0,
    });
    setEditId(p.id);
    setFormOpen(true);
  };

  const handleThumb = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("File harus berupa gambar");
    if (file.size > 15 * 1024 * 1024) return toast.error("Ukuran maksimal 15MB");
    setUploading(true);
    try {
      const info = await uploadImage(file, "mockup");
      setForm((f) => ({ ...f, thumbnail_url: info.url }));
      toast.success(`Gambar jadi WebP ${Math.round(info.bytes / 1024)} KB (${info.width}x${info.height})`);
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail) || "Upload gagal");
    } finally {
      setUploading(false);
    }
  };

  const saveProduct = async () => {
    if (!form.title.trim()) return toast.error("Nama produk wajib diisi");
    if (Number(form.price) < 0) return toast.error("Harga tidak boleh negatif");
    setSaving(true);
    const payload = {
      ...form,
      title: form.title.trim(),
      price: Number(form.price) || 0,
      sort_order: Number(form.sort_order) || 0,
    };
    try {
      if (editId) {
        const { data } = await api.put(`/custom-products/${editId}`, payload);
        patchItem(data);
        toast.success("Jenis produk diperbarui");
      } else {
        await api.post("/custom-products", payload);
        toast.success("Jenis produk ditambahkan");
        reload();
      }
      setFormOpen(false);
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (p) => {
    try {
      const { data } = await api.put(`/custom-products/${p.id}`, { is_active: !p.is_active });
      patchItem(data);
      toast.success(data.is_active ? "Produk diaktifkan" : "Produk disembunyikan dari halaman publik");
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/custom-products/${deleteTarget.id}`);
      toast.success(`"${deleteTarget.title}" dihapus`);
      setDeleteTarget(null);
      reload();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    } finally {
      setDeleting(false);
    }
  };

  const stats = useMemo(() => {
    const colors = items.reduce((a, p) => a + (p.color_count || 0), 0);
    const sizes = items.reduce((a, p) => a + (p.size_chart?.length || 0), 0);
    const inactive = items.filter((p) => !p.is_active).length;
    return { colors, sizes, inactive };
  }, [items]);

  /* --------------------------------- render ------------------------------- */
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Shirt className="h-6 w-6 text-primary" /> Jenis Produk
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Kelola jenis kaos beserta varian warna dan size chart-nya. Data di sini otomatis muncul
            di halaman <span className="font-semibold">Daftar Harga</span> dan pada tombol{" "}
            <span className="font-semibold">Ganti Produk</span> di desainer kaos.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button data-testid="product-types-refresh" variant="outline" onClick={reload} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Muat Ulang
          </Button>
          <Button data-testid="product-types-add" onClick={openAdd}>
            <Plus className="mr-2 h-4 w-4" /> Tambah Jenis Produk
          </Button>
        </div>
      </div>

      {/* Ringkasan */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard testid="stat-total" icon={PackageSearch} label="Jenis Produk" value={total} />
        <StatCard testid="stat-colors" icon={Palette} label="Varian Warna (dimuat)" value={stats.colors} />
        <StatCard testid="stat-sizes" icon={Ruler} label="Baris Size Chart" value={stats.sizes} />
        <StatCard testid="stat-inactive" icon={EyeOff} label="Non-aktif (dimuat)" value={stats.inactive} />
      </div>

      {/* Filter */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            data-testid="product-types-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari nama produk, suplier, atau bahan..."
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
          <Switch
            data-testid="product-types-active-only"
            id="active-only"
            checked={activeOnly}
            onCheckedChange={setActiveOnly}
          />
          <Label htmlFor="active-only" className="cursor-pointer text-sm">Hanya yang aktif</Label>
        </div>
      </div>

      {/* Daftar */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" data-testid="product-types-skeleton">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-4">
              <Skeleton className="h-40 w-full rounded-lg" />
              <Skeleton className="mt-3 h-5 w-2/3" />
              <Skeleton className="mt-2 h-4 w-1/3" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div
          data-testid="product-types-empty"
          className="rounded-xl border border-dashed border-border bg-card p-12 text-center"
        >
          <Shirt className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 font-semibold">Belum ada jenis produk</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {debouncedQ ? "Tidak ada yang cocok dengan pencarian." : "Tambahkan jenis kaos pertama untuk mulai."}
          </p>
          <Button data-testid="product-types-empty-add" className="mt-4" onClick={openAdd}>
            <Plus className="mr-2 h-4 w-4" /> Tambah Jenis Produk
          </Button>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" data-testid="product-types-grid">
            {items.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                onEdit={() => openEdit(p)}
                onColors={() => setColorTarget(p)}
                onSizes={() => setSizeTarget(p)}
                onDelete={() => setDeleteTarget(p)}
                onToggleActive={() => toggleActive(p)}
              />
            ))}
          </div>

          {/* Sentinel lazy-load */}
          <div ref={sentinelRef} className="h-4" data-testid="product-types-sentinel" />

          <div className="flex flex-col items-center gap-2 pb-4">
            {loadingMore && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="product-types-loading-more">
                <Loader2 className="h-4 w-4 animate-spin" /> Memuat produk berikutnya...
              </div>
            )}
            {!loadingMore && hasMore && (
              <Button data-testid="product-types-load-more" variant="outline" onClick={loadMore}>
                Muat Lebih Banyak
              </Button>
            )}
            <p className="text-xs text-muted-foreground" data-testid="product-types-count">
              Menampilkan {items.length} dari {total} jenis produk
            </p>
          </div>
        </>
      )}

      {/* Dialog form produk */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? "Ubah Jenis Produk" : "Tambah Jenis Produk"}</DialogTitle>
            <DialogDescription>
              Informasi di bawah tampil di halaman Daftar Harga dan detail produk pada desainer kaos.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            {/* Thumbnail */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
              <div className="h-28 w-28 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
                {form.thumbnail_url ? (
                  <img
                    src={form.thumbnail_url}
                    alt="Thumbnail produk"
                    data-testid="product-form-thumb-preview"
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                    <ImageOff className="h-6 w-6" />
                  </div>
                )}
              </div>
              <div className="flex-1 space-y-2">
                <Label>Foto Produk (otomatis jadi WebP)</Label>
                <div className="flex flex-wrap gap-2">
                  <Button
                    data-testid="product-form-thumb-upload"
                    type="button"
                    variant="outline"
                    disabled={uploading}
                    onClick={() => document.getElementById("pt-thumb-input")?.click()}
                  >
                    {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
                    {uploading ? "Mengunggah..." : "Unggah Foto"}
                  </Button>
                  {form.thumbnail_url && (
                    <Button
                      data-testid="product-form-thumb-clear"
                      type="button"
                      variant="ghost"
                      onClick={() => setForm((f) => ({ ...f, thumbnail_url: "" }))}
                    >
                      <X className="mr-2 h-4 w-4" /> Hapus Foto
                    </Button>
                  )}
                </div>
                <input
                  id="pt-thumb-input"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  data-testid="product-form-thumb-file"
                  onChange={handleThumb}
                />
                <p className="text-xs text-muted-foreground">PNG / JPG maksimal 15MB, dikonversi otomatis ke WebP.</p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nama Produk *">
                <Input
                  data-testid="product-form-title"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="SIZE LOCAL (BuildUp Tees)"
                />
              </Field>
              <Field label="Harga Kaos (Rp) *">
                <Input
                  data-testid="product-form-price"
                  type="number"
                  min={0}
                  value={form.price}
                  onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                  placeholder="55000"
                />
              </Field>
              <Field label="Sub Judul">
                <Input
                  data-testid="product-form-subtitle"
                  value={form.subtitle}
                  onChange={(e) => setForm((f) => ({ ...f, subtitle: e.target.value }))}
                  placeholder="Kaos 24s dengan ukuran lokal"
                />
              </Field>
              <Field label="Suplier">
                <Input
                  data-testid="product-form-supplier"
                  value={form.supplier}
                  onChange={(e) => setForm((f) => ({ ...f, supplier: e.target.value }))}
                  placeholder="New State Apparel 24s Premium"
                />
              </Field>
              <Field label="Size">
                <Select
                  value={form.size_region || SIZE_REGIONS[0]}
                  onValueChange={(v) => setForm((f) => ({ ...f, size_region: v }))}
                >
                  <SelectTrigger data-testid="product-form-size-region">
                    <SelectValue placeholder="Pilih standar ukuran" />
                  </SelectTrigger>
                  <SelectContent>
                    {SIZE_REGIONS.map((r) => (
                      <SelectItem key={r} value={r}>{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Urutan Tampil">
                <Input
                  data-testid="product-form-sort"
                  type="number"
                  min={0}
                  value={form.sort_order}
                  onChange={(e) => setForm((f) => ({ ...f, sort_order: e.target.value }))}
                />
              </Field>
              <Field label="Model">
                <Input
                  data-testid="product-form-model"
                  value={form.model}
                  onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
                  placeholder="Kaos tanpa jaritan samping"
                />
              </Field>
              <Field label="Bahan">
                <Input
                  data-testid="product-form-material"
                  value={form.material}
                  onChange={(e) => setForm((f) => ({ ...f, material: e.target.value }))}
                  placeholder="Cotton 100% 24s"
                />
              </Field>
            </div>

            <Field label="Deskripsi">
              <Textarea
                data-testid="product-form-description"
                rows={4}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Penjelasan singkat soal bahan, potongan, dan cocok untuk apa."
              />
            </Field>

            <div className="flex items-center gap-3 rounded-lg border border-border p-3">
              <Switch
                data-testid="product-form-active"
                id="pt-active"
                checked={form.is_active}
                onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))}
              />
              <Label htmlFor="pt-active" className="cursor-pointer text-sm">
                Aktif — tampil di halaman publik (Daftar Harga & desainer kaos)
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button data-testid="product-form-cancel" variant="outline" onClick={() => setFormOpen(false)}>
              Batal
            </Button>
            <Button data-testid="product-form-save" onClick={saveProduct} disabled={saving || uploading}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editId ? "Simpan Perubahan" : "Simpan Produk"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Panel warna */}
      <ColorManager
        product={colorTarget}
        onClose={() => setColorTarget(null)}
        onChanged={(updated) => { patchItem(updated); setColorTarget(updated); }}
      />

      {/* Panel size chart */}
      <SizeChartManager
        product={sizeTarget}
        onClose={() => setSizeTarget(null)}
        onChanged={(updated) => { patchItem(updated); setSizeTarget(updated); }}
      />

      {/* Konfirmasi hapus */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus jenis produk?</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{deleteTarget?.title}&quot; beserta {deleteTarget?.color_count || 0} varian warna dan{" "}
              {deleteTarget?.size_chart?.length || 0} baris size chart akan dihapus permanen.
              Produk ini juga hilang dari halaman Daftar Harga dan desainer kaos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="product-delete-cancel">Batal</AlertDialogCancel>
            <AlertDialogAction
              data-testid="product-delete-confirm"
              onClick={(e) => { e.preventDefault(); confirmDelete(); }}
              disabled={deleting}
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ========================================================================= */
/* Sub komponen                                                              */
/* ========================================================================= */

function StatCard({ icon: Icon, label, value, testid }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4" data-testid={testid}>
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className="h-4 w-4" /> {label}
      </div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function ProductCard({ product, onEdit, onColors, onSizes, onDelete, onToggleActive }) {
  const p = product;
  const colors = p.colors || [];
  const shown = colors.slice(0, 8);
  return (
    <div
      className="flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm transition hover:shadow-md"
      data-testid={`product-card-${p.product_key}`}
    >
      <div className="relative h-40 border-b border-border bg-muted">
        {p.thumbnail_url ? (
          <img src={p.thumbnail_url} alt={p.title} loading="lazy" className="h-full w-full object-contain" />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-muted-foreground">
            <Shirt className="h-8 w-8" />
            <span className="text-xs">Belum ada foto</span>
          </div>
        )}
        <div className="absolute right-2 top-2">
          <Badge variant={p.is_active ? "default" : "secondary"} data-testid={`product-status-${p.product_key}`}>
            {p.is_active ? "Aktif" : "Non-aktif"}
          </Badge>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-base font-bold leading-snug" data-testid={`product-title-${p.product_key}`}>
            {p.title}
          </h3>
          <span className="shrink-0 text-xs text-muted-foreground">#{p.sort_order}</span>
        </div>
        {p.subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{p.subtitle}</p>}
        <div className="mt-2 text-xl font-bold text-primary" data-testid={`product-price-${p.product_key}`}>
          {rp(p.price)}
        </div>

        <dl className="mt-3 space-y-1 text-xs">
          <SpecRow label="Suplier" value={p.supplier} />
          <SpecRow label="Size" value={p.size_region} />
          <SpecRow label="Model" value={p.model} />
          <SpecRow label="Bahan" value={p.material} />
        </dl>

        {/* Varian warna */}
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <span>Warna</span>
            <span data-testid={`product-color-count-${p.product_key}`}>{colors.length} varian</span>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {colors.length === 0 && <span className="text-xs text-muted-foreground">Belum ada warna</span>}
            {shown.map((c) => (
              <span
                key={c.id}
                title={`${c.name} (${c.hex})${c.thumb_url ? " — ada foto" : " — belum ada foto"}`}
                data-testid={`product-color-dot-${c.id}`}
                className={`h-5 w-5 rounded-full border ${isLight(c.hex) ? "border-zinc-300" : "border-transparent"} ${
                  c.thumb_url ? "ring-1 ring-primary ring-offset-1" : ""
                }`}
                style={{ backgroundColor: c.hex }}
              />
            ))}
            {colors.length > shown.length && (
              <span className="text-xs text-muted-foreground">+{colors.length - shown.length}</span>
            )}
          </div>
        </div>

        {/* Size chart ringkas */}
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <span>Size Chart</span>
            <span data-testid={`product-size-count-${p.product_key}`}>{(p.size_chart || []).length} ukuran</span>
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {(p.size_chart || []).length === 0 && (
              <span className="text-xs text-muted-foreground">Belum ada ukuran</span>
            )}
            {(p.size_chart || []).map((s) => (
              <span key={s.id} className="rounded border border-border px-1.5 py-0.5 text-[11px] font-semibold">
                {s.label}
              </span>
            ))}
          </div>
        </div>

        {/* Aksi */}
        <div className="mt-4 grid grid-cols-2 gap-2 border-t border-border pt-3">
          <Button data-testid={`product-edit-${p.product_key}`} variant="outline" size="sm" onClick={onEdit}>
            <Pencil className="mr-1.5 h-3.5 w-3.5" /> Ubah
          </Button>
          <Button data-testid={`product-colors-${p.product_key}`} variant="outline" size="sm" onClick={onColors}>
            <Palette className="mr-1.5 h-3.5 w-3.5" /> Warna
          </Button>
          <Button data-testid={`product-sizes-${p.product_key}`} variant="outline" size="sm" onClick={onSizes}>
            <Ruler className="mr-1.5 h-3.5 w-3.5" /> Size Chart
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button
              data-testid={`product-toggle-${p.product_key}`}
              variant="outline"
              size="sm"
              onClick={onToggleActive}
              title={p.is_active ? "Sembunyikan dari publik" : "Tampilkan ke publik"}
            >
              {p.is_active ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            </Button>
            <Button
              data-testid={`product-delete-${p.product_key}`}
              variant="outline"
              size="sm"
              onClick={onDelete}
              className="text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SpecRow({ label, value }) {
  return (
    <div className="flex justify-between gap-3 border-b border-border/60 pb-1">
      <dt className="shrink-0 font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-right">{value || "—"}</dd>
    </div>
  );
}

/* ---------------------------- Manajer warna ------------------------------ */
function ColorManager({ product, onClose, onChanged }) {
  const [form, setForm] = useState(EMPTY_COLOR);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [preview, setPreview] = useState(null);

  // Unggah 1 gambar berisi banyak warna -> dipecah jadi beberapa varian.
  const [paletteBusy, setPaletteBusy] = useState(false);
  const [paletteSrc, setPaletteSrc] = useState("");
  const [paletteItems, setPaletteItems] = useState([]);
  const [bulkSaving, setBulkSaving] = useState(false);

  useEffect(() => {
    setForm(EMPTY_COLOR);
    setEditId(null);
    setPreview(null);
    setPaletteSrc("");
    setPaletteItems([]);
  }, [product?.id]);

  const refresh = async () => {
    const { data } = await api.get(`/custom-products/${product.id}`);
    onChanged(data);
    return data;
  };

  const handleThumb = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("File harus berupa gambar");
    if (file.size > 15 * 1024 * 1024) return toast.error("Ukuran maksimal 15MB");
    setUploading(true);
    try {
      const info = await uploadImage(file, "mockup");
      setForm((f) => ({ ...f, thumb_url: info.url }));
      toast.success(`Foto warna jadi WebP ${Math.round(info.bytes / 1024)} KB`);
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail) || "Upload gagal");
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!form.name.trim()) return toast.error("Nama warna wajib diisi");
    if (!/^#([0-9a-fA-F]{6})$/.test(form.hex)) return toast.error("Kode warna harus format #RRGGBB");
    setSaving(true);
    try {
      if (editId) await api.put(`/custom-products/${product.id}/colors/${editId}`, form);
      else await api.post(`/custom-products/${product.id}/colors`, form);
      toast.success(editId ? "Warna diperbarui" : "Warna ditambahkan");
      setForm(EMPTY_COLOR);
      setEditId(null);
      await refresh();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    } finally {
      setSaving(false);
    }
  };

  /* ---- Unggah 1 gambar palet -> pecah jadi banyak warna ---- */
  const handlePaletteFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("File harus berupa gambar");
    if (file.size > 15 * 1024 * 1024) return toast.error("Ukuran maksimal 15MB");
    setPaletteBusy(true);
    try {
      const { preview: src, colors: found } = await extractPaletteFromFile(file);
      if (!found.length) {
        toast.error("Tidak ada warna yang terdeteksi pada gambar itu");
        return;
      }
      const existing = new Set((product.colors || []).map((c) => String(c.hex).toUpperCase()));
      setPaletteSrc(src);
      setPaletteItems(found.map((c, i) => ({
        key: `${c.hex}-${i}`,
        hex: c.hex,
        name: c.name,
        include: !existing.has(c.hex),
        duplicate: existing.has(c.hex),
      })));
      toast.success(`${found.length} warna terdeteksi — periksa lalu simpan`);
    } catch (err) {
      toast.error(err?.message || "Gagal membaca warna dari gambar");
    } finally {
      setPaletteBusy(false);
    }
  };

  const patchPaletteItem = (key, patch) =>
    setPaletteItems((list) => list.map((it) => (it.key === key ? { ...it, ...patch } : it)));

  const clearPalette = () => { setPaletteSrc(""); setPaletteItems([]); };

  const savePalette = async () => {
    const picked = paletteItems.filter((it) => it.include);
    if (!picked.length) return toast.error("Pilih minimal satu warna");
    const bad = picked.find((it) => !it.name.trim());
    if (bad) return toast.error("Semua warna terpilih harus punya nama");
    setBulkSaving(true);
    let ok = 0;
    const failed = [];
    for (const it of picked) {
      try {
        // eslint-disable-next-line no-await-in-loop
        await api.post(`/custom-products/${product.id}/colors`, {
          name: it.name.trim(), hex: it.hex, thumb_url: "",
        });
        ok += 1;
      } catch (err) {
        failed.push(`${it.name} (${formatApiError(err.response?.data?.detail) || "gagal"})`);
      }
    }
    setBulkSaving(false);
    if (ok) toast.success(`${ok} warna ditambahkan`);
    if (failed.length) toast.error(`Gagal: ${failed.slice(0, 3).join(", ")}${failed.length > 3 ? " ..." : ""}`);
    if (ok) clearPalette();
    await refresh();
  };

  const remove = async (c) => {    setBusyId(c.id);
    try {
      await api.delete(`/custom-products/${product.id}/colors/${c.id}`);
      toast.success(`Warna "${c.name}" dihapus`);
      await refresh();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    } finally {
      setBusyId(null);
    }
  };

  if (!product) return null;
  const colors = product.colors || [];

  return (
    <Dialog open={!!product} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-primary" /> Warna — {product.title}
          </DialogTitle>
          <DialogDescription>
            Jumlah warna di sini menentukan banyaknya ikon kaos di halaman Daftar Harga. Unggah foto
            tampak depan per warna agar pelanggan bisa melihat hasil nyatanya (PNG/JPG → WebP otomatis).
          </DialogDescription>
        </DialogHeader>

        {/* Form tambah / ubah */}
        <div className="rounded-xl border border-border bg-muted/30 p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {editId ? "Ubah Warna" : "Tambah Warna"}
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
            <Field label="Nama Warna">
              <Input
                data-testid="color-form-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Navy"
              />
            </Field>
            <Field label="Kode Warna">
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={/^#[0-9a-fA-F]{6}$/.test(form.hex) ? form.hex : "#111111"}
                  onChange={(e) => setForm((f) => ({ ...f, hex: e.target.value.toUpperCase() }))}
                  data-testid="color-form-picker"
                  className="h-10 w-12 cursor-pointer rounded border border-border bg-card p-1"
                  aria-label="Pilih warna"
                />
                <Input
                  data-testid="color-form-hex"
                  value={form.hex}
                  onChange={(e) => setForm((f) => ({ ...f, hex: e.target.value.toUpperCase() }))}
                  className="w-28 font-mono"
                  placeholder="#2B3A67"
                />
              </div>
            </Field>
            <Field label="Foto Tampak Depan">
              <div className="flex items-center gap-2">
                <div className="h-10 w-10 shrink-0 overflow-hidden rounded border border-border bg-card">
                  {form.thumb_url ? (
                    <img src={form.thumb_url} alt="Foto warna" className="h-full w-full object-contain" data-testid="color-form-thumb-preview" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                      <ImageOff className="h-4 w-4" />
                    </div>
                  )}
                </div>
                <Button
                  data-testid="color-form-upload"
                  type="button"
                  variant="outline"
                  disabled={uploading}
                  onClick={() => document.getElementById("pt-color-input")?.click()}
                >
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
                </Button>
                {form.thumb_url && (
                  <Button
                    data-testid="color-form-thumb-clear"
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setForm((f) => ({ ...f, thumb_url: "" }))}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
                <input
                  id="pt-color-input"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  data-testid="color-form-file"
                  onChange={handleThumb}
                />
              </div>
            </Field>
          </div>
          <div className="mt-3 flex gap-2">
            <Button data-testid="color-form-save" onClick={save} disabled={saving || uploading}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : editId ? <Check className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
              {editId ? "Simpan Warna" : "Tambah Warna"}
            </Button>
            {editId && (
              <Button
                data-testid="color-form-reset"
                variant="outline"
                onClick={() => { setForm(EMPTY_COLOR); setEditId(null); }}
              >
                Batal Ubah
              </Button>
            )}
          </div>
        </div>

        {/* Unggah 1 gambar berisi banyak warna -> dipecah otomatis per warna */}
        <div className="rounded-xl border border-border bg-muted/30 p-4" data-testid="palette-bulk-section">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Tambah Banyak Warna Dari 1 Gambar
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Unggah satu gambar lembar warna (misal deretan bulatan warna dari suplier). Warnanya
                dipecah otomatis jadi satu varian per warna — nama bisa diubah sebelum disimpan.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                data-testid="palette-bulk-upload"
                type="button"
                variant="outline"
                disabled={paletteBusy || bulkSaving}
                onClick={() => document.getElementById("pt-palette-input")?.click()}
              >
                {paletteBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Layers className="mr-2 h-4 w-4" />}
                {paletteBusy ? "Memproses..." : "Unggah Gambar Palet"}
              </Button>
              {paletteItems.length > 0 && (
                <Button data-testid="palette-bulk-clear" type="button" variant="ghost" onClick={clearPalette} disabled={bulkSaving}>
                  Batal
                </Button>
              )}
              <input
                id="pt-palette-input"
                type="file"
                accept="image/*"
                className="hidden"
                data-testid="palette-bulk-file"
                onChange={handlePaletteFile}
              />
            </div>
          </div>

          {paletteItems.length > 0 && (
            <div className="mt-4">
              {paletteSrc && (
                <img
                  src={paletteSrc}
                  alt="Gambar palet"
                  data-testid="palette-bulk-preview"
                  className="mb-3 max-h-32 w-full rounded-lg border border-border bg-card object-contain"
                />
              )}
              <div className="mb-2 text-xs font-semibold text-muted-foreground" data-testid="palette-bulk-count">
                {paletteItems.filter((it) => it.include).length} dari {paletteItems.length} warna dipilih
              </div>
              <div className="grid max-h-64 gap-2 overflow-y-auto sm:grid-cols-2" data-testid="palette-bulk-list">
                {paletteItems.map((it) => (
                  <div
                    key={it.key}
                    data-testid={`palette-item-${it.hex.replace("#", "")}`}
                    className={`flex items-center gap-2 rounded-lg border p-2 ${it.include ? "border-primary/40 bg-card" : "border-border bg-muted/40 opacity-60"}`}
                  >
                    <input
                      type="checkbox"
                      checked={it.include}
                      onChange={(e) => patchPaletteItem(it.key, { include: e.target.checked })}
                      data-testid={`palette-item-toggle-${it.hex.replace("#", "")}`}
                      aria-label={`Pakai warna ${it.name}`}
                      className="h-4 w-4 shrink-0 cursor-pointer"
                    />
                    <span
                      className={`h-8 w-8 shrink-0 rounded-md ${isLight(it.hex) ? "border border-zinc-300" : ""}`}
                      style={{ backgroundColor: it.hex }}
                    />
                    <div className="min-w-0 flex-1">
                      <Input
                        value={it.name}
                        onChange={(e) => patchPaletteItem(it.key, { name: e.target.value })}
                        data-testid={`palette-item-name-${it.hex.replace("#", "")}`}
                        className="h-8 text-sm"
                        placeholder="Nama warna"
                      />
                      <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                        {it.hex}{it.duplicate ? " · sudah ada" : ""}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <Button
                data-testid="palette-bulk-save"
                className="mt-3"
                onClick={savePalette}
                disabled={bulkSaving || paletteItems.every((it) => !it.include)}
              >
                {bulkSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                Simpan {paletteItems.filter((it) => it.include).length} Warna
              </Button>
            </div>
          )}
        </div>


        {/* Daftar warna */}
        <div className="mt-2">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {colors.length} varian warna
          </div>
          {colors.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground" data-testid="color-list-empty">
              Belum ada warna untuk produk ini.
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2" data-testid="color-list">
              {colors.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center gap-3 rounded-lg border border-border bg-card p-2.5"
                  data-testid={`color-row-${c.id}`}
                >
                  <button
                    type="button"
                    onClick={() => c.thumb_url && setPreview(c)}
                    title={c.thumb_url ? "Lihat foto" : "Belum ada foto"}
                    data-testid={`color-thumb-${c.id}`}
                    className="h-11 w-11 shrink-0 overflow-hidden rounded-md border border-border bg-muted"
                  >
                    {c.thumb_url ? (
                      <img src={c.thumb_url} alt={c.name} loading="lazy" className="h-full w-full object-contain" />
                    ) : (
                      <span className="block h-full w-full" style={{ backgroundColor: c.hex }} />
                    )}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`h-3.5 w-3.5 shrink-0 rounded-full ${isLight(c.hex) ? "border border-zinc-300" : ""}`}
                        style={{ backgroundColor: c.hex }}
                      />
                      <span className="truncate text-sm font-semibold">{c.name}</span>
                    </div>
                    <div className="font-mono text-[11px] text-muted-foreground">
                      {c.hex} {c.thumb_url ? "· ada foto" : "· tanpa foto"}
                    </div>
                  </div>
                  <Button
                    data-testid={`color-edit-${c.id}`}
                    variant="ghost"
                    size="icon"
                    onClick={() => { setForm({ name: c.name, hex: c.hex, thumb_url: c.thumb_url || "" }); setEditId(c.id); }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    data-testid={`color-delete-${c.id}`}
                    variant="ghost"
                    size="icon"
                    className="text-destructive"
                    disabled={busyId === c.id}
                    onClick={() => remove(c)}
                  >
                    {busyId === c.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Preview foto warna */}
        {preview && (
          <div
            className="mt-3 rounded-xl border border-border bg-muted/30 p-3"
            data-testid="color-preview-panel"
          >
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">{preview.name} — {preview.hex}</div>
              <Button data-testid="color-preview-close" variant="ghost" size="icon" onClick={() => setPreview(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <img src={preview.thumb_url} alt={preview.name} className="mx-auto mt-2 max-h-72 object-contain" />
          </div>
        )}

        <DialogFooter>
          <Button data-testid="color-manager-close" variant="outline" onClick={onClose}>Tutup</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------- Manajer size chart --------------------------- */
function SizeChartManager({ product, onClose, onChanged }) {
  const [form, setForm] = useState(EMPTY_SIZE);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => { setForm(EMPTY_SIZE); setEditId(null); }, [product?.id]);

  const refresh = async () => {
    const { data } = await api.get(`/custom-products/${product.id}`);
    onChanged(data);
  };

  const save = async () => {
    if (!form.label.trim()) return toast.error("Nama ukuran wajib diisi (mis. L)");
    if (Number(form.chest_cm) <= 0) return toast.error("Lebar dada harus lebih dari 0");
    if (Number(form.length_cm) <= 0) return toast.error("Panjang harus lebih dari 0");
    setSaving(true);
    const payload = {
      label: form.label.trim().toUpperCase(),
      chest_cm: Number(form.chest_cm),
      length_cm: Number(form.length_cm),
    };
    try {
      if (editId) await api.put(`/custom-products/${product.id}/sizes/${editId}`, payload);
      else await api.post(`/custom-products/${product.id}/sizes`, payload);
      toast.success(editId ? "Ukuran diperbarui" : "Ukuran ditambahkan");
      setForm(EMPTY_SIZE);
      setEditId(null);
      await refresh();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (s) => {
    setBusyId(s.id);
    try {
      await api.delete(`/custom-products/${product.id}/sizes/${s.id}`);
      toast.success(`Ukuran ${s.label} dihapus`);
      await refresh();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    } finally {
      setBusyId(null);
    }
  };

  if (!product) return null;
  const rows = product.size_chart || [];

  return (
    <Dialog open={!!product} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ruler className="h-5 w-5 text-primary" /> Size Chart — {product.title}
          </DialogTitle>
          <DialogDescription>
            Ukuran yang terdaftar di sini yang bisa dipilih pelanggan di desainer kaos, lengkap dengan
            lebar dada dan panjang dalam sentimeter.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-xl border border-border bg-muted/30 p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {editId ? "Ubah Ukuran" : "Tambah Ukuran"}
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <Field label="Ukuran">
              <Input
                data-testid="size-form-label"
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value.toUpperCase() }))}
                placeholder="L"
              />
            </Field>
            <Field label="Lebar Dada (cm)">
              <Input
                data-testid="size-form-chest"
                type="number"
                min={0}
                step="0.5"
                value={form.chest_cm}
                onChange={(e) => setForm((f) => ({ ...f, chest_cm: e.target.value }))}
                placeholder="52"
              />
            </Field>
            <Field label="Panjang (cm)">
              <Input
                data-testid="size-form-length"
                type="number"
                min={0}
                step="0.5"
                value={form.length_cm}
                onChange={(e) => setForm((f) => ({ ...f, length_cm: e.target.value }))}
                placeholder="72"
              />
            </Field>
          </div>
          <div className="mt-3 flex gap-2">
            <Button data-testid="size-form-save" onClick={save} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : editId ? <Check className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
              {editId ? "Simpan Ukuran" : "Tambah Ukuran"}
            </Button>
            {editId && (
              <Button
                data-testid="size-form-reset"
                variant="outline"
                onClick={() => { setForm(EMPTY_SIZE); setEditId(null); }}
              >
                Batal Ubah
              </Button>
            )}
          </div>
        </div>

        <div className="mt-2 overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm" data-testid="size-chart-table">
            <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Ukuran</th>
                <th className="px-3 py-2 text-right">Lebar Dada (cm)</th>
                <th className="px-3 py-2 text-right">Panjang (cm)</th>
                <th className="px-3 py-2 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr data-testid="size-chart-empty">
                  <td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">
                    Belum ada ukuran untuk produk ini.
                  </td>
                </tr>
              )}
              {rows.map((s) => (
                <tr key={s.id} className="border-t border-border" data-testid={`size-row-${s.label}`}>
                  <td className="px-3 py-2 font-bold">{s.label}</td>
                  <td className="px-3 py-2 text-right">{s.chest_cm}</td>
                  <td className="px-3 py-2 text-right">{s.length_cm}</td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        data-testid={`size-edit-${s.label}`}
                        variant="ghost"
                        size="icon"
                        onClick={() => { setForm({ label: s.label, chest_cm: s.chest_cm, length_cm: s.length_cm }); setEditId(s.id); }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        data-testid={`size-delete-${s.label}`}
                        variant="ghost"
                        size="icon"
                        className="text-destructive"
                        disabled={busyId === s.id}
                        onClick={() => remove(s)}
                      >
                        {busyId === s.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <DialogFooter>
          <Button data-testid="size-manager-close" variant="outline" onClick={onClose}>Tutup</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
