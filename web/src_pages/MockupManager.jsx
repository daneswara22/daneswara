import { useEffect, useMemo, useState } from "react";
import api, { formatApiError, uploadImage } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Shirt, UploadCloud, Loader2, Trash2, Info, RefreshCw, Check, ImageOff, CheckCircle2, Ruler, Plus, X, FileText } from "lucide-react";

// Master data for the current product. Extendable when we support multiple products later.
const DEFAULT_PRODUCT_KEY = "premium-cotton-7200";
const DEFAULT_PRODUCT_LABEL = "New States Apparel Premium Cotton 7200";

const VIEWS = [
  { id: "front", label: "Depan" },
  { id: "back", label: "Belakang" },
  { id: "left", label: "Lengan Kiri" },
  { id: "right", label: "Lengan Kanan" },
  { id: "label", label: "Label" },
];

const COLORS = [
  { hex: "#111111", name: "Black" },
  { hex: "#E5E7EB", name: "Salmon" },
  { hex: "#8B8F94", name: "Grey" },
  { hex: "#1E2A44", name: "Navy" },
  { hex: "#5B1F1F", name: "Maroon" },
  { hex: "#B71C1C", name: "Red" },
  { hex: "#1E4FA1", name: "Royal" },
  { hex: "#2E8B57", name: "Green" },
  { hex: "#F4C400", name: "Yellow" },
  { hex: "#0F5132", name: "Forest" },
  { hex: "#3F3F46", name: "Charcoal" },
  { hex: "#F08A24", name: "Orange" },
  { hex: "#2A241C", name: "Espresso" },
  { hex: "#7C6E3A", name: "Olive" },
  { hex: "#7EA6E0", name: "Sky" },
  { hex: "#E15A2A", name: "Rust" },
  { hex: "#F6C6D3", name: "Pink" },
  { hex: "#CDB79E", name: "Tan" },
  { hex: "#5A2E9E", name: "Purple" },
  { hex: "#141414", name: "Ink" },
  { hex: "#1B2A4A", name: "Deep Navy" },
  { hex: "#C43A5C", name: "Berry" },
  { hex: "#376D50", name: "Emerald" },
  { hex: "#4B3524", name: "Coffee" },
  { hex: "#A9C3D1", name: "Powder" },
  { hex: "#C2C39A", name: "Sage" },
  { hex: "#94BFB2", name: "Mint" },
  { hex: "#A9A0C2", name: "Lavender" },
  { hex: "#BFA48C", name: "Sand" },
  { hex: "#B6892A", name: "Mustard" },
  { hex: "#B9D33A", name: "Lime" },
  { hex: "#5C4630", name: "Brown" },
  { hex: "#1E6BB8", name: "Cobalt" },
  { hex: "#D63BB8", name: "Magenta" },
];

const asKey = (colorHex, view) => `${colorHex.toUpperCase()}::${view}`;
const humanKB = (b) => (b ? `${Math.round(b / 1024)} KB` : "");

export default function MockupManager() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("front");
  const [dialog, setDialog] = useState(null); // { color, view }
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pendingImage, setPendingImage] = useState(null); // uploaded URL + meta
  const [deletingId, setDeletingId] = useState(null);
  const [productKey] = useState(DEFAULT_PRODUCT_KEY);
  const [productLabel] = useState(DEFAULT_PRODUCT_LABEL);

  const load = () => {
    setLoading(true);
    api
      .get(`/mockups?product_key=${encodeURIComponent(productKey)}`)
      .then((r) => setItems(r.data || []))
      .catch((e) => toast.error(formatApiError(e.response?.data?.detail)))
      .finally(() => setLoading(false));
  };
  useEffect(load, [productKey]);

  // O(1) lookup by color+view
  const byKey = useMemo(() => {
    const m = new Map();
    for (const it of items) m.set(asKey(it.color_hex, it.view), it);
    return m;
  }, [items]);

  const stats = useMemo(() => {
    const total = COLORS.length * VIEWS.length;
    const filled = items.length;
    const perView = VIEWS.map((v) => ({
      view: v.id,
      label: v.label,
      count: items.filter((x) => x.view === v.id).length,
    }));
    return { total, filled, perView };
  }, [items]);

  const openUpload = (color) => {
    setPendingImage(null);
    setDialog({ color, view });
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("File harus berupa gambar");
    if (file.size > 15 * 1024 * 1024) return toast.error("Ukuran maksimal 15MB (akan dikompresi ke WebP otomatis)");
    setUploading(true);
    try {
      const info = await uploadImage(file, "mockup");
      setPendingImage(info);
      toast.success(`Terkompresi ke WebP · ${humanKB(info.bytes)} · ${info.width}×${info.height}`);
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail) || "Upload foto gagal");
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!dialog) return;
    if (!pendingImage?.url) return toast.error("Unggah foto dulu");
    setSaving(true);
    try {
      await api.post("/mockups", {
        product_key: productKey,
        view: dialog.view,
        color_hex: dialog.color.hex,
        color_name: dialog.color.name,
        image: pendingImage.url,
      });
      toast.success(`Mockup ${dialog.color.name} · ${VIEWS.find((v) => v.id === dialog.view)?.label} tersimpan`);
      setDialog(null);
      setPendingImage(null);
      load();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (mock) => {
    if (!mock) return;
    if (!window.confirm(`Hapus mockup ${mock.color_name} · ${VIEWS.find((v) => v.id === mock.view)?.label}?`)) return;
    setDeletingId(mock.id);
    try {
      await api.delete(`/mockups/${mock.id}`);
      toast.success("Mockup dihapus");
      load();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    } finally {
      setDeletingId(null);
    }
  };

  const activeViewCount = stats.perView.find((v) => v.view === view)?.count || 0;

  return (
    <div className="space-y-6" data-testid="mockup-manager">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shirt className="h-6 w-6" /> Custom Design — Konten Halaman
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Kelola info produk, foto mockup per warna &amp; sudut pandang, serta panduan ukuran untuk halaman <code className="text-xs">/custom</code>.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" data-testid="mockup-stats-badge">
            {stats.filled} / {stats.total} mockup terisi
          </Badge>
          <Button variant="outline" size="sm" onClick={load} data-testid="mockup-refresh">
            <RefreshCw className="h-4 w-4 mr-1" /> Muat Ulang
          </Button>
        </div>
      </div>

      <Tabs defaultValue="info" className="space-y-4">
        <TabsList className="grid grid-cols-2 w-full sm:w-auto sm:inline-grid" data-testid="mockup-main-tabs">
          <TabsTrigger value="info" className="gap-1.5" data-testid="tab-info">
            <FileText className="h-4 w-4" /> Info Produk
          </TabsTrigger>
          <TabsTrigger value="photos" className="gap-1.5" data-testid="tab-photos">
            <Shirt className="h-4 w-4" /> Foto Mockup
          </TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="mt-2">
          <ProductInfoForm productKey={productKey} productLabel={productLabel} />
        </TabsContent>

        <TabsContent value="photos" className="mt-2 space-y-6">

      {/* Product info */}
      <div className="rounded-lg border bg-card p-4 flex items-start gap-3">
        <Info className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
        <div className="text-sm space-y-1">
          <div>
            <span className="font-semibold">Produk aktif:</span> {productLabel}
            <Badge className="ml-2" variant="outline">{productKey}</Badge>
          </div>
          <div className="text-muted-foreground">
            Upload foto per warna &amp; sudut pandang. Gambar otomatis dikompresi ke <b>WebP</b> (maks 1400px, kualitas 85) supaya ringan tanpa kehilangan detail. Rekomendasi asli minimum <b>1200×1200 px</b>, background netral, lighting merata.
          </div>
        </div>
      </div>

      {/* View tabs */}
      <Tabs value={view} onValueChange={setView}>
        <TabsList className="grid grid-cols-5 w-full sm:w-auto" data-testid="mockup-view-tabs">
          {VIEWS.map((v) => {
            const c = stats.perView.find((x) => x.view === v.id)?.count || 0;
            return (
              <TabsTrigger
                key={v.id}
                value={v.id}
                data-testid={`mockup-view-tab-${v.id}`}
                className="flex flex-col gap-0.5 py-2"
              >
                <span className="text-xs sm:text-sm">{v.label}</span>
                <span className="text-[10px] text-muted-foreground">
                  {c}/{COLORS.length}
                </span>
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>

      {/* Grid */}
      <div className="rounded-lg border bg-card p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm font-semibold">
            Sudut Pandang: <span className="text-primary">{VIEWS.find((v) => v.id === view)?.label}</span>
          </div>
          <div className="text-xs text-muted-foreground">
            {activeViewCount} dari {COLORS.length} warna sudah diunggah
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {Array.from({ length: 12 }).map((_, i) => (
              <Skeleton key={i} className="aspect-[3/4] w-full" />
            ))}
          </div>
        ) : (
          <div
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3"
            data-testid="mockup-color-grid"
          >
            {COLORS.map((c) => {
              const mock = byKey.get(asKey(c.hex, view));
              return (
                <div
                  key={c.hex + c.name}
                  className="group relative flex flex-col overflow-hidden rounded-md border bg-background transition-shadow hover:shadow-md"
                  data-testid={`mockup-cell-${c.name.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  <div className="relative aspect-[3/4] flex items-center justify-center bg-muted/40">
                    {mock ? (
                      <>
                        <img
                          src={mock.image_url}
                          alt={`${c.name} ${view}`}
                          className="h-full w-full object-contain"
                        />
                        <div className="absolute top-1.5 left-1.5">
                          <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white gap-1">
                            <CheckCircle2 className="h-3 w-3" /> {humanKB(mock.bytes)}
                          </Badge>
                        </div>
                        <div className="absolute inset-x-0 bottom-0 flex gap-1 p-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                          <Button
                            size="sm"
                            variant="secondary"
                            className="flex-1 h-7 text-xs"
                            onClick={() => openUpload(c)}
                            data-testid={`mockup-replace-${c.name.toLowerCase().replace(/\s+/g, "-")}`}
                          >
                            Ganti
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="h-7 px-2"
                            onClick={() => remove(mock)}
                            disabled={deletingId === mock.id}
                            data-testid={`mockup-delete-${c.name.toLowerCase().replace(/\s+/g, "-")}`}
                          >
                            {deletingId === mock.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                          </Button>
                        </div>
                      </>
                    ) : (
                      <button
                        onClick={() => openUpload(c)}
                        className="flex flex-col items-center justify-center gap-1.5 w-full h-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        data-testid={`mockup-upload-${c.name.toLowerCase().replace(/\s+/g, "-")}`}
                      >
                        <ImageOff className="h-5 w-5" />
                        <span className="text-[11px] font-medium">Upload</span>
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2 px-2.5 py-2 border-t bg-card">
                    <span
                      className="h-4 w-4 rounded-full border shrink-0"
                      style={{ background: c.hex }}
                      aria-hidden
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold truncate">{c.name}</div>
                      <div className="text-[10px] text-muted-foreground font-mono">{c.hex.toUpperCase()}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Upload dialog */}
      <Dialog open={!!dialog} onOpenChange={(o) => { if (!o) { setDialog(null); setPendingImage(null); } }}>
        <DialogContent className="max-w-lg" data-testid="mockup-upload-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UploadCloud className="h-5 w-5" />
              Upload Mockup {dialog?.color.name} · {VIEWS.find((v) => v.id === dialog?.view)?.label}
            </DialogTitle>
            <DialogDescription>
              File akan dikompresi ke WebP secara otomatis (maks 1400px). Format didukung: JPG, PNG, WebP.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Slot info form */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Produk</Label>
                <Input value={productLabel} disabled className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Kode Produk</Label>
                <Input value={productKey} disabled className="mt-1 font-mono" />
              </div>
              <div>
                <Label className="text-xs">Nama Warna</Label>
                <Input value={dialog?.color.name || ""} disabled className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Kode Warna</Label>
                <div className="mt-1 flex items-center gap-2">
                  <span
                    className="h-9 w-9 rounded border shrink-0"
                    style={{ background: dialog?.color.hex }}
                    aria-hidden
                  />
                  <Input value={dialog?.color.hex?.toUpperCase() || ""} disabled className="font-mono" />
                </div>
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Sudut Pandang</Label>
                <Input value={VIEWS.find((v) => v.id === dialog?.view)?.label || ""} disabled className="mt-1" />
              </div>
            </div>

            {/* Uploader */}
            <div>
              <Label className="text-xs">File Foto</Label>
              <div className="mt-1 rounded-md border-2 border-dashed p-4 text-center">
                {pendingImage?.url ? (
                  <div className="space-y-2">
                    <img
                      src={pendingImage.url}
                      alt="preview"
                      className="mx-auto max-h-52 object-contain rounded"
                    />
                    <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                      WebP · {humanKB(pendingImage.bytes)} · {pendingImage.width}×{pendingImage.height}
                    </div>
                    <label className="inline-flex items-center gap-1.5 text-xs cursor-pointer text-primary hover:underline">
                      <UploadCloud className="h-3.5 w-3.5" /> Ganti gambar
                      <input type="file" accept="image/*" className="hidden" onChange={handleFile} disabled={uploading} />
                    </label>
                  </div>
                ) : (
                  <label className="flex flex-col items-center gap-2 cursor-pointer">
                    {uploading ? (
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    ) : (
                      <UploadCloud className="h-6 w-6 text-muted-foreground" />
                    )}
                    <span className="text-sm font-medium">{uploading ? "Mengompres..." : "Klik atau seret file ke sini"}</span>
                    <span className="text-xs text-muted-foreground">Rekomendasi: 1200×1200 px, background netral</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleFile}
                      disabled={uploading}
                      data-testid="mockup-file-input"
                    />
                  </label>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => { setDialog(null); setPendingImage(null); }} data-testid="mockup-dialog-cancel">
              Batal
            </Button>
            <Button onClick={save} disabled={!pendingImage?.url || saving} data-testid="mockup-dialog-save">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Check className="h-4 w-4 mr-1" />} Simpan Mockup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ============================================================
 * ProductInfoForm — admin editor for the "Produk" panel that
 * shows up on the public /custom page. Also manages the size
 * guide image (uploaded automatically as WebP).
 * ============================================================ */
function ProductInfoForm({ productKey, productLabel }) {
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const load = () => {
    setLoading(true);
    api
      .get(`/custom-product?product_key=${encodeURIComponent(productKey)}`)
      .then((r) => setForm(r.data))
      .catch((e) => toast.error(formatApiError(e.response?.data?.detail)))
      .finally(() => setLoading(false));
  };
  useEffect(load, [productKey]);

  const update = (patch) => setForm((f) => ({ ...f, ...patch }));

  const handleSizeGuide = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("File harus gambar");
    if (file.size > 15 * 1024 * 1024) return toast.error("Ukuran maks 15MB");
    setUploading(true);
    try {
      const info = await uploadImage(file, "mockup");
      update({ size_guide_url: info.url });
      toast.success(`Panduan ukuran dikompres ke WebP · ${Math.round(info.bytes / 1024)} KB · ${info.width}×${info.height}`);
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail) || "Upload gagal");
    } finally {
      setUploading(false);
    }
  };

  const removeSizeGuide = () => update({ size_guide_url: "" });

  const setSizeAt = (idx, v) => {
    const next = [...(form.sizes || [])];
    next[idx] = v;
    update({ sizes: next });
  };
  const addSize = () => update({ sizes: [...(form.sizes || []), ""] });
  const removeSize = (idx) => update({ sizes: form.sizes.filter((_, i) => i !== idx) });

  const setSpecAt = (idx, v) => {
    const next = [...(form.specs || [])];
    next[idx] = v;
    update({ specs: next });
  };
  const addSpec = () => update({ specs: [...(form.specs || []), ""] });
  const removeSpec = (idx) => update({ specs: form.specs.filter((_, i) => i !== idx) });

  const save = async () => {
    if (!form?.title?.trim()) return toast.error("Judul wajib diisi");
    if (!form?.description?.trim()) return toast.error("Deskripsi wajib diisi");
    const cleanSizes = (form.sizes || []).map((s) => s.trim()).filter(Boolean);
    const cleanSpecs = (form.specs || []).map((s) => s.trim()).filter(Boolean);
    if (cleanSizes.length === 0) return toast.error("Isi minimal 1 ukuran");
    setSaving(true);
    try {
      const payload = {
        product_key: productKey,
        title: form.title.trim(),
        description: form.description.trim(),
        sizes: cleanSizes,
        specs: cleanSpecs,
      };
      const isNewImage = (form.size_guide_url || "").startsWith("data:image") || (form.size_guide_url || "").startsWith("http");
      if (!form.size_guide_url) payload.clear_size_guide = true;
      else if (isNewImage) payload.size_guide_image = form.size_guide_url;
      const r = await api.put("/custom-product", payload);
      setForm(r.data);
      toast.success("Info produk tersimpan");
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    } finally {
      setSaving(false);
    }
  };

  if (loading || !form) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2" data-testid="product-info-form">
      {/* Kiri: form */}
      <div className="space-y-4">
        <div>
          <Label className="text-xs">Kode Produk</Label>
          <Input value={productKey} disabled className="mt-1 font-mono" />
        </div>

        <div>
          <Label htmlFor="p-title" className="text-xs">Judul Produk</Label>
          <Input
            id="p-title"
            value={form.title}
            onChange={(e) => update({ title: e.target.value })}
            className="mt-1"
            placeholder="mis. New States Apparel Premium Cotton T-shirt 7200"
            data-testid="input-title"
          />
        </div>

        <div>
          <Label htmlFor="p-desc" className="text-xs">Deskripsi</Label>
          <Textarea
            id="p-desc"
            rows={5}
            value={form.description}
            onChange={(e) => update({ description: e.target.value })}
            className="mt-1"
            placeholder="Deskripsi singkat karakteristik produk"
            data-testid="input-description"
          />
        </div>

        {/* Sizes */}
        <div>
          <div className="flex items-center justify-between">
            <Label className="text-xs">Ukuran Tersedia</Label>
            <Button size="sm" variant="ghost" onClick={addSize} data-testid="btn-add-size">
              <Plus className="h-3.5 w-3.5 mr-1" /> Tambah
            </Button>
          </div>
          <div className="flex flex-wrap gap-2 mt-1">
            {(form.sizes || []).map((s, i) => (
              <div key={i} className="relative">
                <Input
                  value={s}
                  onChange={(e) => setSizeAt(i, e.target.value)}
                  className="w-20 pr-7 text-center font-semibold uppercase"
                  data-testid={`input-size-${i}`}
                />
                <button
                  onClick={() => removeSize(i)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-destructive"
                  aria-label="Hapus"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Specs */}
        <div>
          <div className="flex items-center justify-between">
            <Label className="text-xs">Spesifikasi</Label>
            <Button size="sm" variant="ghost" onClick={addSpec} data-testid="btn-add-spec">
              <Plus className="h-3.5 w-3.5 mr-1" /> Tambah
            </Button>
          </div>
          <div className="space-y-2 mt-1">
            {(form.specs || []).map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  value={s}
                  onChange={(e) => setSpecAt(i, e.target.value)}
                  className="flex-1"
                  placeholder="mis. 100% cotton ring spun preshrunk jersey knit."
                  data-testid={`input-spec-${i}`}
                />
                <Button size="sm" variant="ghost" onClick={() => removeSpec(i)} className="h-9 w-9 p-0">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {(form.specs || []).length === 0 && (
              <p className="text-xs text-muted-foreground italic">Belum ada spesifikasi.</p>
            )}
          </div>
        </div>

        <Button onClick={save} disabled={saving} className="w-full sm:w-auto" data-testid="btn-save-product">
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Check className="h-4 w-4 mr-1" />} Simpan Info Produk
        </Button>
      </div>

      {/* Kanan: panduan ukuran */}
      <div className="space-y-3">
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Ruler className="h-4 w-4 text-primary" />
            <h3 className="font-semibold">Panduan Ukuran</h3>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Foto/infografis panduan ukuran yang muncul ketika pelanggan klik <b>Panduan Ukuran</b> di halaman <code>/custom</code>. Otomatis dikompres ke <b>WebP</b> 1400px @ q85.
          </p>

          {form.size_guide_url ? (
            <div className="space-y-3">
              <div className="rounded-md overflow-hidden border bg-muted/40">
                <img src={form.size_guide_url} alt="Panduan ukuran" className="w-full max-h-[420px] object-contain" />
              </div>
              <div className="flex gap-2">
                <label className="flex-1 cursor-pointer">
                  <input type="file" accept="image/*" className="hidden" onChange={handleSizeGuide} disabled={uploading} data-testid="input-size-guide-file" />
                  <span className="flex items-center justify-center gap-1.5 h-9 rounded-md border text-xs font-medium hover:bg-accent transition-colors">
                    {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UploadCloud className="h-3.5 w-3.5" />}
                    Ganti Gambar
                  </span>
                </label>
                <Button variant="outline" size="sm" onClick={removeSizeGuide} data-testid="btn-remove-size-guide">
                  <Trash2 className="h-3.5 w-3.5 mr-1" /> Hapus
                </Button>
              </div>
            </div>
          ) : (
            <label className="flex flex-col items-center gap-2 cursor-pointer border-2 border-dashed rounded-md p-6 hover:bg-accent transition-colors">
              {uploading ? (
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              ) : (
                <UploadCloud className="h-6 w-6 text-muted-foreground" />
              )}
              <span className="text-sm font-medium">{uploading ? "Mengompres..." : "Upload panduan ukuran"}</span>
              <span className="text-xs text-muted-foreground">Rekomendasi rasio 1:1 atau 4:5, min 1200px</span>
              <input type="file" accept="image/*" className="hidden" onChange={handleSizeGuide} disabled={uploading} data-testid="input-size-guide-file" />
            </label>
          )}
        </div>

        {/* Preview panel like /custom */}
        <div className="rounded-lg border bg-muted/30 p-4">
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Preview di /custom</p>
          <div className="border-2 border-foreground bg-background p-4">
            <h4 className="font-bold uppercase tracking-wide text-sm leading-snug mb-2">{form.title || "Judul Produk"}</h4>
            <p className="text-xs text-muted-foreground leading-relaxed mb-3 line-clamp-4">{form.description || "Deskripsi..."}</p>
            <div className="text-xs">
              <div className="flex justify-between mb-1">
                <span className="font-semibold">Ukuran:</span>
                <span className="underline text-[10px]">Panduan Ukuran</span>
              </div>
              <p className="text-foreground/80">{(form.sizes || []).join(" – ") || "(belum ada)"}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
