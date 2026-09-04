import { useEffect, useMemo, useState } from "react";
import api, { formatApiError, uploadImage } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Images, Search, ListOrdered, ChevronUp, ChevronDown, ExternalLink, UploadCloud, Loader2, RefreshCw } from "lucide-react";

const TAGS = ["DTF", "Sablon", "Screen Print", "Bordir", "Bulk", "Store", "Custom"];
const SPANS = [
  { value: "", label: "Normal (1x1)" },
  { value: "lg:col-span-2", label: "Lebar (2 kolom)" },
  { value: "lg:row-span-2", label: "Tinggi (2 baris)" },
  { value: "lg:row-span-2 lg:col-span-2", label: "Besar (2x2)" },
];
const EMPTY = { src: "", label: "", tag: "DTF", span: "", sort_order: 0 };

export default function GalleryManager() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reorderOpen, setReorderOpen] = useState(false);
  const [reorderList, setReorderList] = useState([]);

  const load = () => {
    setLoading(true);
    api.get("/gallery").then((r) => setItems(r.data)).catch((e) => toast.error(formatApiError(e.response?.data?.detail))).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? items.filter((g) => `${g.label} ${g.tag}`.toLowerCase().includes(s)) : items;
  }, [items, q]);

  const handleImage = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("File harus berupa gambar");
    setUploading(true);
    try {
      const info = await uploadImage(file, "gallery");
      setForm((f) => ({ ...f, src: info.url, label: f.label || file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").toUpperCase() }));
      toast.success(`Foto diunggah (WebP ${Math.round(info.bytes / 1024)} KB, ${info.width}x${info.height})`);
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail) || "Upload foto gagal");
    } finally {
      setUploading(false);
    }
  };

  const openAdd = () => { setForm(EMPTY); setEditId(null); setOpen(true); };
  const openEdit = (g) => { setForm({ src: g.src, label: g.label, tag: g.tag || "", span: g.span || "", sort_order: g.sort_order || 0 }); setEditId(g.id); setOpen(true); };

  const save = async () => {
    if (!form.src) return toast.error("Unggah foto dulu");
    if (!form.label.trim()) return toast.error("Label wajib diisi");
    setSaving(true);
    try {
      if (editId) await api.put(`/gallery/${editId}`, form);
      else await api.post("/gallery", form);
      toast.success(editId ? "Foto galeri diperbarui" : "Foto ditambahkan ke galeri website");
      setOpen(false);
      load();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    } finally {
      setSaving(false);
    }
  };

  const del = async (g) => {
    if (!window.confirm(`Hapus "${g.label}" dari galeri website?`)) return;
    try {
      await api.delete(`/gallery/${g.id}`);
      toast.success("Foto dihapus");
      load();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    }
  };

  const openReorder = () => { setReorderList([...items]); setReorderOpen(true); };
  const moveItem = (idx, dir) => {
    setReorderList((list) => {
      const j = idx + dir;
      if (j < 0 || j >= list.length) return list;
      const next = [...list];
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });
  };
  const saveReorder = async () => {
    try {
      await api.post("/gallery/reorder", { ids: reorderList.map((g) => g.id) });
      toast.success("Urutan galeri disimpan");
      setReorderOpen(false);
      load();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    }
  };

  return (
    <div className="space-y-6" data-testid="gallery-manager-page">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Website</p>
          <h1 className="font-display text-3xl font-bold tracking-tight">Galeri Website</h1>
          <p className="mt-1 text-sm text-muted-foreground">Foto yang tampil di halaman utama & halaman Galeri daneswaraprint. 6 foto pertama tampil di beranda.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild className="gap-2">
            <a href="/galeri" target="_blank" rel="noreferrer" data-testid="gallery-view-site"><ExternalLink className="h-4 w-4" /> Lihat di Website</a>
          </Button>
          <Button variant="outline" onClick={openReorder} className="gap-2" data-testid="reorder-gallery-button">
            <ListOrdered className="h-4 w-4" /> Atur Urutan
          </Button>
          <Button onClick={openAdd} className="gap-2" data-testid="add-gallery-button">
            <Plus className="h-4 w-4" /> Tambah Foto
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari label / tag..." className="pl-10" data-testid="gallery-search" />
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Badge variant="secondary" data-testid="gallery-count">{items.length} foto</Badge>
          <Button variant="ghost" size="icon" onClick={load} title="Muat ulang" data-testid="gallery-refresh"><RefreshCw className="h-4 w-4" /></Button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" data-testid="gallery-loading">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="aspect-[4/3] rounded-lg" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card py-16 text-center" data-testid="gallery-empty">
          <Images className="h-10 w-10 text-muted-foreground" />
          <p className="mt-3 font-medium">{items.length === 0 ? "Belum ada foto galeri" : "Tidak ada foto yang cocok"}</p>
          <p className="text-sm text-muted-foreground">Unggah foto hasil produksi untuk ditampilkan di website.</p>
          {items.length === 0 && <Button onClick={openAdd} className="mt-4 gap-2"><Plus className="h-4 w-4" /> Tambah Foto</Button>}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" data-testid="gallery-grid">
          {filtered.map((g, i) => (
            <div key={g.id} className="group overflow-hidden rounded-lg border border-border bg-card" data-testid={`gallery-item-${g.id}`}>
              <div className="relative aspect-[4/3] bg-secondary">
                <img src={g.src} alt={g.label} loading="lazy" className="h-full w-full object-cover" />
                {i < 6 && <Badge className="absolute left-2 top-2" data-testid={`gallery-home-badge-${g.id}`}>Beranda</Badge>}
                <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <Button variant="secondary" size="icon" className="h-8 w-8" onClick={() => openEdit(g)} data-testid={`gallery-edit-${g.id}`}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="secondary" size="icon" className="h-8 w-8" onClick={() => del(g)} data-testid={`gallery-delete-${g.id}`}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </div>
              <div className="flex items-center justify-between gap-2 px-3 py-2">
                <span className="truncate text-sm font-medium" title={g.label}>{g.label}</span>
                <span className="shrink-0 text-[10px] font-bold uppercase tracking-[0.15em] text-primary">{g.tag}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent data-testid="gallery-dialog">
          <DialogHeader><DialogTitle className="font-display">{editId ? "Edit" : "Tambah"} Foto Galeri</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Foto <span className="text-muted-foreground">(otomatis dikonversi ke WebP & disimpan di cloud)</span></Label>
              <div className="flex items-start gap-3">
                <div className="flex h-28 w-36 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-secondary">
                  {uploading ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : form.src ? <img src={form.src} alt="" className="h-full w-full object-cover" data-testid="gallery-form-preview" /> : <UploadCloud className="h-6 w-6 text-muted-foreground" />}
                </div>
                <div className="flex-1 space-y-1">
                  <Input type="file" accept="image/*" onChange={handleImage} disabled={uploading} data-testid="gallery-image-input" />
                  <p className="text-xs text-muted-foreground">JPG/PNG/WebP hingga 15MB. Disarankan rasio 4:3 atau 1:1.</p>
                  {form.src && <button type="button" onClick={() => setForm({ ...form, src: "" })} className="text-xs text-destructive" data-testid="gallery-remove-image">Hapus foto</button>}
                </div>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Label</Label>
              <Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="Contoh: GILI T-SHIRTS" data-testid="gallery-label-input" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Tag</Label>
                <Input list="gallery-tags" value={form.tag} onChange={(e) => setForm({ ...form, tag: e.target.value })} placeholder="DTF, Sablon, Bordir..." data-testid="gallery-tag-input" />
                <datalist id="gallery-tags">{TAGS.map((t) => <option key={t} value={t} />)}</datalist>
              </div>
              <div className="space-y-1">
                <Label>Ukuran di grid</Label>
                <Select value={form.span || "__none"} onValueChange={(v) => setForm({ ...form, span: v === "__none" ? "" : v })}>
                  <SelectTrigger data-testid="gallery-span-select"><SelectValue /></SelectTrigger>
                  <SelectContent>{SPANS.map((s) => <SelectItem key={s.value || "__none"} value={s.value || "__none"}>{s.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={save} className="w-full" disabled={saving || uploading} data-testid="save-gallery-button">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={reorderOpen} onOpenChange={(o) => { setReorderOpen(o); if (!o) setTimeout(() => { document.body.style.pointerEvents = ""; }, 100); }}>
        <DialogContent className="max-h-[90vh] overflow-hidden" data-testid="reorder-gallery-dialog">
          <DialogHeader><DialogTitle className="font-display">Atur Urutan Galeri</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">Urutan teratas tampil paling depan di website. 6 teratas muncul di beranda.</p>
            <div className="max-h-[55vh] space-y-1.5 overflow-y-auto pr-1" data-testid="reorder-gallery-list">
              {reorderList.map((g, idx) => (
                <div key={g.id} className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2" data-testid={`reorder-gallery-item-${g.id}`}>
                  <span className="w-6 shrink-0 text-xs font-semibold text-muted-foreground">{idx + 1}.</span>
                  <img src={g.src} alt="" className="h-9 w-12 shrink-0 rounded object-cover" />
                  <span className="flex-1 truncate text-sm">{g.label}</span>
                  <div className="flex shrink-0 gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" disabled={idx === 0} onClick={() => moveItem(idx, -1)} data-testid={`reorder-gallery-up-${g.id}`}><ChevronUp className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" disabled={idx === reorderList.length - 1} onClick={() => moveItem(idx, 1)} data-testid={`reorder-gallery-down-${g.id}`}><ChevronDown className="h-4 w-4" /></Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter><Button onClick={saveReorder} className="w-full" data-testid="save-reorder-gallery-button">Simpan Urutan</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
