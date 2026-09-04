import { useEffect, useState } from "react";
import api, { rupiah, formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { NumberInput } from "@/components/NumberInput";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NotaDialog } from "@/components/NotaDialog";
import { DraftPreviewDialog, buildDraftText } from "@/components/DraftPreviewDialog";
import { SupplierPickerDialog } from "@/components/SupplierPickerDialog";
import { printReceiptSmart } from "@/lib/printer";
import { toast } from "sonner";
import { CheckCircle2, Clock, Trash2, Printer, Search, FileText, Copy, HandCoins, Wallet, Pencil, Plus, Minus, PackagePlus, PackageCheck } from "lucide-react";

const METHODS = ["Tunai", "Bank Transfer", "QRIS", "E-Wallet"];
const BANKS = ["BCA TOKO", "BRI TOKO", "BCA ADMIN (ELIS)"];
const ORDER_TYPES = ["Reguler", "Express", "Custom", "Lainnya"];
const isBank = (m) => BANKS.includes(m);

const GROUPS = [
  { key: "Draft", label: "Draft / Belum Bayar", tint: "bg-amber-500/15 text-amber-600", icon: FileText },
  { key: "Proses", label: "DP / Proses", tint: "bg-orange-500/15 text-orange-600", icon: Clock },
  { key: "Selesai", label: "Selesai", tint: "bg-emerald-500/15 text-emerald-600", icon: CheckCircle2 },
];

function MethodPicker({ method, setMethod, prefix }) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        {METHODS.map((m) => {
          const active = m === "Bank Transfer" ? isBank(method) : method === m;
          return (
            <button key={m} onClick={() => setMethod(m === "Bank Transfer" ? BANKS[0] : m)} className={`rounded-md border py-3 text-sm font-semibold transition-colors duration-200 ${active ? "border-primary bg-accent text-accent-foreground" : "border-border"}`} data-testid={`${prefix}-method-${m}`}>{m}</button>
          );
        })}
      </div>
      {isBank(method) && (
        <div className="grid grid-cols-3 gap-2" data-testid={`${prefix}-bank-options`}>
          {BANKS.map((b) => (
            <button key={b} onClick={() => setMethod(b)} className={`rounded-md border px-2 py-2 text-xs font-semibold transition-colors duration-200 ${method === b ? "border-primary bg-accent text-accent-foreground" : "border-border"}`} data-testid={`${prefix}-bank-${b}`}>{b}</button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Orders() {
  const [list, setList] = useState([]);
  const [settings, setSettings] = useState({});
  const [settle, setSettle] = useState(null);
  const [method, setMethod] = useState("Tunai");
  const [paid, setPaid] = useState("");
  const [dp, setDp] = useState(null); // order being given a deposit
  const [dpMethod, setDpMethod] = useState("Tunai");
  const [dpAmt, setDpAmt] = useState("");
  const [q, setQ] = useState("");
  const [nota, setNota] = useState(null);
  const [preview, setPreview] = useState(null);
  const [poOrder, setPoOrder] = useState(null); // order pending PO (supplier picker)
  const [edit, setEdit] = useState(null); // draft being edited
  const [editItems, setEditItems] = useState([]);
  const [editDiscount, setEditDiscount] = useState("");
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState("Reguler");
  const [customers, setCustomers] = useState([]);
  const [nameSuggestOpen, setNameSuggestOpen] = useState(false);

  const load = () => { api.get("/orders").then((r) => setList(r.data)); };
  useEffect(() => {
    load();
    api.get("/settings").then((r) => setSettings(r.data || {}));
    api.get("/customers").then((r) => setCustomers(r.data || [])).catch(() => {});
  }, []);

  const complete = async () => {
    if (Number(paid) < settle.remaining) return toast.error("Nominal pelunasan kurang");
    try {
      const { data } = await api.post(`/orders/${settle.id}/complete`, { payment_method: method, paid_amount: Number(paid) });
      toast.success("Pesanan selesai & struk dibuat");
      setSettle(null); setPaid(""); load();
      setNota(data);
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
  };

  const submitDp = async () => {
    const amt = Number(dpAmt) || 0;
    if (amt <= 0) return toast.error("Masukkan nominal DP");
    if (amt > dp.total) return toast.error("Nominal DP melebihi total");
    try {
      await api.post(`/orders/${dp.id}/deposit`, { deposit_amount: amt, deposit_method: dpMethod });
      toast.success("DP tersimpan — pesanan masuk Proses");
      setDp(null); setDpAmt(""); load();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
  };

  const del = async (id) => { if (!window.confirm("Hapus pesanan?")) return; await api.delete(`/orders/${id}`); load(); };

  const makePO = async (o) => {
    if (o.po_created) {
      const ok = window.confirm(`Pesanan ${o.order_number} SUDAH pernah dibuatkan PO (${(o.po_numbers || []).join(", ")}).\n\nYakin ingin membuat PO lagi? Ini bisa menyebabkan pembelian dobel.`);
      if (!ok) return;
    }
    setPoOrder(o);
  };
  const confirmPO = async (supplierId) => {
    try {
      const { data } = await api.post(`/purchases/from-order/${poOrder.id}`, { supplier_id: supplierId });
      toast.success(`PO ${data.po_number} dibuat — cek di menu Pembelian`);
      setPoOrder(null);
      load();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
  };
  const printDraft = async (o) => {
    try {
      const mode = await printReceiptSmart({ ...o, __draft: true }, settings);
      if (mode === "bluetooth") toast.success("Penawaran dikirim ke printer Bluetooth");
    } catch (e) { toast.error(e.message || "Gagal mencetak penawaran"); }
  };

  const openEdit = (o) => {
    setEdit(o);
    setEditItems((o.items || []).map((i) => ({ ...i })));
    setEditDiscount(o.discount || 0);
    setEditName(o.customer_name || "");
    setEditType(o.order_type || "Reguler");
  };
  const setItemQty = (idx, delta) => setEditItems((arr) => arr.map((it, i) => i === idx ? { ...it, qty: Math.max(1, (Number(it.qty) || 1) + delta) } : it));
  const setItemQtyAbs = (idx, v) => setEditItems((arr) => arr.map((it, i) => i === idx ? { ...it, qty: Math.max(1, parseInt(v || "1", 10) || 1) } : it));
  const setItemPrice = (idx, v) => setEditItems((arr) => arr.map((it, i) => i === idx ? { ...it, price: Number(v) || 0 } : it));
  const setItemNote = (idx, v) => setEditItems((arr) => arr.map((it, i) => i === idx ? { ...it, note: v } : it));
  const removeItem = (idx) => setEditItems((arr) => arr.filter((_, i) => i !== idx));
  const editSubtotal = editItems.reduce((s, i) => s + (Number(i.price) || 0) * (Number(i.qty) || 0), 0);
  const editTaxRate = edit?.tax_rate || 0;
  const editTax = (editSubtotal - (Number(editDiscount) || 0)) * (editTaxRate / 100);
  const editTotal = editSubtotal - (Number(editDiscount) || 0) + editTax;
  const submitEdit = async () => {
    if (editItems.length === 0) return toast.error("Minimal 1 item");
    try {
      await api.put(`/orders/${edit.id}`, {
        items: editItems.map((i) => ({ product_id: i.product_id, name: i.name, price: Number(i.price) || 0, qty: Number(i.qty) || 1, cost: i.cost || 0, note: i.note || "" })),
        discount: Number(editDiscount) || 0, tax_rate: editTaxRate,
        customer_name: editName, order_type: editType,
      });
      toast.success("Draft pesanan diperbarui");
      setEdit(null); load();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
  };

  const copyDraft = async (o) => {
    const text = buildDraftText(o, settings);
    try { await navigator.clipboard.writeText(text); }
    catch {
      const ta = document.createElement("textarea"); ta.value = text;
      document.body.appendChild(ta); ta.select(); document.execCommand("copy"); document.body.removeChild(ta);
    }
    toast.success("Draft pesanan disalin — tinggal tempel di WhatsApp");
  };

  const term = q.trim().toLowerCase();
  const filtered = term
    ? list.filter((o) => `${o.order_number} ${o.customer_name || ""} ${o.status} ${o.order_type || ""}`.toLowerCase().includes(term))
    : list;

  const renderCard = (o) => (
    <div key={o.id} className="rounded-lg border border-border bg-card p-4" data-testid={`order-${o.id}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate font-semibold">{o.order_number}</p>
            {o.order_type && <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground" data-testid={`order-type-${o.id}`}>{o.order_type}</span>}
          </div>
          <p className="text-xs text-muted-foreground">{o.customer_name || "Tanpa nama"} · {new Date(o.created_at).toLocaleString("id-ID")}</p>
          {o.po_created && (
            <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-blue-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-600" data-testid={`po-badge-${o.id}`} title={`PO: ${(o.po_numbers || []).join(", ")}`}>
              <PackageCheck className="h-3 w-3" /> Sudah PO{o.po_numbers && o.po_numbers.length > 1 ? ` (${o.po_numbers.length})` : ""}
            </span>
          )}
        </div>
        <span className={`flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${o.status === "Selesai" ? "bg-emerald-500/15 text-emerald-600" : o.status === "Draft" ? "bg-amber-500/15 text-amber-600" : "bg-orange-500/15 text-orange-600"}`}>
          {o.status === "Selesai" ? <CheckCircle2 className="h-3 w-3" /> : o.status === "Draft" ? <FileText className="h-3 w-3" /> : <Clock className="h-3 w-3" />} {o.status === "Draft" ? "Belum Bayar" : o.status}
        </span>
      </div>
      <div className="mt-3 space-y-1 text-sm">
        <div className="flex justify-between text-muted-foreground"><span>Total</span><span>{rupiah(o.total)}</span></div>
        {o.status !== "Draft" && <div className="flex justify-between text-muted-foreground"><span>Deposit (DP)</span><span>{rupiah(o.deposit_amount)}</span></div>}
        {o.status !== "Draft" && <div className="flex justify-between font-semibold"><span>Sisa</span><span className={o.remaining > 0 ? "text-orange-600" : ""}>{rupiah(o.remaining)}</span></div>}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {o.status === "Draft" && (
          <>
            <Button variant="outline" size="sm" className="gap-1" onClick={() => setPreview(o)} data-testid={`preview-order-${o.id}`}><FileText className="h-4 w-4" /> Preview</Button>
            <Button variant="outline" size="sm" className="gap-1" onClick={() => openEdit(o)} data-testid={`edit-order-${o.id}`}><Pencil className="h-4 w-4" /> Edit</Button>
            <Button variant="secondary" size="sm" className="gap-1" onClick={() => copyDraft(o)} data-testid={`copy-order-${o.id}`}><Copy className="h-4 w-4" /> Salin</Button>
            <Button size="sm" variant="outline" className="gap-1" onClick={() => { setDp(o); setDpMethod("Tunai"); setDpAmt(""); }} data-testid={`dp-order-${o.id}`}><HandCoins className="h-4 w-4" /> Jadi DP</Button>
            <Button size="sm" className="gap-1" onClick={() => { setSettle(o); setMethod("Tunai"); setPaid(o.total); }} data-testid={`pay-order-${o.id}`}><Wallet className="h-4 w-4" /> Lunasi</Button>
            <Button variant="outline" size="sm" className="gap-1" onClick={() => printDraft(o)} data-testid={`print-draft-${o.id}`}><Printer className="h-4 w-4" /> Cetak</Button>
          </>
        )}
        {o.status === "Proses" && (
          <Button className="flex-1" onClick={() => { setSettle(o); setMethod("Tunai"); setPaid(o.remaining); }} data-testid={`complete-order-${o.id}`}>Selesaikan & Lunasi</Button>
        )}
        {o.status !== "Draft" && (
          <Button variant="outline" size="sm" className="gap-1" onClick={() => setNota(o)} data-testid={`reprint-order-${o.id}`}><Printer className="h-4 w-4" /> Nota</Button>
        )}
        <Button variant="outline" size="sm" className={`gap-1 ${o.po_created ? "border-blue-500/40 text-blue-600" : ""}`} onClick={() => makePO(o)} data-testid={`po-order-${o.id}`}>
          {o.po_created ? <PackageCheck className="h-4 w-4" /> : <PackagePlus className="h-4 w-4" />} {o.po_created ? "Sudah PO" : "PO"}
        </Button>
        <Button variant="ghost" size="icon" onClick={() => del(o.id)} data-testid={`delete-order-${o.id}`}><Trash2 className="h-4 w-4 text-destructive" /></Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Pesanan</p>
        <h1 className="font-display text-3xl font-bold tracking-tight">Pesanan & Draft</h1>
        <p className="mt-1 text-sm text-muted-foreground">Draft (belum bayar) dari tombol "Tahan" di POS muncul di sini. Preview & kirim penawaran ke pelanggan, lalu proses jadi DP atau langsung lunasi.</p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari no. pesanan, nama, jenis, atau status..." className="pl-10" data-testid="order-search" />
      </div>

      {list.length === 0 && <p className="text-sm text-muted-foreground">Belum ada pesanan.</p>}
      {list.length > 0 && filtered.length === 0 && <p className="text-sm text-muted-foreground">Tidak ada pesanan cocok.</p>}

      {GROUPS.map((g) => {
        const rows = filtered.filter((o) => o.status === g.key);
        if (rows.length === 0) return null;
        return (
          <div key={g.key} className="space-y-3" data-testid={`order-group-${g.key}`}>
            <div className="flex items-center gap-2">
              <span className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${g.tint}`}><g.icon className="h-4 w-4" /> {g.label}</span>
              <span className="text-xs text-muted-foreground">{rows.length} pesanan</span>
            </div>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {rows.map(renderCard)}
            </div>
          </div>
        );
      })}

      {/* Edit draft dialog */}
      <Dialog open={!!edit} onOpenChange={() => setEdit(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto" data-testid="edit-dialog">
          <DialogHeader><DialogTitle className="font-display">Edit Draft — {edit?.order_number}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Nama Pesanan / Pelanggan</Label>
                <div className="relative">
                  <Input
                    value={editName}
                    onChange={(e) => { setEditName(e.target.value); setNameSuggestOpen(true); }}
                    onFocus={() => setNameSuggestOpen(true)}
                    onBlur={() => setTimeout(() => setNameSuggestOpen(false), 150)}
                    placeholder="Ketik untuk cari pelanggan..."
                    autoComplete="off"
                    data-testid="edit-name-input"
                  />
                  {nameSuggestOpen && (() => {
                    const q = editName.trim().toLowerCase();
                    const matches = customers
                      .filter((c) => !q || `${c.name} ${c.phone || ""}`.toLowerCase().includes(q))
                      .slice(0, 6);
                    if (matches.length === 0) return null;
                    return (
                      <div className="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-border bg-popover shadow-lg" data-testid="edit-name-suggestions">
                        {matches.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onMouseDown={(e) => { e.preventDefault(); setEditName(c.name); setNameSuggestOpen(false); }}
                            className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
                            data-testid={`edit-name-option-${c.id}`}
                          >
                            <span className="truncate font-medium">{c.name}</span>
                            {c.phone ? <span className="shrink-0 text-xs text-muted-foreground">{c.phone}</span> : null}
                          </button>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              </div>
              <div className="space-y-1">
                <Label>Jenis Pesanan</Label>
                <Select value={editType} onValueChange={setEditType}>
                  <SelectTrigger data-testid="edit-type-select"><SelectValue /></SelectTrigger>
                  <SelectContent>{ORDER_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Item Pesanan</Label>
              {editItems.length === 0 && <p className="text-sm text-muted-foreground">Semua item dihapus — tambahkan minimal 1 item.</p>}
              {editItems.map((it, idx) => (
                <div key={idx} className="rounded-md border border-border p-3" data-testid={`edit-item-${idx}`}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium">{it.name}</p>
                    <button onClick={() => removeItem(idx)} className="shrink-0 text-destructive" data-testid={`edit-item-remove-${idx}`}><Trash2 className="h-4 w-4" /></button>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-xs text-muted-foreground">Jumlah</span>
                      <div className="mt-1 flex items-center gap-2">
                        <button onClick={() => setItemQty(idx, -1)} className="flex h-7 w-7 items-center justify-center rounded-md bg-secondary" data-testid={`edit-item-minus-${idx}`}><Minus className="h-3.5 w-3.5" /></button>
                        <input type="number" min="1" value={it.qty} onChange={(e) => setItemQtyAbs(idx, e.target.value)} onFocus={(e) => e.target.select()} className="h-7 w-14 rounded-md border border-border bg-background text-center text-sm font-semibold" data-testid={`edit-item-qty-${idx}`} />
                        <button onClick={() => setItemQty(idx, 1)} className="flex h-7 w-7 items-center justify-center rounded-md bg-secondary" data-testid={`edit-item-plus-${idx}`}><Plus className="h-3.5 w-3.5" /></button>
                      </div>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Harga (Rp)</span>
                      <NumberInput value={it.price} onValueChange={(v) => setItemPrice(idx, v)} className="mt-1 h-7" data-testid={`edit-item-price-${idx}`} />
                    </div>
                  </div>
                  <Input value={it.note || ""} onChange={(e) => setItemNote(idx, e.target.value)} placeholder="Catatan (opsional)" className="mt-2 h-8 text-xs" data-testid={`edit-item-note-${idx}`} />
                  <p className="mt-1 text-right text-xs font-semibold">{rupiah((Number(it.price) || 0) * (Number(it.qty) || 0))}</p>
                </div>
              ))}
            </div>

            <div className="space-y-1">
              <Label>Diskon (Rp)</Label>
              <NumberInput value={editDiscount} onValueChange={setEditDiscount} className="h-10" data-testid="edit-discount-input" />
            </div>
            <div className="rounded-md bg-secondary/50 p-3 text-sm">
              <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>{rupiah(editSubtotal)}</span></div>
              {editTaxRate ? <div className="flex justify-between text-muted-foreground"><span>Pajak ({editTaxRate}%)</span><span>{rupiah(editTax)}</span></div> : null}
              <div className="mt-1 flex justify-between font-bold"><span>Total</span><span data-testid="edit-total">{rupiah(editTotal)}</span></div>
            </div>
          </div>
          <DialogFooter><Button onClick={submitEdit} className="w-full" data-testid="edit-save-button">Simpan Perubahan</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deposit (DP) dialog for drafts */}      <Dialog open={!!dp} onOpenChange={() => setDp(null)}>
        <DialogContent data-testid="dp-dialog">
          <DialogHeader><DialogTitle className="font-display">Proses jadi DP — Total {rupiah(dp?.total || 0)}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <MethodPicker method={dpMethod} setMethod={setDpMethod} prefix="dp" />
            <div className="space-y-1">
              <Label>Nominal Deposit (DP)</Label>
              <NumberInput value={dpAmt} onValueChange={setDpAmt} className="h-12 text-lg" data-testid="dp-amount-input" />
              <p className="text-sm">Sisa tagihan: <span className="font-bold">{rupiah(Math.max(0, (dp?.total || 0) - Number(dpAmt || 0)))}</span></p>
            </div>
          </div>
          <DialogFooter><Button onClick={submitDp} className="w-full" data-testid="dp-confirm-button">Simpan DP</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Settle / Lunasi dialog */}
      <Dialog open={!!settle} onOpenChange={() => setSettle(null)}>
        <DialogContent data-testid="settle-dialog">
          <DialogHeader><DialogTitle className="font-display">Pelunasan — Sisa {rupiah(settle?.remaining ?? settle?.total ?? 0)}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <MethodPicker method={method} setMethod={setMethod} prefix="settle" />
            <div className="space-y-1"><Label>Nominal Pelunasan</Label><NumberInput value={paid} onValueChange={setPaid} className="h-12 text-lg" data-testid="settle-paid-input" /></div>
          </div>
          <DialogFooter><Button onClick={complete} className="w-full" data-testid="settle-confirm-button">Konfirmasi Selesai</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <NotaDialog nota={nota} onClose={() => setNota(null)} settings={settings} />
      <DraftPreviewDialog order={preview} onClose={() => setPreview(null)} settings={settings} />
      <SupplierPickerDialog
        open={!!poOrder}
        onOpenChange={(o) => { if (!o) setPoOrder(null); }}
        onConfirm={confirmPO}
        title="Pilih Supplier untuk PO"
        description={poOrder ? `PO dibuat dari pesanan ${poOrder.order_number}. Supplier wajib dipilih.` : ""}
      />
    </div>
  );
}
