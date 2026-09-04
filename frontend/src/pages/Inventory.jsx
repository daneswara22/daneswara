import { useEffect, useState } from "react";
import api, { formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProductCombobox } from "@/components/ProductCombobox";
import { NumberInput } from "@/components/NumberInput";
import { toast } from "sonner";
import { ArrowDownCircle, ArrowUpCircle, SlidersHorizontal, ClipboardList, Search } from "lucide-react";

const TYPES = ["Masuk", "Keluar", "Penyesuaian", "Opname"];
const badge = {
  Masuk: "bg-emerald-500/15 text-emerald-600",
  Keluar: "bg-red-500/15 text-red-600",
  Penyesuaian: "bg-blue-500/15 text-blue-600",
  Opname: "bg-violet-500/15 text-violet-600",
};

export default function Inventory() {
  const [products, setProducts] = useState([]);
  const [moves, setMoves] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ product_id: "", type: "Masuk", qty: "", note: "" });
  const [q, setQ] = useState("");

  const load = () => {
    api.get("/products").then((r) => setProducts(r.data));
    api.get("/stock/movements").then((r) => setMoves(r.data));
  };
  useEffect(load, []);

  const save = async () => {
    if (!form.product_id || form.qty === "") return toast.error("Produk dan jumlah wajib diisi");
    try {
      await api.post("/stock", { ...form, qty: Number(form.qty) });
      toast.success("Stok diperbarui");
      setOpen(false);
      setForm({ product_id: "", type: "Masuk", qty: "", note: "" });
      load();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    }
  };

  const term = q.trim().toLowerCase();
  const fProducts = term ? products.filter((p) => p.name.toLowerCase().includes(term)) : products;
  const fMoves = term ? moves.filter((m) => (m.product_name || "").toLowerCase().includes(term)) : moves;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Manajemen Stok</p>
          <h1 className="font-display text-3xl font-bold tracking-tight">Inventory</h1>
        </div>
        <Button onClick={() => setOpen(true)} className="gap-2" data-testid="add-stock-button">
          <SlidersHorizontal className="h-4 w-4" /> Sesuaikan Stok
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari produk..." className="pl-10" data-testid="inventory-search" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-5 lg:col-span-1">
          <h3 className="mb-3 font-display font-semibold">Stok Produk</h3>
          <div className="max-h-[60vh] space-y-2 overflow-y-auto">
            {fProducts.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-md bg-secondary px-3 py-2 text-sm">
                <span className="font-medium">{p.name}</span>
                <span className={p.stock <= p.min_stock ? "font-semibold text-orange-600" : "font-semibold"}>{p.stock} {p.unit}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-5 lg:col-span-2">
          <div className="mb-3 flex items-center gap-2">
            <ClipboardList className="h-4 w-4" />
            <h3 className="font-display font-semibold">Riwayat Pergerakan Stok</h3>
          </div>
          <div className="max-h-[60vh] overflow-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="sticky top-0 bg-card text-xs uppercase text-muted-foreground">
                <tr><th className="py-2 text-left">Produk</th><th className="py-2 text-left">Tipe</th><th className="py-2 text-right">Perubahan</th><th className="py-2 text-right">Waktu</th></tr>
              </thead>
              <tbody>
                {fMoves.map((m) => (
                  <tr key={m.id} className="border-t border-border" data-testid={`stock-move-${m.id}`}>
                    <td className="py-2">{m.product_name}</td>
                    <td className="py-2"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${badge[m.type]}`}>{m.type}</span></td>
                    <td className="py-2 text-right">{m.before} → {m.after}</td>
                    <td className="py-2 text-right text-xs text-muted-foreground">{new Date(m.created_at).toLocaleString("id-ID")}</td>
                  </tr>
                ))}
                {fMoves.length === 0 && <tr><td colSpan={4} className="py-8 text-center text-muted-foreground">Belum ada pergerakan stok.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent data-testid="stock-dialog">
          <DialogHeader><DialogTitle className="font-display">Sesuaikan Stok</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Produk</Label>
              <ProductCombobox
                products={products}
                value={form.product_id}
                onChange={(v) => setForm({ ...form, product_id: v })}
                placeholder="Cari produk..."
                testId="stock-product-select"
                renderLabel={(p) => `${p.name} (stok: ${p.stock})`}
              />
            </div>
            <div className="space-y-1">
              <Label>Tipe</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger data-testid="stock-type-select"><SelectValue /></SelectTrigger>
                <SelectContent>{TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>{form.type === "Opname" ? "Stok Akhir (aktual)" : "Jumlah"}</Label>
              <NumberInput value={form.qty} onValueChange={(v) => setForm({ ...form, qty: v })} data-testid="stock-qty-input" />
            </div>
            <div className="space-y-1"><Label>Catatan</Label><Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></div>
          </div>
          <DialogFooter><Button onClick={save} className="w-full" data-testid="save-stock-button">Simpan</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
