import { useEffect, useState } from "react";
import api, { rupiah, formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NumberInput } from "@/components/NumberInput";
import { ProductCombobox } from "@/components/ProductCombobox";
import { toast } from "sonner";
import { Plus, PackageCheck, Trash2, ClipboardList, Search, Eye, Pencil } from "lucide-react";

export default function Purchases() {
  const { user } = useAuth();
  const isOwner = user?.role === "Owner";
  const [list, setList] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [supplierId, setSupplierId] = useState("");
  const [note, setNote] = useState("");
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [preview, setPreview] = useState(null);

  const load = () => {
    api.get("/purchases").then((r) => setList(r.data));
    api.get("/suppliers").then((r) => setSuppliers(r.data));
    api.get("/products").then((r) => setProducts(r.data));
  };
  useEffect(load, []);

  const addItem = () => setItems([...items, { product_id: "", name: "", qty: 1, cost: 0 }]);
  const setItem = (idx, patch) => setItems(items.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  const removeItem = (idx) => setItems(items.filter((_, i) => i !== idx));
  const total = items.reduce((s, i) => s + Number(i.qty || 0) * Number(i.cost || 0), 0);
  const term = q.trim().toLowerCase();
  const filtered = term
    ? list.filter((po) => `${po.po_number} ${po.supplier_name || ""} ${po.status}`.toLowerCase().includes(term))
    : list;

  const openNew = () => {
    setEditId(null); setSupplierId(""); setNote("");
    setItems([{ product_id: "", name: "", qty: 1, cost: 0 }]);
    setOpen(true);
  };
  const openEdit = (po) => {
    setEditId(po.id);
    setSupplierId(po.supplier_id || "");
    setNote(po.note || "");
    setItems((po.items || []).map((i) => ({ product_id: i.product_id, name: i.name, qty: i.qty, cost: i.cost })));
    setOpen(true);
  };

  const save = async () => {
    const valid = items.filter((i) => i.product_id && i.qty > 0);
    if (valid.length === 0) return toast.error("Tambahkan minimal 1 item");
    if (!supplierId) return toast.error("Supplier wajib dipilih");
    const payload = {
      supplier_id: supplierId || null,
      supplier_name: suppliers.find((s) => s.id === supplierId)?.name || "",
      items: valid.map((i) => ({ product_id: i.product_id, name: products.find((p) => p.id === i.product_id)?.name || i.name || "", qty: Number(i.qty), cost: Number(i.cost) })),
      note,
    };
    try {
      if (editId) { await api.put(`/purchases/${editId}`, payload); toast.success("PO diperbarui"); }
      else { await api.post("/purchases", payload); toast.success("PO dibuat"); }
      setOpen(false); setEditId(null); setItems([]); setSupplierId(""); setNote(""); load();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
  };
  const receive = async (id) => {
    if (!window.confirm("Terima barang? Stok akan bertambah otomatis.")) return;
    try { await api.post(`/purchases/${id}/receive`); toast.success("Barang diterima, stok diperbarui"); load(); }
    catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
  };
  const del = async (po) => {
    const received = po.status === "Diterima";
    const msg = received
      ? `Hapus PO ${po.po_number} yang SUDAH DITERIMA?\n\nStok barang dari PO ini akan DIKURANGI kembali agar data tetap balance. Lanjutkan?`
      : `Hapus PO ${po.po_number}?`;
    if (!window.confirm(msg)) return;
    try {
      const { data } = await api.delete(`/purchases/${po.id}`);
      toast.success(data.reversed ? "PO dihapus & stok dikoreksi" : "PO dihapus");
      load();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Pembelian</p>
          <h1 className="font-display text-3xl font-bold tracking-tight">Purchase Order</h1>
        </div>
        <Button onClick={openNew} className="gap-2" data-testid="add-po-button"><Plus className="h-4 w-4" /> Buat PO</Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari no. PO, supplier, atau status..." className="pl-10" data-testid="po-search" />
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-secondary text-xs uppercase text-muted-foreground">
            <tr><th className="px-4 py-3 text-left">No. PO</th><th className="px-4 py-3 text-left">Supplier</th><th className="px-4 py-3 text-right">Total</th><th className="px-4 py-3 text-left">Status</th><th></th></tr>
          </thead>
          <tbody>
            {filtered.map((po) => (
              <tr key={po.id} className="border-t border-border" data-testid={`po-row-${po.id}`}>
                <td className="px-4 py-3 font-medium">{po.po_number}</td>
                <td className="px-4 py-3 text-muted-foreground">{po.supplier_name || "—"}</td>
                <td className="px-4 py-3 text-right font-semibold">{rupiah(po.total)}</td>
                <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${po.status === "Diterima" ? "bg-emerald-500/15 text-emerald-600" : "bg-orange-500/15 text-orange-600"}`}>{po.status}</span></td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="ghost" className="gap-1" onClick={() => setPreview(po)} data-testid={`preview-po-${po.id}`}><Eye className="h-4 w-4" /> Preview</Button>
                    {po.status !== "Diterima" && <Button size="sm" variant="ghost" className="gap-1" onClick={() => openEdit(po)} data-testid={`edit-po-${po.id}`}><Pencil className="h-4 w-4" /> Edit</Button>}
                    {(po.status !== "Diterima" || isOwner) && <Button size="sm" variant="ghost" className="gap-1 text-destructive" onClick={() => del(po)} data-testid={`delete-po-${po.id}`}><Trash2 className="h-4 w-4" /> Hapus</Button>}
                    {po.status !== "Diterima" && <Button size="sm" variant="outline" className="gap-1" onClick={() => receive(po.id)} data-testid={`receive-po-${po.id}`}><PackageCheck className="h-4 w-4" /> Terima</Button>}
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">{term ? "Tidak ada PO cocok." : "Belum ada PO."}</td></tr>}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto" data-testid="po-dialog">
          <DialogHeader><DialogTitle className="font-display">{editId ? "Edit Purchase Order" : "Buat Purchase Order"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Supplier <span className="text-destructive">*</span></Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger data-testid="po-supplier-select"><SelectValue placeholder="Pilih supplier" /></SelectTrigger>
                <SelectContent>{suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between"><Label>Item</Label><Button size="sm" variant="ghost" onClick={addItem} data-testid="po-add-item"><Plus className="h-4 w-4" /></Button></div>
              {items.map((it, idx) => (
                <div key={idx} className="grid grid-cols-12 items-end gap-2">
                  <div className="col-span-6">
                    <ProductCombobox
                      products={products}
                      value={it.product_id}
                      onChange={(v) => setItem(idx, { product_id: v, cost: products.find((p) => p.id === v)?.cost || 0 })}
                      placeholder="Cari produk..."
                      testId={`po-item-product-${idx}`}
                    />
                  </div>
                  <div className="col-span-2"><NumberInput placeholder="Qty" value={it.qty} onValueChange={(v) => setItem(idx, { qty: v })} data-testid={`po-item-qty-${idx}`} /></div>
                  <div className="col-span-3"><NumberInput placeholder="Modal" value={it.cost} onValueChange={(v) => setItem(idx, { cost: v })} /></div>
                  <div className="col-span-1"><Button variant="ghost" size="icon" onClick={() => removeItem(idx)}><Trash2 className="h-4 w-4 text-destructive" /></Button></div>
                </div>
              ))}
            </div>
            <div className="space-y-1"><Label>Catatan</Label><Input value={note} onChange={(e) => setNote(e.target.value)} /></div>
            <div className="flex justify-between font-display text-lg font-bold"><span>Total</span><span>{rupiah(total)}</span></div>
          </div>
          <DialogFooter><Button onClick={save} className="w-full" data-testid="save-po-button">{editId ? "Simpan Perubahan" : "Simpan PO"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!preview} onOpenChange={(o) => { if (!o) setPreview(null); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto" data-testid="po-preview-dialog">
          <DialogHeader><DialogTitle className="font-display">Detail PO {preview?.po_number}</DialogTitle></DialogHeader>
          {preview && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-muted-foreground">Supplier</span><p className="font-medium">{preview.supplier_name || "—"}</p></div>
                {preview.customer_name ? <div><span className="text-muted-foreground">Pelanggan</span><p className="font-medium">{preview.customer_name}</p></div> : null}
                <div><span className="text-muted-foreground">Status</span><p><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${preview.status === "Diterima" ? "bg-emerald-500/15 text-emerald-600" : "bg-orange-500/15 text-orange-600"}`}>{preview.status}</span></p></div>
                <div><span className="text-muted-foreground">Dibuat</span><p>{preview.created_at ? new Date(preview.created_at).toLocaleString("id-ID") : "—"}</p></div>
                {preview.received_at && <div><span className="text-muted-foreground">Diterima</span><p>{new Date(preview.received_at).toLocaleString("id-ID")}</p></div>}
              </div>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-secondary text-xs uppercase text-muted-foreground">
                    <tr><th className="px-3 py-2 text-left">Produk</th><th className="px-3 py-2 text-right">Qty</th><th className="px-3 py-2 text-right">Modal</th><th className="px-3 py-2 text-right">Subtotal</th></tr>
                  </thead>
                  <tbody>
                    {(preview.items || []).map((it, i) => (
                      <tr key={i} className="border-t border-border">
                        <td className="px-3 py-2">{it.name}</td>
                        <td className="px-3 py-2 text-right">{it.qty}</td>
                        <td className="px-3 py-2 text-right">{rupiah(it.cost)}</td>
                        <td className="px-3 py-2 text-right font-medium">{rupiah(Number(it.qty) * Number(it.cost))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {preview.note && <div><span className="text-muted-foreground">Catatan</span><p>{preview.note}</p></div>}
              <div className="flex justify-between font-display text-lg font-bold"><span>Total</span><span>{rupiah(preview.total)}</span></div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
