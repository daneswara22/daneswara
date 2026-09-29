import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api, { rupiah, formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { NumberInput } from "@/components/NumberInput";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NotaDialog } from "@/components/NotaDialog";
import { OrderDetailDialog } from "@/components/OrderDetailDialog";
import { DraftPreviewDialog, buildDraftText } from "@/components/DraftPreviewDialog";
import { SupplierPickerDialog } from "@/components/SupplierPickerDialog";
import { printReceiptSmart } from "@/lib/printer";
import { toast } from "sonner";
import { CheckCircle2, Clock, Trash2, Printer, Search, FileText, Copy, HandCoins, Wallet, Pencil, Plus, Minus, PackagePlus, PackageCheck, Store, Eye, XCircle, ShoppingBag } from "lucide-react";

const METHODS = ["Tunai", "Bank Transfer", "QRIS", "E-Wallet"];
const BANKS = ["BCA TOKO", "BRI TOKO", "BCA ADMIN (ELIS)"];
const ORDER_TYPES = ["Reguler", "Express", "Custom", "Lainnya"];
const isBank = (m) => BANKS.includes(m);

// Filter kanal penjualan. 'manual' mencakup pesanan POS/toko lama (tanpa kanal).
const CHANNEL_FILTERS = [
  { value: "all", label: "Semua Kanal" },
  { value: "shopee", label: "Shopee" },
  { value: "website", label: "Website" },
  { value: "manual", label: "Manual / Toko" },
];

// Halaman "Pesanan Kanal" hanya menampilkan pesanan marketplace (Shopee) dan Custom Tees.
const CHANNEL_VIEW_FILTERS = [
  { value: "all", label: "Semua Kanal" },
  { value: "shopee", label: "Shopee" },
  { value: "custom-tees", label: "Custom Tees" },
];

const CHANNEL_BADGE = {
  shopee: { label: "SHOPEE", cls: "bg-orange-500 text-white" },
  website: { label: "WEBSITE", cls: "bg-blue-600 text-white" },
  tokopedia: { label: "TOKOPEDIA", cls: "bg-emerald-600 text-white" },
  tiktok: { label: "TIKTOK", cls: "bg-neutral-900 text-white" },
};

const PAYMENT_FILTERS = [
  { value: "all", label: "Semua Pembayaran" },
  { value: "PAID", label: "Sudah Dibayar" },
  { value: "UNPAID", label: "Belum Dibayar" },
  { value: "PARTIAL", label: "DP / Sebagian" },
  { value: "REFUNDED", label: "Refund" },
];

const GROUPS = [
  { key: "Draft", label: "Draft / Belum Bayar", tint: "bg-amber-500/15 text-amber-600", icon: FileText },
  { key: "Proses", label: "DP / Proses", tint: "bg-orange-500/15 text-orange-600", icon: Clock },
  { key: "Selesai", label: "Selesai", tint: "bg-emerald-500/15 text-emerald-600", icon: CheckCircle2 },
  { key: "Dibatalkan", label: "Batal / Retur", tint: "bg-red-500/15 text-red-600", icon: XCircle },
];

/** Pesanan marketplace tidak boleh diedit/dihapus dari sini (ikut data sumber). */
const isMarketplace = (o) => {
  const ch = o?.sales_channel || "manual";
  return ch !== "manual" && ch !== "website";
};

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

export default function Orders({ channelView = false }) {
  const [list, setList] = useState([]);
  const [settings, setSettings] = useState({});
  const [settle, setSettle] = useState(null);
  const [method, setMethod] = useState("Tunai");
  const [paid, setPaid] = useState("");
  const [dp, setDp] = useState(null); // order being given a deposit
  const [dpMethod, setDpMethod] = useState("Tunai");
  const [dpAmt, setDpAmt] = useState("");
  const [q, setQ] = useState("");
  const [tab, setTab] = useState("Draft");
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
  const [channel, setChannel] = useState("all");
  const [payment, setPayment] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [detailId, setDetailId] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [teeOrders, setTeeOrders] = useState([]);
  const navigate = useNavigate();

  const load = () => {
    const p = new URLSearchParams();
    // Di halaman kanal, pesanan POS/toko & website tidak ditampilkan.
    if (channelView) p.set("sales_channel", "shopee");
    else if (channel !== "all") p.set("sales_channel", channel);
    if (payment !== "all") p.set("payment_status", payment);
    if (dateFrom) p.set("date_from", dateFrom);
    if (dateTo) p.set("date_to", dateTo);
    const qs = p.toString();
    api.get(`/orders${qs ? `?${qs}` : ""}`).then((r) => setList(channelView && channel === "custom-tees" ? [] : r.data));
  };
  useEffect(() => {
    load();
  }, [channel, payment, dateFrom, dateTo]); // eslint-disable-line
  useEffect(() => {
    if (!channelView) return;
    api.get("/custom-tees/orders").then((r) => setTeeOrders(r.data || [])).catch(() => setTeeOrders([]));
  }, [channelView]);
  useEffect(() => {
    api.get("/settings").then((r) => setSettings(r.data || {}));
    api.get("/customers").then((r) => setCustomers(r.data || [])).catch(() => {});
  }, []);

  const syncShopee = async () => {
    setSyncing(true);
    try {
      const { data } = await api.post("/channels/shopee/sync", { days: 7 });
      if (data.status === "failed") toast.error(`Sinkron Shopee gagal: ${data.message}`);
      else toast.success(`Sinkron Shopee ${data.status} — baru ${data.orders_created}, diperbarui ${data.orders_updated}`);
      load();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    } finally {
      setSyncing(false);
    }
  };

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
  const setItemQty = (idx, delta) => setEditItems((arr) => (arr || []).map((it, i) => i === idx ? { ...it, qty: Math.max(1, (Number(it.qty) || 1) + delta) } : it));
  const setItemQtyAbs = (idx, v) => setEditItems((arr) => (arr || []).map((it, i) => i === idx ? { ...it, qty: Math.max(1, parseInt(v || "1", 10) || 1) } : it));
  const setItemPrice = (idx, v) => setEditItems((arr) => (arr || []).map((it, i) => i === idx ? { ...it, price: Number(v) || 0 } : it));
  const setItemNote = (idx, v) => setEditItems((arr) => (arr || []).map((it, i) => i === idx ? { ...it, note: v } : it));
  const removeItem = (idx) => setEditItems((arr) => (arr || []).filter((_, i) => i !== idx));
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

  const editInPos = (o) => {
    try {
      localStorage.setItem("pos_resume_draft", JSON.stringify({
        id: o.id,
        order_number: o.order_number,
        items: o.items || [],
        discount: o.discount || 0,
        tax_rate: o.tax_rate || 0,
        customer_id: o.customer_id || "",
        customer_name: o.customer_name || "",
        order_type: o.order_type || "Reguler",
        channel: o.channel || "Toko",
      }));
    } catch { /* ignore storage errors */ }
    navigate("/pos");
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
    ? list.filter((o) => {
        const skus = (o.items || []).map((i) => `${i.sku || ""} ${i.name || ""}`).join(" ");
        return `${o.order_number} ${o.external_order_id || ""} ${o.customer_name || ""} ${o.customer_phone || ""} ${o.status} ${o.order_type || ""} ${o.sales_channel || ""} ${o.tracking_number || ""} ${skus}`
          .toLowerCase()
          .includes(term);
      })
    : list;

  // Saat mencari, pindah otomatis ke tab pertama yang punya hasil.
  useEffect(() => {
    if (!term) return;
    if (filtered.some((o) => o.status === tab)) return;
    const g = GROUPS.find((x) => filtered.some((o) => o.status === x.key));
    if (g) setTab(g.key);
  }, [term, list]); // eslint-disable-line

  const ChannelBadge = ({ order }) => {
    const b = CHANNEL_BADGE[order.sales_channel];
    if (!b) return null;
    return (
      <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${b.cls}`} data-testid={`channel-badge-${order.id}`}>
        {b.label}
      </span>
    );
  };

  const renderCard = (o) => (
    <div key={o.id} className="rounded-lg border border-border bg-card p-4" data-testid={`order-${o.id}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <ChannelBadge order={o} />
            <p className="truncate font-semibold">{o.order_number}</p>
            {o.order_type && <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground" data-testid={`order-type-${o.id}`}>{o.order_type}</span>}
          </div>
          <p className="text-xs text-muted-foreground">{o.customer_name || "Tanpa nama"} · {new Date(o.order_date || o.created_at).toLocaleString("id-ID")}</p>
          {(o.items || []).length > 0 && (
            <p className="mt-0.5 truncate text-xs text-muted-foreground" data-testid={`order-items-${o.id}`}>
              {(o.items || [])
                .slice(0, 2)
                .map((i) => `${i.name}${i.variation_name ? ` (${i.variation_name})` : ""} ×${i.qty}`)
                .join(", ")}
              {(o.items || []).length > 2 ? ` +${(o.items || []).length - 2} lainnya` : ""}
            </p>
          )}
          {o.internal_status && (
            <span className="mt-1 mr-1 inline-block rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground" data-testid={`internal-status-${o.id}`}>
              {o.internal_status}
            </span>
          )}
          {o.tracking_number && (
            <span className="mt-1 inline-block rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold text-blue-600">
              Resi {o.tracking_number}
            </span>
          )}
          {(o.items || []).some((i) => i.mapping_status === "UNMAPPED") && (
            <span className="mt-1 ml-1 inline-block rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-600" data-testid={`unmapped-badge-${o.id}`}>
              Produk belum dipetakan
            </span>
          )}
          {o.po_created && (
            <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-blue-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-600" data-testid={`po-badge-${o.id}`} title={`PO: ${(o.po_numbers || []).join(", ")}`}>
              <PackageCheck className="h-3 w-3" /> Sudah PO{o.po_numbers && o.po_numbers.length > 1 ? ` (${o.po_numbers.length})` : ""}
            </span>
          )}
        </div>
        <span className={`flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${o.status === "Selesai" ? "bg-emerald-500/15 text-emerald-600" : o.status === "Draft" ? "bg-amber-500/15 text-amber-600" : o.status === "Dibatalkan" ? "bg-red-500/15 text-red-600" : "bg-orange-500/15 text-orange-600"}`}>
          {o.status === "Selesai" ? <CheckCircle2 className="h-3 w-3" /> : o.status === "Draft" ? <FileText className="h-3 w-3" /> : o.status === "Dibatalkan" ? <XCircle className="h-3 w-3" /> : <Clock className="h-3 w-3" />} {o.status === "Draft" ? (isMarketplace(o) ? "Belum Dibayar" : "Belum Bayar") : o.status}
        </span>
      </div>
      <div className="mt-3 space-y-1 text-sm">
        <div className="flex justify-between text-muted-foreground"><span>Total</span><span>{rupiah(o.total)}</span></div>
        {isMarketplace(o) ? (
          <>
            {o.shipping_fee > 0 && <div className="flex justify-between text-muted-foreground"><span>Ongkir</span><span>{rupiah(o.shipping_fee)}</span></div>}
            <div className="flex justify-between text-muted-foreground"><span>Pembayaran</span><span className="font-semibold">{o.payment_status || "-"}</span></div>
          </>
        ) : (
          <>
            {o.status !== "Draft" && <div className="flex justify-between text-muted-foreground"><span>Deposit (DP)</span><span>{rupiah(o.deposit_amount)}</span></div>}
            {o.status !== "Draft" && <div className="flex justify-between font-semibold"><span>Sisa</span><span className={o.remaining > 0 ? "text-orange-600" : ""}>{rupiah(o.remaining)}</span></div>}
          </>
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="outline" size="sm" className="gap-1" onClick={() => setDetailId(o.id)} data-testid={`detail-order-${o.id}`}>
          <Eye className="h-4 w-4" /> Detail
        </Button>
        {isMarketplace(o) ? (
          <span className="self-center text-xs text-muted-foreground">
            Pembayaran & status diatur dari {o.sales_channel === "shopee" ? "Shopee Seller" : "marketplace"}.
          </span>
        ) : (
          <>
            {o.status === "Draft" && (
              <>
                <Button variant="outline" size="sm" className="gap-1" onClick={() => setPreview(o)} data-testid={`preview-order-${o.id}`}><FileText className="h-4 w-4" /> Preview</Button>
                <Button variant="outline" size="sm" className="gap-1" onClick={() => openEdit(o)} data-testid={`edit-order-${o.id}`}><Pencil className="h-4 w-4" /> Edit</Button>
                <Button variant="outline" size="sm" className="gap-1" onClick={() => editInPos(o)} data-testid={`edit-pos-order-${o.id}`}><Store className="h-4 w-4" /> Edit di POS</Button>
                <Button variant="secondary" size="sm" className="gap-1" onClick={() => copyDraft(o)} data-testid={`copy-order-${o.id}`}><Copy className="h-4 w-4" /> Salin</Button>
                <Button size="sm" variant="outline" className="gap-1" onClick={() => { setDp(o); setDpMethod("Tunai"); setDpAmt(""); }} data-testid={`dp-order-${o.id}`}><HandCoins className="h-4 w-4" /> Jadi DP</Button>
                <Button size="sm" className="gap-1" onClick={() => { setSettle(o); setMethod("Tunai"); setPaid(o.total); }} data-testid={`pay-order-${o.id}`}><Wallet className="h-4 w-4" /> Lunasi</Button>
                <Button variant="outline" size="sm" className="gap-1" onClick={() => printDraft(o)} data-testid={`print-draft-${o.id}`}><Printer className="h-4 w-4" /> Cetak</Button>
              </>
            )}
            {o.status === "Proses" && (
              <Button className="flex-1" onClick={() => { setSettle(o); setMethod("Tunai"); setPaid(o.remaining); }} data-testid={`complete-order-${o.id}`}>Selesaikan & Lunasi</Button>
            )}
            {o.status !== "Draft" && o.status !== "Dibatalkan" && (
              <Button variant="outline" size="sm" className="gap-1" onClick={() => setNota(o)} data-testid={`reprint-order-${o.id}`}><Printer className="h-4 w-4" /> Nota</Button>
            )}
            <Button variant="ghost" size="icon" onClick={() => del(o.id)} data-testid={`delete-order-${o.id}`}><Trash2 className="h-4 w-4 text-destructive" /></Button>
          </>
        )}
        <Button variant="outline" size="sm" className={`gap-1 ${o.po_created ? "border-blue-500/40 text-blue-600" : ""}`} onClick={() => makePO(o)} data-testid={`po-order-${o.id}`}>
          {o.po_created ? <PackageCheck className="h-4 w-4" /> : <PackagePlus className="h-4 w-4" />} {o.po_created ? "Sudah PO" : "PO"}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{channelView ? "Sales Channel" : "Pesanan"}</p>
        <h1 className="font-display text-3xl font-bold tracking-tight">{channelView ? "Pesanan Kanal" : "Pesanan & Draft"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{channelView ? "Filter pesanan per kanal penjualan (Shopee, website, manual/toko) dan sinkronkan pesanan marketplace." : "Daftar pesanan dan draft dari tombol \"Tahan\" di POS."}</p>
      </div>

      {channelView && (
      <div className="space-y-3 rounded-lg border border-border bg-card p-3" data-testid="order-filters">
        <div className="flex flex-wrap items-center gap-2">
          {(channelView ? CHANNEL_VIEW_FILTERS : CHANNEL_FILTERS).map((c) => (
            <button
              key={c.value}
              onClick={() => setChannel(c.value)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors duration-200 ${
                channel === c.value ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:text-foreground"
              }`}
              data-testid={`channel-filter-${c.value}`}
            >
              {c.label}
            </button>
          ))}
          <Button variant="outline" size="sm" className="ml-auto gap-1" onClick={syncShopee} disabled={syncing} data-testid="orders-sync-shopee">
            <ShoppingBag className="h-4 w-4" /> {syncing ? "Menyinkron..." : "Sinkron Shopee"}
          </Button>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari no. pesanan, ID Shopee, nama, SKU, resi..." className="pl-10" data-testid="order-search" />
          </div>
          <Select value={payment} onValueChange={setPayment}>
            <SelectTrigger data-testid="payment-filter"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PAYMENT_FILTERS.map((p) => (
                <SelectItem key={p.value} value={p.value} data-testid={`payment-filter-${p.value}`}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Dari tanggal</Label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} data-testid="date-from-filter" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Sampai tanggal</Label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} data-testid="date-to-filter" />
          </div>
        </div>
      </div>
      )}

      {!channelView && (
        <div className="relative max-w-md" data-testid="orders-search-wrap">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari no. pesanan, nama pelanggan, SKU, produk..."
            className="pl-10"
            data-testid="order-search"
          />
        </div>
      )}

      {channelView && (channel === "all" || channel === "custom-tees") && (
        <div className="space-y-2 rounded-lg border border-border bg-card p-3" data-testid="channel-custom-tees">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-semibold">Pesanan Custom Tees</h2>
            <Button variant="outline" size="sm" onClick={() => navigate("/custom-tees")} data-testid="channel-open-custom-tees">
              Buka Custom Tees
            </Button>
          </div>
          {teeOrders.filter((t) => !term || `${t.order_code} ${t.customer_name} ${t.customer_phone} ${t.product_title} ${t.status}`.toLowerCase().includes(term)).length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada pesanan Custom Tees.</p>
          ) : (
            <div className="divide-y divide-border">
              {teeOrders
                .filter((t) => !term || `${t.order_code} ${t.customer_name} ${t.customer_phone} ${t.product_title} ${t.status}`.toLowerCase().includes(term))
                .map((t) => (
                  <div key={t.id} className="flex flex-wrap items-center gap-2 py-2 text-sm" data-testid={`tee-order-${t.id}`}>
                    <span className="rounded-full bg-purple-600 px-2 py-0.5 text-[10px] font-bold text-white">CUSTOM TEES</span>
                    <span className="font-semibold">{t.order_code}</span>
                    <span className="text-muted-foreground">{t.customer_name || "-"}</span>
                    <span className="text-muted-foreground">{t.product_title || t.product_key}</span>
                    <span className="ml-auto text-xs font-semibold uppercase text-muted-foreground">{t.status}</span>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {list.length === 0 && <p className="text-sm text-muted-foreground">{channelView ? "Belum ada pesanan Shopee." : "Belum ada pesanan."}</p>}
      {list.length > 0 && filtered.length === 0 && <p className="text-sm text-muted-foreground">Tidak ada pesanan cocok.</p>}

      {list.length > 0 && filtered.length > 0 && (
        <>
          <div className="flex flex-wrap gap-1 border-b border-border" data-testid="order-tabs">
            {GROUPS.map((g) => {
              const count = (filtered || []).filter((o) => o.status === g.key).length;
              const active = tab === g.key;
              return (
                <button
                  key={g.key}
                  onClick={() => setTab(g.key)}
                  className={`-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors duration-200 ${active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                  data-testid={`order-tab-${g.key}`}
                >
                  <g.icon className="h-4 w-4" /> {g.label}
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${active ? g.tint : "bg-secondary text-muted-foreground"}`}>{count}</span>
                </button>
              );
            })}
          </div>

          {(() => {
            const rows = (filtered || []).filter((o) => o.status === tab);
            if (rows.length === 0) {
              return <p className="text-sm text-muted-foreground" data-testid="order-tab-empty">{term ? "Tidak ada pesanan cocok di tab ini." : "Belum ada pesanan di tab ini."}</p>;
            }
            return (
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2" data-testid={`order-group-${tab}`}>
                {(rows || []).map(renderCard)}
              </div>
            );
          })()}
        </>
      )}

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
                        {(matches || []).map((c) => (
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
                <Select data-testid="orders-select-1" value={editType} onValueChange={setEditType}>
                  <SelectTrigger data-testid="edit-type-select"><SelectValue /></SelectTrigger>
                  <SelectContent>{ORDER_TYPES.map((t) => <SelectItem data-testid="orders-select-item-1" key={t} value={t}>{t}</SelectItem>)}</SelectContent>
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
      <OrderDetailDialog orderId={detailId} onClose={() => setDetailId(null)} />
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
