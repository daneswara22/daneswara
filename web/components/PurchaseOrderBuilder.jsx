import { useMemo, useState } from "react";
import { rupiah } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NumberInput } from "@/components/NumberInput";
import { toast } from "sonner";
import { Search, X, Check, Printer, FileText } from "lucide-react";

/**
 * Form Purchase Order lebar: pilih kategori (boleh lebih dari satu), daftar
 * produk mengikuti kategori, isi kolom PO per produk, lalu lihat estimasi
 * biaya dan preview ringkasan sebelum PO dibuat.
 *
 * Harga pokok diambil dari `product.cost` (modal), bukan harga jual.
 */
export function PurchaseOrderBuilder({ open, onOpenChange, products = [], suppliers = [], onSave, editPo = null }) {
  const [supplierId, setSupplierId] = useState(editPo?.supplier_id || "");
  const [note, setNote] = useState(editPo?.note || "");
  const [q, setQ] = useState("");
  const [cats, setCats] = useState([]);
  // qty per product id; hanya yang > 0 yang masuk PO
  const [qty, setQty] = useState(() => {
    const init = {};
    (editPo?.items || []).forEach((i) => { if (i.product_id) init[i.product_id] = Number(i.qty) || 0; });
    return init;
  });
  const [previewOpen, setPreviewOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const categories = useMemo(() => {
    const set = new Set();
    (products || []).forEach((p) => { if (p.category) set.add(p.category); });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [products]);

  const term = q.trim().toLowerCase();
  const visible = useMemo(() => {
    return (products || []).filter((p) => {
      if (cats.length && !cats.includes(p.category)) return false;
      if (!term) return true;
      return `${p.name} ${p.sku || ""} ${p.category || ""}`.toLowerCase().includes(term);
    });
  }, [products, cats, term]);

  const toggleCat = (c) => setCats((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  const setQtyFor = (id, v) => setQty((prev) => ({ ...prev, [id]: Math.max(0, Number(v) || 0) }));

  const lines = useMemo(() => {
    return (products || [])
      .filter((p) => Number(qty[p.id] || 0) > 0)
      .map((p) => ({
        product_id: p.id,
        name: p.name,
        qty: Number(qty[p.id]),
        cost: Number(p.cost || 0),
        subtotal: Number(qty[p.id]) * Number(p.cost || 0),
      }));
  }, [products, qty]);

  const totalQty = lines.reduce((s, l) => s + l.qty, 0);
  const totalCost = lines.reduce((s, l) => s + l.subtotal, 0);

  const reset = () => {
    setSupplierId(""); setNote(""); setQ(""); setCats([]); setQty({}); setPreviewOpen(false);
  };

  const close = (o) => {
    if (!o) reset();
    onOpenChange(o);
  };

  const submit = async () => {
    if (!supplierId) return toast.error("Supplier wajib dipilih");
    if (!lines.length) return toast.error("Isi jumlah PO minimal 1 produk");
    setSaving(true);
    try {
      await onSave({
        supplier_id: supplierId,
        supplier_name: suppliers.find((s) => s.id === supplierId)?.name || "",
        items: lines.map((l) => ({ product_id: l.product_id, name: l.name, qty: l.qty, cost: l.cost })),
        note,
      });
      reset();
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={close}>
        <DialogContent className="max-h-[92vh] w-[min(1100px,96vw)] max-w-none overflow-y-auto" data-testid="po-builder-dialog">
          <DialogHeader>
            <DialogTitle className="font-display">{editPo ? "Edit Purchase Order" : "Buat Purchase Order"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Supplier <span className="text-destructive">*</span></Label>
                <Select value={supplierId} onValueChange={setSupplierId}>
                  <SelectTrigger data-testid="po-supplier-select"><SelectValue placeholder="Pilih supplier" /></SelectTrigger>
                  <SelectContent>{suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Catatan</Label>
                <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Opsional" data-testid="po-note-input" />
              </div>
            </div>

            {/* Filter kategori — boleh pilih lebih dari satu */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Kategori</Label>
                {cats.length > 0 && (
                  <button type="button" onClick={() => setCats([])} className="text-xs text-muted-foreground hover:text-foreground">
                    Reset kategori ({cats.length})
                  </button>
                )}
              </div>
              <div className="flex max-h-24 flex-wrap gap-1.5 overflow-y-auto rounded-md border border-border p-2">
                {categories.length === 0 && <span className="text-xs text-muted-foreground">Belum ada kategori produk.</span>}
                {categories.map((c) => {
                  const on = cats.includes(c);
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => toggleCat(c)}
                      className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${on ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}
                      data-testid={`po-cat-${c}`}
                    >
                      {on && <Check className="mr-1 inline h-3 w-3" />}{c}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari produk / SKU..." className="pl-10" data-testid="po-product-search" />
            </div>

            {/* Daftar produk + kolom PO */}
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-[720px] text-sm" data-testid="po-product-table">
                <thead className="bg-secondary text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">Produk</th>
                    <th className="px-3 py-2 text-left">Kategori</th>
                    <th className="px-3 py-2 text-right">Harga Pokok</th>
                    <th className="px-3 py-2 text-right">Stok</th>
                    <th className="px-3 py-2 text-center w-28">PO</th>
                    <th className="px-3 py-2 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((p) => {
                    const n = Number(qty[p.id] || 0);
                    return (
                      <tr key={p.id} className={`border-t border-border ${n > 0 ? "bg-primary/5" : ""}`} data-testid={`po-row-${p.id}`}>
                        <td className="px-3 py-2">
                          <div className="font-medium">{p.name}</div>
                          {p.sku && <div className="text-[11px] text-muted-foreground">{p.sku}</div>}
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">{p.category || "—"}</td>
                        <td className="px-3 py-2 text-right">{rupiah(p.cost || 0)}</td>
                        <td className={`px-3 py-2 text-right text-xs ${Number(p.stock) <= 0 ? "text-destructive" : "text-muted-foreground"}`}>{p.stock ?? 0}</td>
                        <td className="px-3 py-2">
                          <NumberInput value={n} onValueChange={(v) => setQtyFor(p.id, v)} className="h-8 text-center" data-testid={`po-qty-${p.id}`} />
                        </td>
                        <td className="px-3 py-2 text-right font-medium">{n > 0 ? rupiah(n * Number(p.cost || 0)) : "—"}</td>
                      </tr>
                    );
                  })}
                  {visible.length === 0 && (
                    <tr><td colSpan={6} className="px-3 py-10 text-center text-muted-foreground">Tidak ada produk cocok.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Estimasi biaya */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-secondary/40 px-4 py-3">
              <div className="text-sm text-muted-foreground">
                {lines.length} produk dipilih · total {totalQty} pcs
              </div>
              <div className="text-right">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Estimasi Biaya</div>
                <div className="font-display text-2xl font-bold" data-testid="po-estimate-total">{rupiah(totalCost)}</div>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => close(false)}>Batal</Button>
            <Button onClick={() => setPreviewOpen(true)} disabled={!lines.length} className="gap-2" data-testid="po-preview-button">
              <FileText className="h-4 w-4" /> Preview Ringkasan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview ringkasan + cetak A5/A4 */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-h-[92vh] w-[min(820px,96vw)] max-w-none overflow-y-auto" data-testid="po-summary-dialog">
          <DialogHeader><DialogTitle className="font-display">Ringkasan Purchase Order</DialogTitle></DialogHeader>
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <div><span className="text-muted-foreground">Supplier</span><p className="font-medium">{suppliers.find((s) => s.id === supplierId)?.name || "—"}</p></div>
              <div><span className="text-muted-foreground">Tanggal</span><p>{new Date().toLocaleString("id-ID")}</p></div>
              {note && <div className="col-span-2"><span className="text-muted-foreground">Catatan</span><p>{note}</p></div>}
            </div>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-secondary text-xs uppercase text-muted-foreground">
                  <tr><th className="px-3 py-2 text-left">Produk</th><th className="px-3 py-2 text-right">Qty</th><th className="px-3 py-2 text-right">Harga Pokok</th><th className="px-3 py-2 text-right">Subtotal</th></tr>
                </thead>
                <tbody>
                  {lines.map((l) => (
                    <tr key={l.product_id} className="border-t border-border">
                      <td className="px-3 py-2">{l.name}</td>
                      <td className="px-3 py-2 text-right">{l.qty}</td>
                      <td className="px-3 py-2 text-right">{rupiah(l.cost)}</td>
                      <td className="px-3 py-2 text-right font-medium">{rupiah(l.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-between font-display text-lg font-bold"><span>Estimasi Biaya</span><span>{rupiah(totalCost)}</span></div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>Kembali</Button>
            <Button variant="outline" className="gap-2" onClick={() => printSummary({ supplierName: suppliers.find((s) => s.id === supplierId)?.name, note, lines, totalCost })} data-testid="po-print-button">
              <Printer className="h-4 w-4" /> Cetak
            </Button>
            <Button onClick={submit} disabled={saving} data-testid="po-confirm-button">
              {saving ? "Memproses..." : editPo ? "Simpan Perubahan" : "Proses PO"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * Cetak ringkasan PO. Ukuran kertas bisa dipilih A5 atau A4 lewat dialog
 * cetak browser (CSS @page menyediakan dua opsi).
 */
function printSummary({ supplierName, note, lines, totalCost }) {
  const rows = lines
    .map((l) => `<tr><td>${esc(l.name)}</td><td class="r">${l.qty}</td><td class="r">${rupiah(l.cost)}</td><td class="r">${rupiah(l.subtotal)}</td></tr>`)
    .join("");
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Purchase Order</title>
<style>
  @page { size: A5 portrait; margin: 10mm; }
  @page :first { size: A5 portrait; }
  body { font-family: Arial, Helvetica, sans-serif; color: #000; margin: 0; }
  h1 { font-size: 18pt; margin: 0 0 2mm; letter-spacing: 1px; }
  .meta { font-size: 9pt; margin-bottom: 4mm; }
  .meta b { display: inline-block; min-width: 22mm; }
  table { width: 100%; border-collapse: collapse; font-size: 9pt; }
  th { background: #eee; border-top: 1.2pt solid #000; border-bottom: 1.2pt solid #000; padding: 1.5mm; text-align: left; }
  td { padding: 1.5mm; border-bottom: 0.4pt solid #ccc; }
  .r { text-align: right; }
  .tot { margin-top: 4mm; display: flex; justify-content: space-between; font-size: 12pt; font-weight: bold; border-top: 1.2pt solid #000; padding-top: 2mm; }
  .note { margin-top: 3mm; font-size: 9pt; }
  @media print { .hint { display: none; } }
  .hint { font-size: 8pt; color: #666; margin-top: 4mm; }
</style></head><body>
  <h1>PURCHASE ORDER</h1>
  <div class="meta">
    <div><b>Supplier</b>: ${esc(supplierName || "-")}</div>
    <div><b>Tanggal</b>: ${new Date().toLocaleString("id-ID")}</div>
  </div>
  <table><thead><tr><th>Produk</th><th class="r">Qty</th><th class="r">Harga Pokok</th><th class="r">Subtotal</th></tr></thead>
  <tbody>${rows}</tbody></table>
  <div class="tot"><span>ESTIMASI BIAYA</span><span>${rupiah(totalCost)}</span></div>
  ${note ? `<div class="note"><b>Catatan:</b> ${esc(note)}</div>` : ""}
  <div class="hint">Untuk kertas A4, pilih ukuran A4 pada dialog cetak browser.</div>
</body></html>`;

  const iframe = document.createElement("iframe");
  iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow.document;
  doc.open(); doc.write(html); doc.close();
  const fire = () => { try { iframe.contentWindow.focus(); iframe.contentWindow.print(); } catch (e) { /* ignore */ } };
  iframe.onload = fire;
  setTimeout(fire, 400);
  setTimeout(() => { try { document.body.removeChild(iframe); } catch (e) { /* ignore */ } }, 60000);
}

const esc = (v) => String(v == null ? "" : v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
