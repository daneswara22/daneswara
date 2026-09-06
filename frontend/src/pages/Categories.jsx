import { useEffect, useState } from "react";
import api, { formatApiError, uploadImage } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ViewToggle, useViewMode } from "@/components/ViewToggle";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Tag, Search, ListOrdered, ChevronUp, ChevronDown } from "lucide-react";

const COLORS = ["#2563EB", "#7C3AED", "#F97316", "#10B981", "#EF4444", "#0EA5E9"];

export default function Categories() {
  const [cats, setCats] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", color: "#2563EB" });
  const [editId, setEditId] = useState(null);
  const [q, setQ] = useState("");
  const [view, setView] = useViewMode("view-categories", "besar");

  const load = () => { api.get("/categories").then((r) => setCats(r.data)); };
  useEffect(load, []);

  const handleImage = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("File harus berupa gambar");
    try {
      const { url } = await uploadImage(file, "category");
      setForm((f) => ({ ...f, image: url }));
      toast.success("Gambar kategori diunggah (WebP)");
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail) || "Upload gambar gagal");
    }
  };

  const save = async () => {
    if (!form.name) return toast.error("Nama kategori wajib diisi");
    try {
      if (editId) await api.put(`/categories/${editId}`, form);
      else await api.post("/categories", form);
      toast.success("Kategori disimpan");
      setOpen(false);
      load();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    }
  };
  const del = async (id) => {
    if (!window.confirm("Hapus kategori ini?")) return;
    await api.delete(`/categories/${id}`);
    load();
  };

  const [reorderOpen, setReorderOpen] = useState(false);
  const [reorderList, setReorderList] = useState([]);
  const openReorder = () => { setReorderList([...cats]); setReorderOpen(true); };
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
      await api.post("/categories/reorder", { ids: reorderList.map((c) => c.id) });
      toast.success("Urutan kategori disimpan");
      setReorderOpen(false);
      load();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Master Data</p>
          <h1 className="font-display text-3xl font-bold tracking-tight">Kategori</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={openReorder} className="gap-2" data-testid="reorder-categories-button">
            <ListOrdered className="h-4 w-4" /> Atur Urutan
          </Button>
          <Button onClick={() => { setForm({ name: "", color: "#2563EB", image: "" }); setEditId(null); setOpen(true); }} className="gap-2" data-testid="add-category-button">
            <Plus className="h-4 w-4" /> Tambah
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari kategori..." className="pl-10" data-testid="category-search" />
        </div>
        <ViewToggle data-testid="categories-view-toggle-1" mode={view} onChange={setView} />
      </div>

      <div className={
        view === "list" ? "space-y-2"
        : view === "kecil" ? "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5"
        : "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
      } data-testid="category-list">
        {cats.filter((c) => c.name.toLowerCase().includes(q.trim().toLowerCase())).map((c) => (
          <div key={c.id} className={`flex items-center justify-between rounded-lg border border-border bg-card ${view === "kecil" ? "p-3" : "p-4"}`} data-testid={`category-${c.id}`}>
            <div className="flex min-w-0 items-center gap-3">
              {c.image ? (
                <img src={c.image} alt={c.name} className="h-9 w-9 shrink-0 rounded-md object-cover" />
              ) : (
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md" style={{ background: `${c.color}22`, color: c.color }}>
                  <Tag className="h-4 w-4" />
                </div>
              )}
              <span className="truncate font-medium">{c.name}</span>
            </div>
            <div className="flex shrink-0 gap-1">
              <Button data-testid="categories-button-1" variant="ghost" size="icon" onClick={() => { setForm(c); setEditId(c.id); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
              <Button data-testid="categories-button-2" variant="ghost" size="icon" onClick={() => del(c.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>
          </div>
        ))}
        {cats.length === 0 && <p className="text-sm text-muted-foreground">Belum ada kategori.</p>}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent data-testid="category-dialog">
          <DialogHeader><DialogTitle className="font-display">{editId ? "Edit" : "Tambah"} Kategori</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1"><Label>Nama</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="category-name-input" /></div>
            <div className="space-y-2">
              <Label>Gambar <span className="text-muted-foreground">(otomatis dikompres, opsional)</span></Label>
              <div className="flex items-center gap-3">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-secondary">
                  {form.image ? <img src={form.image} alt="" className="h-full w-full object-cover" /> : <Tag className="h-5 w-5 text-muted-foreground" />}
                </div>
                <div className="flex-1 space-y-1">
                  <Input type="file" accept="image/*" onChange={handleImage} data-testid="category-image-input" />
                  {form.image && <button data-testid="categories-button-3" type="button" onClick={() => setForm({ ...form, image: "" })} className="text-xs text-destructive">Hapus gambar</button>}
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Warna</Label>
              <div className="flex gap-2">
                {COLORS.map((col) => (
                  <button data-testid="categories-button-4" key={col} onClick={() => setForm({ ...form, color: col })} className={`h-8 w-8 rounded-full border-2 ${form.color === col ? "border-foreground" : "border-transparent"}`} style={{ background: col }} />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter><Button onClick={save} className="w-full" data-testid="save-category-button">Simpan</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={reorderOpen} onOpenChange={(o) => { setReorderOpen(o); if (!o) setTimeout(() => { document.body.style.pointerEvents = ""; }, 100); }}>
        <DialogContent className="max-h-[90vh] overflow-hidden" data-testid="reorder-category-dialog">
          <DialogHeader>
            <DialogTitle className="font-display">Atur Urutan Kategori (POS)</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">Urutan ini menentukan tampilan kategori di layar Kasir (POS). Gunakan panah untuk memindah naik/turun.</p>
            <div className="max-h-[55vh] space-y-1.5 overflow-y-auto pr-1" data-testid="reorder-category-list">
              {reorderList.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Belum ada kategori.</p>}
              {reorderList.map((c, idx) => (
                <div key={c.id} className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2" data-testid={`reorder-category-item-${c.id}`}>
                  <span className="w-6 shrink-0 text-xs font-semibold text-muted-foreground">{idx + 1}.</span>
                  <span className="flex-1 truncate text-sm">{c.name}</span>
                  <div className="flex shrink-0 gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" disabled={idx === 0} onClick={() => moveItem(idx, -1)} data-testid={`reorder-category-up-${c.id}`}><ChevronUp className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" disabled={idx === reorderList.length - 1} onClick={() => moveItem(idx, 1)} data-testid={`reorder-category-down-${c.id}`}><ChevronDown className="h-4 w-4" /></Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button data-testid="categories-button-5" variant="outline" onClick={() => setReorderOpen(false)}>Batal</Button>
            <Button onClick={saveReorder} disabled={reorderList.length === 0} data-testid="reorder-category-save-button">Simpan Urutan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
