import { useEffect, useState } from "react";
import api, { formatApiError, rupiah, uploadImage } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { NumberInput } from "@/components/NumberInput";
import { ViewToggle, useViewMode } from "@/components/ViewToggle";
import { SupplierPickerDialog } from "@/components/SupplierPickerDialog";
import { Plus, Pencil, Trash2, Search, Package, ListOrdered, ChevronUp, ChevronDown, PackagePlus, PackageCheck } from "lucide-react";

const EMPTY = { name: "", sku: "", barcode: "", category_id: "", price: "", cost: "", stock: 0, min_stock: 5, unit: "pcs", image: "", description: "", active: true };

export default function Products() {
  const { user } = useAuth();
  const canEdit = ["Owner", "Manager", "Gudang"].includes(user?.role);
  const [products, setProducts] = useState([]);
  const [cats, setCats] = useState([]);
  const [q, setQ] = useState("");
  const [sortBy, setSortBy] = useState("name");
  const [catFilter, setCatFilter] = useState("all");
  const [view, setView] = useViewMode("view-products", "list");
  const [poProduct, setPoProduct] = useState(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);

  const load = () => {
    api.get("/products").then((r) => setProducts(r.data));
    api.get("/categories").then((r) => setCats(r.data));
  };
  useEffect(load, []);

  const openNew = () => { setForm(EMPTY); setEditId(null); setOpen(true); };
  const openEdit = (p) => { setForm({ ...p, category_id: p.category_id || "" }); setEditId(p.id); setOpen(true); };

  const handleImage = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("File harus berupa gambar");
    try {
      const { url } = await uploadImage(file, "product");
      setForm((f) => ({ ...f, image: url }));
      toast.success("Gambar produk diunggah (WebP)");
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail) || "Upload gambar gagal");
    }
  };

  const save = async () => {
    if (!form.name) return toast.error("Nama produk wajib diisi");
    const payload = {
      ...form,
      category_id: form.category_id || null,
      price: Number(form.price) || 0, cost: Number(form.cost) || 0,
      stock: Number(form.stock) || 0, min_stock: Number(form.min_stock) || 0,
    };
    try {
      if (editId) await api.put(`/products/${editId}`, payload);
      else await api.post("/products", payload);
      toast.success("Produk disimpan");
      setOpen(false);
      load();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    }
  };

  const del = async (id) => {
    if (!window.confirm("Hapus produk ini?")) return;
    await api.delete(`/products/${id}`);
    toast.success("Produk dihapus");
    load();
  };

  const catName = (id) => cats.find((c) => c.id === id)?.name || "-";

  const [reorderOpen, setReorderOpen] = useState(false);
  const [reorderCat, setReorderCat] = useState("");
  const [reorderList, setReorderList] = useState([]);
  const catsWithProducts = cats.filter((c) => products.some((p) => (p.category_id || "") === c.id));
  const hasUncategorized = products.some((p) => !p.category_id);
  const buildReorder = (catId) => {
    setReorderCat(catId);
    setReorderList(products.filter((p) => (p.category_id || "none") === catId || (catId === "none" && !p.category_id)));
  };
  const openReorder = () => {
    const first = catsWithProducts[0]?.id || (hasUncategorized ? "none" : "");
    buildReorder(first);
    setReorderOpen(true);
  };
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
      await api.post("/products/reorder", { ids: reorderList.map((p) => p.id) });
      toast.success("Urutan produk disimpan");
      setReorderOpen(false);
      load();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    }
  };
  const makePO = async (p) => {
    if (p.open_po) {
      const ok = window.confirm(`Produk "${p.name}" SUDAH punya PO restok yang belum diterima (${(p.open_po_numbers || []).join(", ")}).\n\nYakin buat PO lagi? Ini bisa menyebabkan pembelian dobel.`);
      if (!ok) return;
    }
    setPoProduct(p);
  };
  const confirmPO = async (supplierId) => {
    try {
      const { data } = await api.post(`/purchases/from-product/${poProduct.id}`, { supplier_id: supplierId });
      toast.success(`PO ${data.po_number} dibuat — cek di menu Pembelian`);
      setPoProduct(null);
      load();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
  };

  const filtered = products
    .filter((p) => p.name.toLowerCase().includes(q.toLowerCase()))
    .filter((p) => catFilter === "all" || (p.category_id || "none") === catFilter)
    .sort((a, b) => {
      if (sortBy === "price") return (a.price || 0) - (b.price || 0);
      if (sortBy === "stock") return (a.stock || 0) - (b.stock || 0);
      return a.name.localeCompare(b.name, "id");
    });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Master Data</p>
          <h1 className="font-display text-3xl font-bold tracking-tight">Produk</h1>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={openReorder} className="gap-2" data-testid="reorder-products-button">
              <ListOrdered className="h-4 w-4" /> Atur Urutan
            </Button>
            <Button onClick={openNew} className="gap-2" data-testid="add-product-button">
              <Plus className="h-4 w-4" /> Tambah Produk
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari produk..." className="pl-10" data-testid="product-search" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select data-testid="products-select-1" value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[180px]" data-testid="product-sort-select"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem data-testid="products-select-item-1" value="name">Nama (A-Z)</SelectItem>
              <SelectItem data-testid="products-select-item-2" value="price">Harga (terendah)</SelectItem>
              <SelectItem data-testid="products-select-item-3" value="stock">Stok (terendah)</SelectItem>
            </SelectContent>
          </Select>
          <Select data-testid="products-select-2" value={catFilter} onValueChange={setCatFilter}>
            <SelectTrigger className="w-[180px]" data-testid="product-category-filter"><SelectValue placeholder="Semua Kategori" /></SelectTrigger>
            <SelectContent>
              <SelectItem data-testid="products-select-item-4" value="all">Semua Kategori</SelectItem>
              {cats.map((c) => <SelectItem data-testid="products-select-item-5" key={c.id} value={c.id}>{c.name}</SelectItem>)}
              {products.some((p) => !p.category_id) && <SelectItem data-testid="products-select-item-6" value="none">Tanpa Kategori</SelectItem>}
            </SelectContent>
          </Select>
          <ViewToggle data-testid="products-view-toggle-1" mode={view} onChange={setView} />
        </div>
      </div>

      {view === "list" && (
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-secondary text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left">Produk</th>
              <th className="px-4 py-3 text-left">Kategori</th>
              <th className="px-4 py-3 text-right">Harga</th>
              <th className="px-4 py-3 text-right">Stok</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {(filtered || []).map((p) => (
              <tr key={p.id} className="border-t border-border" data-testid={`product-row-${p.id}`}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-md bg-secondary">
                      <Package className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.sku || p.barcode || "—"}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{catName(p.category_id)}</td>
                <td className="px-4 py-3 text-right font-medium">{rupiah(p.price)}</td>
                <td className="px-4 py-3 text-right">
                  <span className={p.stock <= p.min_stock ? "font-semibold text-orange-600" : ""}>{p.stock} {p.unit}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  {canEdit && (
                    <div className="flex justify-end gap-1">
                      {p.stock < 0 && <Button variant="outline" size="sm" className={`h-8 gap-1 px-2 ${p.open_po ? "border-blue-500/40 text-blue-600" : "text-orange-600"}`} onClick={() => makePO(p)} data-testid={`po-product-${p.id}`} title={p.open_po ? `Sudah ada PO: ${(p.open_po_numbers || []).join(", ")}` : "Buat PO restok"}>{p.open_po ? <PackageCheck className="h-4 w-4" /> : <PackagePlus className="h-4 w-4" />} {p.open_po ? "Sudah PO" : "PO"}</Button>}
                      <Button variant="ghost" size="icon" onClick={() => openEdit(p)} data-testid={`edit-product-${p.id}`}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => del(p.id)} data-testid={`delete-product-${p.id}`}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">Belum ada produk.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      )}

      {view !== "list" && (
        <div className={`grid gap-3 ${view === "besar" ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4" : "grid-cols-3 sm:grid-cols-4 lg:grid-cols-6"}`} data-testid="product-grid">
          {(filtered || []).map((p) => (
            <div key={p.id} className="flex flex-col overflow-hidden rounded-lg border border-border bg-card" data-testid={`product-card-${p.id}`}>
              <div className={`flex flex-1 flex-col ${view === "besar" ? "p-3" : "p-2"}`}>
                <p className={`truncate font-medium ${view === "besar" ? "text-sm" : "text-xs"}`}>{p.name}</p>
                <p className="truncate text-[11px] text-muted-foreground">{catName(p.category_id)}</p>
                <div className="mt-1 flex items-center justify-between">
                  <span className={`font-display font-bold text-primary ${view === "besar" ? "text-sm" : "text-xs"}`}>{rupiah(p.price)}</span>
                  <span className={`text-[11px] ${p.stock <= p.min_stock ? "font-semibold text-orange-600" : "text-muted-foreground"}`}>{p.stock} {p.unit}</span>
                </div>
                {canEdit && (
                  <div className="mt-2 flex gap-1">
                    {p.stock < 0 && <Button variant="outline" size="sm" className={`h-7 flex-1 px-2 ${p.open_po ? "border-blue-500/40 text-blue-600" : "text-orange-600"}`} onClick={() => makePO(p)} data-testid={`po-product-${p.id}`} title={p.open_po ? `Sudah ada PO: ${(p.open_po_numbers || []).join(", ")}` : "Buat PO restok"}>{p.open_po ? <PackageCheck className="h-3 w-3" /> : <PackagePlus className="h-3 w-3" />}</Button>}
                    <Button data-testid="products-button-1" variant="outline" size="sm" className="h-7 flex-1 px-2" onClick={() => openEdit(p)}><Pencil className="h-3 w-3" /></Button>
                    <Button data-testid="products-button-2" variant="outline" size="sm" className="h-7 flex-1 px-2" onClick={() => del(p.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                  </div>
                )}
              </div>
            </div>
          ))}
          {filtered.length === 0 && <p className="col-span-full py-10 text-center text-sm text-muted-foreground">Belum ada produk.</p>}
        </div>
      )}

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setTimeout(() => { document.body.style.pointerEvents = ""; }, 100); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto" onCloseAutoFocus={() => { document.body.style.pointerEvents = ""; }} data-testid="product-dialog">
          <DialogHeader><DialogTitle className="font-display">{editId ? "Edit Produk" : "Tambah Produk"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1">
              <Label>Nama Produk</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="product-name-input" />
            </div>
            <div className="space-y-1"><Label>SKU</Label><Input data-testid="products-input-1" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} /></div>
            <div className="space-y-1"><Label>Barcode</Label><Input value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} data-testid="product-barcode-input" /></div>
            <div className="col-span-2 space-y-1">
              <Label>Kategori</Label>
              <Select data-testid="products-select-3" value={form.category_id || "none"} onValueChange={(v) => setForm({ ...form, category_id: v === "none" ? "" : v })}>
                <SelectTrigger data-testid="product-category-select"><SelectValue placeholder="Pilih kategori" /></SelectTrigger>
                <SelectContent>
                  <SelectItem data-testid="products-select-item-7" value="none">Tanpa kategori</SelectItem>
                  {cats.map((c) => <SelectItem data-testid="products-select-item-8" key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Harga Jual <span className="text-muted-foreground">(kosong/0 = harga manual di POS)</span></Label><NumberInput value={form.price} onValueChange={(v) => setForm({ ...form, price: v })} placeholder="Kosongkan untuk harga manual" data-testid="product-price-input" /></div>
            <div className="space-y-1"><Label>Harga Modal <span className="text-muted-foreground">(opsional)</span></Label><NumberInput value={form.cost} onValueChange={(v) => setForm({ ...form, cost: v })} placeholder="Boleh dikosongkan" /></div>
            <div className="space-y-1"><Label>Stok</Label><NumberInput value={form.stock} onValueChange={(v) => setForm({ ...form, stock: v })} data-testid="product-stock-input" /></div>
            <div className="space-y-1"><Label>Min. Stok</Label><NumberInput value={form.min_stock} onValueChange={(v) => setForm({ ...form, min_stock: v })} /></div>
            <div className="space-y-1"><Label>Satuan</Label><Input data-testid="products-input-2" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} /></div>
            <div className="col-span-2 space-y-1">
              <Label>Keterangan <span className="text-muted-foreground">(catatan detail produk, opsional)</span></Label>
              <Textarea value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} placeholder="Detail produk, spesifikasi, catatan internal..." data-testid="product-description-input" />
            </div>
            <div className="col-span-2 space-y-2">
              <Label>Foto Produk <span className="text-muted-foreground">(otomatis dikompres, opsional)</span></Label>
              <div className="flex items-center gap-3">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-secondary">
                  {form.image ? <img src={form.image} alt="" className="h-full w-full object-cover" /> : <Package className="h-5 w-5 text-muted-foreground" />}
                </div>
                <div className="flex-1 space-y-1">
                  <Input type="file" accept="image/*" onChange={handleImage} data-testid="product-image-input" />
                  {form.image && <button type="button" onClick={() => setForm({ ...form, image: "" })} className="text-xs text-destructive" data-testid="product-image-remove">Hapus foto</button>}
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={save} className="w-full" data-testid="save-product-button">Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={reorderOpen} onOpenChange={(o) => { setReorderOpen(o); if (!o) setTimeout(() => { document.body.style.pointerEvents = ""; }, 100); }}>
        <DialogContent className="max-h-[90vh] overflow-hidden" data-testid="reorder-dialog">
          <DialogHeader>
            <DialogTitle className="font-display">Atur Urutan Produk (POS)</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Kategori</Label>
              <Select data-testid="products-select-4" value={reorderCat} onValueChange={(v) => buildReorder(v)}>
                <SelectTrigger data-testid="reorder-category-select"><SelectValue placeholder="Pilih kategori" /></SelectTrigger>
                <SelectContent>
                  {(catsWithProducts || []).map((c) => <SelectItem data-testid="products-select-item-9" key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  {hasUncategorized && <SelectItem data-testid="products-select-item-10" value="none">Tanpa Kategori</SelectItem>}
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">Urutan ini menentukan tampilan produk di layar Kasir (POS). Gunakan panah untuk memindah naik/turun.</p>
            <div className="max-h-[50vh] space-y-1.5 overflow-y-auto pr-1" data-testid="reorder-list">
              {reorderList.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Tidak ada produk di kategori ini.</p>}
              {reorderList.map((p, idx) => (
                <div key={p.id} className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2" data-testid={`reorder-item-${p.id}`}>
                  <span className="w-6 shrink-0 text-xs font-semibold text-muted-foreground">{idx + 1}.</span>
                  <span className="flex-1 truncate text-sm">{p.name}</span>
                  <div className="flex shrink-0 gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" disabled={idx === 0} onClick={() => moveItem(idx, -1)} data-testid={`reorder-up-${p.id}`}><ChevronUp className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" disabled={idx === reorderList.length - 1} onClick={() => moveItem(idx, 1)} data-testid={`reorder-down-${p.id}`}><ChevronDown className="h-4 w-4" /></Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button data-testid="products-button-3" variant="outline" onClick={() => setReorderOpen(false)}>Batal</Button>
            <Button onClick={saveReorder} disabled={reorderList.length === 0} data-testid="reorder-save-button">Simpan Urutan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <SupplierPickerDialog
        open={!!poProduct}
        onOpenChange={(o) => { if (!o) setPoProduct(null); }}
        onConfirm={confirmPO}
        title="Pilih Supplier untuk PO Restok"
        description={poProduct ? `PO restok untuk "${poProduct.name}". Supplier wajib dipilih.` : ""}
      />
    </div>
  );
}
