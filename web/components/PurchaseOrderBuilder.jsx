import { useMemo, useState, Fragment } from "react";
import { rupiah } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NumberInput } from "@/components/NumberInput";
import { toast } from "sonner";
import { Search, Check, Printer, FileText, ArrowLeft, ChevronDown, X, Image as ImageIcon } from "lucide-react";

/**
 * Halaman Purchase Order layar penuh.
 *
 * - Kategori berupa dropdown dengan centang; bisa pilih lebih dari satu.
 * - Daftar produk mengikuti kategori yang dicentang + pencarian.
 * - Kolom PO per produk; subtotal per baris.
 * - Summary (jumlah produk, total qty, estimasi biaya) menempel di atas
 *   (sticky) sehingga tetap terlihat saat daftar produk di-scroll.
 *
 * Harga pokok diambil dari `product.cost` (modal), bukan harga jual.
 */
export function PurchaseOrderBuilder({ open, onOpenChange, products = [], suppliers = [], categories = [], onSave, editPo = null }) {
  const [supplierId, setSupplierId] = useState(editPo?.supplier_id || "");
  const [note, setNote] = useState(editPo?.note || "");
  const [q, setQ] = useState("");
  const [cats, setCats] = useState([]);
  const [catOpen, setCatOpen] = useState(false);
  const [qty, setQty] = useState(() => {
    const init = {};
    (editPo?.items || []).forEach((i) => { if (i.product_id) init[i.product_id] = Number(i.qty) || 0; });
    return init;
  });
  const [previewOpen, setPreviewOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Produk hanya menyimpan category_id, jadi nama kategori diambil dari daftar
  // kategori (endpoint /categories) â€” sama seperti halaman Produk.
  const catName = useMemo(() => {
    const map = {};
    (categories || []).forEach((c) => { map[c.id] = c.name; });
    return map;
  }, [categories]);

  const catList = useMemo(() => {
    const set = new Set();
    (products || []).forEach((p) => {
      const n = p.category_id ? catName[p.category_id] : "";
      if (n) set.add(n);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [products, catName]);

  const term = q.trim().toLowerCase();
  const visible = useMemo(() => {
    return (products || []).filter((p) => {
      const cname = p.category_id ? catName[p.category_id] || "" : "";
      if (cats.length && !cats.includes(cname)) return false;
      if (!term) return true;
      return `${p.name} ${p.sku || ""} ${cname}`.toLowerCase().includes(term);
    });
  }, [products, cats, term, catName]);

  const toggleCat = (c) => setCats((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  const setQtyFor = (id, v) => setQty((prev) => ({ ...prev, [id]: Math.max(0, Number(v) || 0) }));

  const lines = useMemo(() => {
    return (products || [])
      .filter((p) => Number(qty[p.id] || 0) > 0)
      .map((p) => ({
        product_id: p.id,
        name: p.name,
        category_id: p.category_id || "",
        qty: Number(qty[p.id]),
        cost: Number(p.cost || 0),
        subtotal: Number(qty[p.id]) * Number(p.cost || 0),
      }));
  }, [products, qty]);

  const totalQty = lines.reduce((s, l) => s + l.qty, 0);
  const totalCost = lines.reduce((s, l) => s + l.subtotal, 0);

  const reset = () => {
    setSupplierId(""); setNote(""); setQ(""); setCats([]); setQty({}); setPreviewOpen(false); setCatOpen(false);
  };

  const close = () => { reset(); onOpenChange(false); };

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

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background" data-testid="po-builder-page">
      {/* Header halaman */}
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3 lg:px-8">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={close} data-testid="po-back-button">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Pembelian</p>
            <h1 className="font-display text-xl font-bold">{editPo ? "Edit Purchase Order" : "Buat Purchase Order"}</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={close}>Batal</Button>
          <Button onClick={() => setPreviewOpen(true)} disabled={!lines.length} className="gap-2" data-testid="po-preview-button">
            <FileText className="h-4 w-4" /> Preview &amp; Proses
          </Button>
        </div>
      </div>

      {/* Summary sticky â€” tetap terlihat saat daftar produk di-scroll */}
      <div className="sticky top-0 z-20 shrink-0 border-b border-border bg-card/95 px-4 py-3 backdrop-blur-xl lg:px-8" data-testid="po-summary-bar">
        <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
          <div className="min-w-[180px] flex-1">
            <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Supplier <span className="text-destructive">*</span></Label>
            <Select value={supplierId} onValueChange={setSupplierId}>
              <SelectTrigger className="mt-1 h-9" data-testid="po-supplier-select"><SelectValue placeholder="Pilih supplier" /></SelectTrigger>
              <SelectContent>{suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="min-w-[160px] flex-1">
            <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Catatan</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Opsional" className="mt-1 h-9" data-testid="po-note-input" />
          </div>
          <div className="text-right">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Produk</div>
            <div className="font-display text-lg font-bold" data-testid="po-summary-lines">{lines.length}</div>
          </div>
          <div className="text-right">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Total Qty</div>
            <div className="font-display text-lg font-bold" data-testid="po-summary-qty">{totalQty}</div>
          </div>
          <div className="text-right">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Estimasi Biaya</div>
            <div className="font-display text-2xl font-bold text-primary" data-testid="po-estimate-total">{rupiah(totalCost)}</div>
          </div>
        </div>
      </div>

      {/* Toolbar filter */}
      <div className="shrink-0 border-b border-border px-4 py-3 lg:px-8">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari produk / SKU..." className="pl-10" data-testid="po-product-search" />
          </div>

          {/* Dropdown kategori dengan centang */}
          <div className="relative">
            <Button
              variant="outline"
              onClick={() => setCatOpen((v) => !v)}
              className="gap-2"
              data-testid="po-category-dropdown"
            >
              Kategori{cats.length > 0 ? ` (${cats.length})` : ""}
              <ChevronDown className={`h-4 w-4 transition-transform ${catOpen ? "rotate-180" : ""}`} />
            </Button>
            {catOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setCatOpen(false)} />
                <div className="absolute right-0 z-40 mt-1 max-h-80 w-64 overflow-y-auto rounded-md border border-border bg-popover p-1 shadow-lg" data-testid="po-category-menu">
                  <div className="flex items-center justify-between px-2 py-1.5">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pilih kategori</span>
                    {cats.length > 0 && (
                      <button type="button" onClick={() => setCats([])} className="text-xs text-muted-foreground hover:text-foreground">Reset</button>
                    )}
                  </div>
                  {catList.length === 0 && <div className="px-2 py-3 text-xs text-muted-foreground">Belum ada kategori produk.</div>}
                  {catList.map((c) => {
                    const on = cats.includes(c);
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => toggleCat(c)}
                        className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-secondary ${on ? "font-medium" : ""}`}
                        data-testid={`po-cat-${c}`}
                      >
                        <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${on ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40"}`}>
                          {on && <Check className="h-3 w-3" />}
                        </span>
                        <span className="truncate">{c}</span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {cats.length > 0 && (
            <div className="flex flex-wrap items-center gap-1">
              {cats.map((c) => (
                <span key={c} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                  {c}
                  <button type="button" onClick={() => toggleCat(c)} aria-label={`Hapus ${c}`}><X className="h-3 w-3" /></button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Daftar produk â€” satu-satunya area yang scroll */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 lg:px-8">
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[760px] text-sm" data-testid="po-product-table">
            <thead className="sticky top-0 z-10 bg-secondary text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Produk</th>
                <th className="px-3 py-2 text-left">Kategori</th>
                <th className="px-3 py-2 text-right">Harga Pokok</th>
                <th className="px-3 py-2 text-right">Stok</th>
                <th className="w-28 px-3 py-2 text-center">PO</th>
                <th className="px-3 py-2 text-right">Total Stok</th>
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
                    <td className="px-3 py-2 text-xs text-muted-foreground">{(p.category_id && catName[p.category_id]) || "â€”"}</td>
                    <td className="px-3 py-2 text-right">{rupiah(p.cost || 0)}</td>
                    <td className={`px-3 py-2 text-right text-xs ${Number(p.stock) <= 0 ? "text-destructive" : "text-muted-foreground"}`}>{p.stock ?? 0}</td>
                    <td className="px-3 py-2">
                      <NumberInput value={n} onValueChange={(v) => setQtyFor(p.id, v)} className="h-8 text-center" data-testid={`po-qty-${p.id}`} />
                    </td>
                    <td className={`px-3 py-2 text-right font-medium ${n > 0 ? "text-primary" : "text-muted-foreground"}`} data-testid={`po-total-stock-${p.id}`}>
                      {Number(p.stock || 0) + n}
                    </td>
                    <td className="px-3 py-2 text-right font-medium">{n > 0 ? rupiah(n * Number(p.cost || 0)) : "â€”"}</td>
                  </tr>
                );
              })}
              {visible.length === 0 && (
                <tr><td colSpan={7} className="px-3 py-12 text-center text-muted-foreground">Tidak ada produk cocok.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Preview ringkasan + cetak A5/A4 */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-h-[92vh] w-[min(820px,96vw)] max-w-none overflow-y-auto" data-testid="po-summary-dialog">
          <DialogHeader><DialogTitle className="font-display">Ringkasan Purchase Order</DialogTitle></DialogHeader>
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <div><span className="text-muted-foreground">Supplier</span><p className="font-medium">{suppliers.find((s) => s.id === supplierId)?.name || "â€”"}</p></div>
              <div><span className="text-muted-foreground">Tanggal</span><p>{new Date().toLocaleString("id-ID")}</p></div>
              {note && <div className="col-span-2"><span className="text-muted-foreground">Catatan</span><p>{note}</p></div>}
            </div>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-secondary text-xs uppercase text-muted-foreground">
                  <tr><th className="px-3 py-2 text-left">Produk</th><th className="px-3 py-2 text-right">Qty</th><th className="px-3 py-2 text-right">Harga Pokok</th><th className="px-3 py-2 text-right">Subtotal</th></tr>
                </thead>
                <tbody>
                  {groupLines(lines, catName).map((g) => (
                    <Fragment key={g.category}>
                      <tr className="bg-secondary/60">
                        <td colSpan={3} className="px-3 py-1.5 text-xs font-bold uppercase tracking-wide">{g.category}</td>
                        <td className="px-3 py-1.5 text-right text-xs font-semibold text-muted-foreground">{g.qty} pcs</td>
                      </tr>
                      {g.rows.map((l) => (
                        <tr key={l.product_id} className="border-t border-border">
                          <td className="px-3 py-2">{l.color} &middot; {l.size}</td>
                          <td className="px-3 py-2 text-right">{l.qty}</td>
                          <td className="px-3 py-2 text-right">{rupiah(l.cost)}</td>
                          <td className="px-3 py-2 text-right font-medium">{rupiah(l.subtotal)}</td>
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Jumlah produk : {lines.length}</span>
              <span>Total qty : {totalQty} pcs</span>
            </div>
            <div className="flex justify-between font-display text-lg font-bold"><span>Estimasi Biaya</span><span>{rupiah(totalCost)}</span></div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>Kembali</Button>
            <Button variant="outline" className="gap-2" onClick={() => printSummary({ supplierName: suppliers.find((s) => s.id === supplierId)?.name, note, lines, totalCost, catName })} data-testid="po-print-button">
              <Printer className="h-4 w-4" /> Cetak
            </Button>
            <Button variant="outline" className="gap-2" onClick={() => makeImage({ supplierName: suppliers.find((s) => s.id === supplierId)?.name, note, lines, catName })} data-testid="po-image-button">
              <ImageIcon className="h-4 w-4" /> Buat Gambar
            </Button>
            <Button onClick={submit} disabled={saving} data-testid="po-confirm-button">
              {saving ? "Memproses..." : editPo ? "Simpan Perubahan" : "Proses PO"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * Buat gambar ringkasan PO untuk dikirim ke supplier.
 *
 * Sengaja TANPA harga: hanya nama produk, qty, dan ringkasan total item.
 * Digambar langsung ke canvas (bukan html2canvas) supaya hasilnya tajam,
 * ukurannya wajar untuk WhatsApp, dan tidak bergantung pada font eksternal.
 */
async function makeImage({ supplierName, note, lines, catName }) {
  const groups = groupLines(lines, catName);
  const DPR = 2;
  const W = 780;
  const PAD = 34;
  const ROW_H = 42;
  const CAT_H = 44;
  const TOTAL_H = 40;
  const HEAD_H = 150;
  const GAP = 22;
  const totalQty = lines.reduce((s, l) => s + l.qty, 0);

  // Lebar kolom: Produk | Size | Qty
  const COL_SIZE = 110;
  const COL_QTY = 90;
  const colSizeX = W - PAD - COL_QTY - COL_SIZE;
  const colQtyX = W - PAD;

  // Tinggi total dihitung lebih dulu supaya canvas pas tanpa ruang kosong.
  let bodyH = 0;
  groups.forEach((g) => { bodyH += CAT_H + g.rows.length * ROW_H + TOTAL_H + GAP; });
  const noteLines = note ? wrapText(note, 58) : [];
  const FOOT_H = 40 + (noteLines.length ? 26 + noteLines.length * 22 : 0);
  const H = HEAD_H + bodyH + FOOT_H;

  const canvas = document.createElement("canvas");
  canvas.width = W * DPR;
  canvas.height = H * DPR;
  const ctx = canvas.getContext("2d");
  ctx.scale(DPR, DPR);
  ctx.textBaseline = "top";

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  // ---- Header ----
  ctx.fillStyle = "#000000";
  ctx.font = "bold 34px Arial, Helvetica, sans-serif";
  ctx.fillText("PURCHASE ORDER", PAD, PAD);

  const tanggal = new Date().toLocaleString("id-ID", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).replace(/\./g, ":");

  let y = PAD + 52;
  ctx.font = "bold 17px Arial, Helvetica, sans-serif";
  ctx.fillText("Supplier", PAD, y);
  ctx.fillText(":", PAD + 96, y);
  ctx.font = "17px Arial, Helvetica, sans-serif";
  ctx.fillText(supplierName || "-", PAD + 116, y);

  y += 26;
  ctx.font = "bold 17px Arial, Helvetica, sans-serif";
  ctx.fillText("Tanggal", PAD, y);
  ctx.fillText(":", PAD + 96, y);
  ctx.font = "17px Arial, Helvetica, sans-serif";
  ctx.fillText(tanggal, PAD + 116, y);

  // ---- Kepala tabel ----
  y = HEAD_H - 34;
  ctx.fillStyle = "#e8e8e8";
  ctx.fillRect(PAD, y, W - PAD * 2, 34);
  ctx.fillStyle = "#000000";
  ctx.font = "bold 17px Arial, Helvetica, sans-serif";
  ctx.fillText("Produk", PAD + 12, y + 8);
  ctx.fillText("Size", colSizeX, y + 8);
  ctx.textAlign = "right";
  ctx.fillText("Qty", colQtyX - 12, y + 8);
  ctx.textAlign = "left";
  y += 34;
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(PAD, y); ctx.lineTo(W - PAD, y); ctx.stroke();

  // ---- Body: per kategori ----
  groups.forEach((g) => {
    // Judul kategori
    ctx.fillStyle = "#e8e8e8";
    ctx.fillRect(PAD, y, W - PAD * 2, CAT_H);
    ctx.fillStyle = "#000000";
    ctx.font = "bold 18px Arial, Helvetica, sans-serif";
    ctx.fillText(g.category, PAD + 12, y + 12);
    y += CAT_H;

    // Baris produk: nama tanpa ukuran, kolom Size terpisah
    g.rows.forEach((r) => {
      ctx.fillStyle = "#000000";
      ctx.font = "17px Arial, Helvetica, sans-serif";
      const baseName = String(r.name || "").replace(new RegExp(`\\s*${escapeRe(r.size)}\\s*$`, "i"), "").trim() || r.name;
      const shown = baseName.length > 34 ? `${baseName.slice(0, 33)}â€¦` : baseName;
      ctx.fillText(shown, PAD + 12, y + 11);
      ctx.fillText(r.size, colSizeX, y + 11);
      ctx.textAlign = "right";
      ctx.fillText(String(r.qty), colQtyX - 12, y + 11);
      ctx.textAlign = "left";
      y += ROW_H;
      ctx.strokeStyle = "#d4d4d4";
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(PAD, y); ctx.lineTo(W - PAD, y); ctx.stroke();
    });

    // Total per kategori
    ctx.fillStyle = "#e8e8e8";
    ctx.fillRect(PAD, y, W - PAD * 2, TOTAL_H);
    ctx.fillStyle = "#000000";
    ctx.font = "bold 17px Arial, Helvetica, sans-serif";
    ctx.fillText(`TOTAL PESANAN ${g.category.toUpperCase()}`, PAD + 12, y + 11);
    ctx.textAlign = "right";
    ctx.fillText(`${g.qty} pcs`, colQtyX - 12, y + 11);
    ctx.textAlign = "left";
    y += TOTAL_H + GAP;
  });

  // ---- Ringkasan ----
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(PAD, y); ctx.lineTo(W - PAD, y); ctx.stroke();
  y += 16;

  ctx.fillStyle = "#000000";
  ctx.font = "bold 16px Arial, Helvetica, sans-serif";
  ctx.fillText("RINGKASAN", PAD, y);
  y += 26;
  ctx.font = "16px Arial, Helvetica, sans-serif";
  ctx.fillText(`Jumlah produk : ${lines.length}`, PAD, y);
  ctx.textAlign = "right";
  ctx.fillText(`Total qty : ${totalQty} pcs`, W - PAD, y);
  ctx.textAlign = "left";

  if (noteLines.length) {
    y += 30;
    ctx.fillStyle = "#555555";
    ctx.font = "bold 13px Arial, Helvetica, sans-serif";
    ctx.fillText("CATATAN", PAD, y);
    y += 20;
    ctx.fillStyle = "#000000";
    ctx.font = "15px Arial, Helvetica, sans-serif";
    noteLines.forEach((ln) => { ctx.fillText(ln, PAD, y); y += 22; });
  }

  const blob = await new Promise((res) => canvas.toBlob(res, "image/png"));
  if (!blob) return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `PO-${(supplierName || "supplier").replace(/[^a-zA-Z0-9]+/g, "-")}-${Date.now()}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

const escapeRe = (s) => String(s || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Bungkus teks jadi beberapa baris berdasarkan perkiraan lebar karakter. */
function wrapText(text, maxChars) {
  const words = String(text || "").replace(/\r\n?/g, "\n").split(/\s+/);
  const out = [];
  let line = "";
  words.forEach((w) => {
    const test = line ? `${line} ${w}` : w;
    if (test.length > maxChars) { if (line) out.push(line); line = w; }
    else line = test;
  });
  if (line) out.push(line);
  return out;
}

/**
 * Cetak ringkasan PO. Ukuran kertas bisa dipilih A5 atau A4 lewat dialog
 * cetak browser (CSS @page menyediakan dua opsi).
 */
function printSummary({ supplierName, note, lines, totalCost, catName }) {
  const groups = groupLines(lines, catName);
  const totalQty = lines.reduce((s, l) => s + l.qty, 0);
  const body = groups
    .map((g) => `
      <tr class="cat"><td colspan="4">${esc(g.category)} <span class="cq">${g.qty} pcs</span></td></tr>
      ${g.rows.map((r) => `<tr>
        <td>${esc(r.color)} &middot; ${esc(r.size)}</td>
        <td class="r">${r.qty}</td>
        <td class="r">${rupiah(r.cost)}</td>
        <td class="r">${rupiah(r.subtotal)}</td>
      </tr>`).join("")}`)
    .join("");
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Purchase Order</title>
<style>
  @page { size: A5 portrait; margin: 10mm; }
  body { font-family: Arial, Helvetica, sans-serif; color: #000; margin: 0; }
  h1 { font-size: 18pt; margin: 0 0 2mm; letter-spacing: 1px; }
  .meta { font-size: 9pt; margin-bottom: 4mm; }
  .meta b { display: inline-block; min-width: 22mm; }
  table { width: 100%; border-collapse: collapse; font-size: 9pt; }
  th { background: #eee; border-top: 1.2pt solid #000; border-bottom: 1.2pt solid #000; padding: 1.5mm; text-align: left; }
  td { padding: 1.5mm; border-bottom: 0.4pt solid #ccc; }
  tr.cat td { background: #f1f5f9; font-weight: bold; border-bottom: 0.6pt solid #94a3b8; padding-top: 2mm; }
  .cq { float: right; font-weight: normal; color: #475569; }
  .r { text-align: right; }
  .tot { margin-top: 4mm; display: flex; justify-content: space-between; font-size: 12pt; font-weight: bold; border-top: 1.2pt solid #000; padding-top: 2mm; }
  .sum { margin-top: 3mm; font-size: 9pt; display: flex; justify-content: space-between; }
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
  <tbody>${body}</tbody></table>
  <div class="sum"><span>Jumlah produk : ${lines.length}</span><span>Total qty : ${totalQty} pcs</span></div>
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

/* ------------------------------------------------------------------ */
/* Pengelompokan & pengurutan untuk gambar dan cetak PO                */
/* ------------------------------------------------------------------ */

// Urutan ukuran baku: S, M, L, XL, 2XL, 3XL, ... lalu ukuran angka.
const SIZE_ORDER = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "2XL", "3XL", "4XL", "5XL", "6XL"];

function sizeRank(size) {
  const s = String(size || "").toUpperCase().replace(/\s+/g, "");
  if (!s) return 900;
  const i = SIZE_ORDER.indexOf(s);
  if (i >= 0) return i;
  // "2XL" dan "XXL" dianggap sama
  if (/^X+L$/.test(s)) return SIZE_ORDER.indexOf(`${s.length - 1}XL`) >= 0 ? SIZE_ORDER.indexOf(`${s.length - 1}XL`) : 800;
  const num = Number(s.replace(/[^0-9]/g, ""));
  if (!Number.isNaN(num) && num > 0) return 100 + num;
  return 850;
}

/**
 * Pecah nama produk menjadi warna + ukuran.
 * Contoh: "STC 24S Premium Black S" -> { color: "Black", size: "S" }
 *         "STC 16S Heavy WHITE 2XL" -> { color: "WHITE", size: "2XL" }
 */
function parseColorSize(name) {
  const raw = String(name || "").trim();
  const tokens = raw.split(/\s+/);
  let size = "";
  // Ukuran biasanya token terakhir (S, M, L, XL, 2XL, XXL, 3XL, ...)
  for (let i = tokens.length - 1; i >= 0; i--) {
    const t = tokens[i].toUpperCase();
    if (SIZE_ORDER.includes(t) || /^\d+XL$/.test(t) || /^X+L$/.test(t)) { size = tokens[i]; tokens.splice(i, 1); break; }
  }
  // Warna = token setelah kata "Premium"/"Heavy"/"Cotton" bila ada, kalau tidak token terakhir.
  let color = "";
  const markerIdx = tokens.findIndex((t) => /^(premium|heavy|cotton|combed|softness)$/i.test(t));
  if (markerIdx >= 0 && tokens[markerIdx + 1]) color = tokens[markerIdx + 1];
  else if (tokens.length) color = tokens[tokens.length - 1];
  return { color: color || "-", size: size || "-" };
}

/**
 * Kelompokkan baris PO per kategori, lalu urutkan per warna (A-Z) dan
 * per ukuran (S -> M -> L -> XL -> 2XL -> ...).
 * Mengembalikan array { category, rows, qty, cost }.
 */
function groupLines(lines, catNameById) {
  const byCat = new Map();
  (lines || []).forEach((l) => {
    const cat = (l.category_id && catNameById[l.category_id]) || "Tanpa Kategori";
    if (!byCat.has(cat)) byCat.set(cat, []);
    const { color, size } = parseColorSize(l.name);
    byCat.get(cat).push({ ...l, color, size });
  });

  return Array.from(byCat.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([category, rows]) => {
      rows.sort((a, b) => {
        const c = String(a.color).localeCompare(String(b.color), "id", { sensitivity: "base" });
        if (c !== 0) return c;
        const s = sizeRank(a.size) - sizeRank(b.size);
        if (s !== 0) return s;
        return String(a.name).localeCompare(String(b.name), "id", { sensitivity: "base" });
      });
      return {
        category,
        rows,
        qty: rows.reduce((s, r) => s + r.qty, 0),
        cost: rows.reduce((s, r) => s + r.subtotal, 0),
      };
    });
}

