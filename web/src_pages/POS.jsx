import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import api, { rupiah, formatApiError } from "@/lib/api";
import { printReceiptSmart } from "@/lib/printer";
import { NotaDialog, ShareNotaImageButton } from "@/components/NotaDialog";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/NumberInput";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Command, CommandInput, CommandList, CommandEmpty, CommandItem } from "@/components/ui/command";
import { toast } from "sonner";
import { Search, Plus, Minus, Trash2, X, ArrowLeft, ShoppingCart, ScanLine, CheckCircle2, PauseCircle, PlayCircle, HandCoins, Copy, MessageCircle, UserPlus, Check, ChevronsUpDown, Grid2x2, Grid3x3, LayoutGrid, Pencil, History, ChevronDown, ChevronRight, Phone, Loader2 } from "lucide-react";

const METHODS = ["Tunai", "Bank Transfer", "QRIS", "E-Wallet"];
const CHANNELS = ["Toko", "Shopee", "Tokopedia", "WhatsApp", "Lainnya"];
const BANKS = ["BCA TOKO", "BRI TOKO", "BCA ADMIN (ELIS)"];
const ORDER_TYPES = ["Reguler", "Express", "Custom", "Lainnya"];
const isBank = (m) => BANKS.includes(m);

const CUSTOMER_RESULT_LIMIT = 60;
const HISTORY_PREVIEW = 5;
const normalize = (s) => String(s || "").toLowerCase().trim();

// Ranking pencarian pelanggan: awalan nama > awalan kata dalam nama > mengandung teks > cocok nomor telepon.
// Hasil selalu terurut dari yang paling relevan, jadi item teratas adalah tebakan terbaik.
function rankCustomers(customers, query, limit = CUSTOMER_RESULT_LIMIT) {
  const q = normalize(query);
  if (!q) return customers.slice(0, limit);
  const qDigits = q.replace(/\D/g, "");
  const scored = [];
  for (const c of customers) {
    const name = normalize(c.name);
    const phone = String(c.phone || "").replace(/\D/g, "");
    let rank = -1;
    if (name.startsWith(q)) rank = 0;
    else if (name.split(/[\s\-_.,/()]+/).some((w) => w.startsWith(q))) rank = 1;
    else if (name.includes(q)) rank = 2;
    else if (qDigits && phone.includes(qDigits)) rank = 3;
    if (rank >= 0) scored.push({ c, rank, idx: name.indexOf(q) });
  }
  scored.sort((a, b) => a.rank - b.rank || a.idx - b.idx || normalize(a.c.name).localeCompare(normalize(b.c.name)));
  return scored.slice(0, limit).map((s) => s.c);
}

const fmtShortDate = (iso) => {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("id-ID", { day: "2-digit", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch { return ""; }
};
const summarizeItems = (items) => {
  const list = Array.isArray(items) ? items : [];
  const text = list.slice(0, 3).map((i) => `${i.qty}x ${i.name}`).join(", ");
  return list.length > 3 ? `${text}, +${list.length - 3} lainnya` : text;
};
const itemNotes = (items) => (Array.isArray(items) ? items : []).filter((i) => i.note).map((i) => `${i.name}: ${i.note}`);

const POS_GRID = {
  besar: "grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6",
  sedang: "grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-10",
  kecil: "grid-cols-4 gap-1.5 sm:grid-cols-5 md:grid-cols-8 xl:grid-cols-10 2xl:grid-cols-12",
};

// Panel keranjang menyamping saat lebar/landscape; tombol mengambang + drawer saat portrait.
function useWideLayout() {
  const query = "(min-width: 1024px), (orientation: landscape)";
  const get = () => (typeof window !== "undefined" ? window.matchMedia(query).matches : true);
  const [wide, setWide] = useState(get);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const handler = () => setWide(mq.matches);
    mq.addEventListener("change", handler);
    window.addEventListener("resize", handler);
    return () => {
      mq.removeEventListener("change", handler);
      window.removeEventListener("resize", handler);
    };
  }, []);
  return wide;
}

export default function POS() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const wide = useWideLayout();
  const [cartOpen, setCartOpen] = useState(false);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [variantCat, setVariantCat] = useState(null);
  const [custOpen, setCustOpen] = useState(false);
  const [variantNote, setVariantNote] = useState("");
  const [tempItems, setTempItems] = useState([]);
  const [editingLine, setEditingLine] = useState(null);
  const [editNoteVal, setEditNoteVal] = useState("");
  const [sessionLines, setSessionLines] = useState([]);
  const [density, setDensity] = useState(() => localStorage.getItem("pos_density") || "sedang");
  const setDens = (d) => { setDensity(d); localStorage.setItem("pos_density", d); };
  const gridClass = POS_GRID[density] || POS_GRID.sedang;
  const [cart, setCart] = useState([]);
  const [discount, setDiscount] = useState(0);
  const [taxRate, setTaxRate] = useState(0);
  const [payOpen, setPayOpen] = useState(false);
  const [method, setMethod] = useState("Tunai");
  const [channel, setChannel] = useState("Toko");
  const [paid, setPaid] = useState("");
  const [receipt, setReceipt] = useState(null);
  const [waPhone, setWaPhone] = useState("");
  const [settings, setSettings] = useState({});
  const [customers, setCustomers] = useState([]);
  const [customerId, setCustomerId] = useState("");
  const [custQuery, setCustQuery] = useState("");
  const [custHighlight, setCustHighlight] = useState("");
  const custListRef = useRef(null);
  const [custHistory, setCustHistory] = useState(null); // { customerId, sales }
  const [custHistLoading, setCustHistLoading] = useState(false);
  const [custHistExpanded, setCustHistExpanded] = useState(false);
  const [custHistCollapsed, setCustHistCollapsed] = useState(false);
  const [holdOpen, setHoldOpen] = useState(false);
  const [holdName, setHoldName] = useState("");
  const [holdType, setHoldType] = useState("Reguler");
  const [holdBusy, setHoldBusy] = useState(false);
  const [depositOpen, setDepositOpen] = useState(false);
  const [depositAmt, setDepositAmt] = useState("");
  const [nota, setNota] = useState(null);
  const [priceModal, setPriceModal] = useState(null); // { product, source: 'direct'|'variant' }
  const [priceVal, setPriceVal] = useState("");

  const needPrice = (p) => !(Number(p?.price) > 0);
  const openPrice = (product, source) => { setPriceVal(""); setPriceModal({ product, source }); };
  const confirmPrice = () => {
    const val = Number(priceVal) || 0;
    if (val <= 0) return toast.error("Masukkan harga lebih dari 0");
    const { product, source } = priceModal;
    if (source === "direct") {
      addToCart(product, "", val);
    } else {
      setTempItems((t) => {
        const ex = t.find((x) => x.product.id === product.id);
        if (ex) return t.map((x) => (x.product.id === product.id ? { ...x, qty: x.qty + 1, price: val } : x));
        return [...t, { product, qty: 1, price: val }];
      });
    }
    setPriceModal(null); setPriceVal("");
  };

  const load = () => {
    api.get("/products").then((r) => setProducts(r.data));
    api.get("/categories").then((r) => setCategories(r.data));
    api.get("/settings").then((r) => {
      setSettings(r.data || {});
      setTaxRate(r.data?.tax_rate || 0);
    });
    api.get("/customers").then((r) => setCustomers(r.data));
  };
  useEffect(load, []);

  // Pencarian pelanggan: hasil terurut relevansi, item teratas otomatis ter-highlight & list di-scroll ke atas.
  const filteredCustomers = useMemo(() => rankCustomers(customers, custQuery), [customers, custQuery]);
  const hasCustQuery = normalize(custQuery).length > 0;
  useEffect(() => {
    const top = hasCustQuery ? filteredCustomers[0]?.id : "__none__";
    setCustHighlight(top || "");
    if (custListRef.current) custListRef.current.scrollTop = 0;
  }, [custQuery, filteredCustomers, hasCustQuery]);
  useEffect(() => { if (!custOpen) setCustQuery(""); }, [custOpen]);

  const selectedCustomer = useMemo(() => customers.find((c) => c.id === customerId) || null, [customers, customerId]);

  // Riwayat pembelian pelanggan yang dipilih (read-only), tampil di bawah pemilih pelanggan.
  useEffect(() => {
    if (!customerId) { setCustHistory(null); setCustHistLoading(false); return; }
    let cancelled = false;
    setCustHistLoading(true); setCustHistExpanded(false); setCustHistCollapsed(false);
    api.get(`/customers/${customerId}/history`)
      .then((r) => { if (!cancelled) setCustHistory({ customerId, sales: Array.isArray(r.data) ? r.data : [] }); })
      .catch((e) => { if (!cancelled) { setCustHistory({ customerId, sales: [], error: formatApiError(e) }); } })
      .finally(() => { if (!cancelled) setCustHistLoading(false); });
    return () => { cancelled = true; };
  }, [customerId]);

  const custHistStats = useMemo(() => {
    const sales = custHistory?.sales || [];
    const total = sales.reduce((a, s) => a + (Number(s.total) || 0), 0);
    return { count: sales.length, total, last: sales[0]?.created_at || null };
  }, [custHistory]);

  const openHold = () => {
    if (cart.length === 0) return toast.error("Keranjang kosong");
    const c = customers.find((x) => x.id === customerId);
    setHoldName(c?.name || "");
    setHoldType("Reguler");
    setHoldOpen(true);
  };
  const submitHold = async () => {
    if (cart.length === 0) return toast.error("Keranjang kosong");
    setHoldBusy(true);
    try {
      await api.post("/orders", {
        customer_id: customerId || null,
        customer_name: holdName || "",
        items: cart, discount: Number(discount) || 0, tax_rate: taxRate,
        deposit_amount: 0, order_type: holdType, channel,
      });
      toast.success("Draft pesanan disimpan di menu Pesanan");
      setHoldOpen(false); setHoldName(""); setHoldType("Reguler");
      setCart([]); setDiscount(0); setCustomerId(""); setCartOpen(false); setChannel("Toko");
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
    finally { setHoldBusy(false); }
  };
  const submitDeposit = async () => {
    if (cart.length === 0) return toast.error("Keranjang kosong");
    try {
      const { data } = await api.post("/orders", {
        customer_id: customerId || null, items: cart,
        discount: Number(discount) || 0, tax_rate: taxRate,
        deposit_amount: Number(depositAmt) || 0, deposit_method: method, channel,
      });
      toast.success("Pesanan + deposit tersimpan");
      setDepositOpen(false); setDepositAmt(""); setCart([]); setDiscount(0); setCustomerId(""); setCartOpen(false); setChannel("Toko");
      setNota(data);
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
  };

  const searching = q.trim().length > 0;
  const filtered = useMemo(
    () =>
      products.filter(
        (p) =>
          p.active !== false &&
          (p.name.toLowerCase().includes(q.toLowerCase()) ||
            (p.barcode || "").includes(q) ||
            (p.sku || "").toLowerCase().includes(q.toLowerCase()))
      ),
    [products, q]
  );

  // Group products by category to show category tiles (main products) with variants
  const productsByCat = useMemo(() => {
    const m = {};
    products.forEach((p) => {
      if (p.active === false) return;
      const k = p.category_id || "none";
      (m[k] = m[k] || []).push(p);
    });
    return m;
  }, [products]);

  const catTiles = useMemo(() => {
    const list = categories
      .filter((c) => (productsByCat[c.id] || []).length > 0)
      .map((c) => ({ ...c, items: productsByCat[c.id] }));
    if ((productsByCat["none"] || []).length > 0) {
      list.push({ id: "none", name: "Tanpa Kategori", items: productsByCat["none"] });
    }
    return list;
  }, [categories, productsByCat]);

  const tileThumb = (tile) =>
    tile.image || tile.items.find((p) => p.image)?.image || null;

  const stripVariant = (name, catName) => {
    if (!catName) return name;
    const pref = `${catName} - `;
    return name.startsWith(pref) ? name.slice(pref.length) : name;
  };

  const addToCart = (p, note = "", priceOverride = null) => {
    const price = priceOverride != null ? Number(priceOverride) : (Number(p.price) || 0);
    const lineId = `${p.id}|${note}|${price}`;
    setCart((c) => {
      const ex = c.find((x) => x.lineId === lineId);
      if (ex) return c.map((x) => (x.lineId === lineId ? { ...x, qty: x.qty + 1 } : x));
      return [...c, { lineId, product_id: p.id, name: p.name, price, cost: p.cost || 0, qty: 1, note }];
    });
  };
  const setQty = (lineId, delta) =>
    setCart((c) =>
      c.map((x) => (x.lineId === lineId ? { ...x, qty: Math.max(1, x.qty + delta) } : x))
    );
  const setQtyAbs = (lineId, val) => {
    const n = Math.max(1, Math.floor(Number(val) || 1));
    setCart((c) => c.map((x) => (x.lineId === lineId ? { ...x, qty: n } : x)));
  };
  const removeItem = (lineId) => setCart((c) => c.filter((x) => x.lineId !== lineId));

  const addTemp = (p) => {
    if (needPrice(p) && !tempItems.find((x) => x.product.id === p.id)) {
      openPrice(p, "variant");
      return;
    }
    setTempItems((t) => {
      const ex = t.find((x) => x.product.id === p.id);
      if (ex) return t.map((x) => (x.product.id === p.id ? { ...x, qty: x.qty + 1 } : x));
      return [...t, { product: p, qty: 1 }];
    });
  };
  const decTemp = (pid) =>
    setTempItems((t) => t.map((x) => (x.product.id === pid ? { ...x, qty: x.qty - 1 } : x)).filter((x) => x.qty > 0));
  const setTempQty = (p, val) => {
    const n = Math.max(1, Math.floor(Number(val) || 1));
    setTempItems((t) => t.map((x) => (x.product.id === p.id ? { ...x, qty: n } : x)));
  };
  const commitVariants = () => {
    const note = variantNote.trim();
    if (tempItems.length) {
      setCart((c) => {
        let next = [...c];
        tempItems.forEach(({ product, qty, price }) => {
          const unit = price != null ? Number(price) : (Number(product.price) || 0);
          const lineId = `${product.id}|${note}|${unit}`;
          const ex = next.find((x) => x.lineId === lineId);
          if (ex) next = next.map((x) => (x.lineId === lineId ? { ...x, qty: x.qty + qty } : x));
          else next = [...next, { lineId, product_id: product.id, name: product.name, price: unit, cost: product.cost || 0, qty, note }];
        });
        return next;
      });
    }
    setTempItems([]);
    setVariantNote("");
  };
  const startEditNote = (i) => { setEditingLine(i.lineId); setEditNoteVal(i.note || ""); };
  const saveEditNote = (lineId) => {
    const note = editNoteVal.trim();
    setCart((c) => {
      const item = c.find((x) => x.lineId === lineId);
      if (!item) return c;
      const newLineId = `${item.product_id}|${note}|${item.price}`;
      let next = c.filter((x) => x.lineId !== lineId);
      const ex = next.find((x) => x.lineId === newLineId);
      if (ex) next = next.map((x) => (x.lineId === newLineId ? { ...x, qty: x.qty + item.qty } : x));
      else next = [...next, { ...item, lineId: newLineId, note }];
      return next;
    });
    setEditingLine(null);
    setEditNoteVal("");
  };

  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const cartCount = cart.reduce((s, i) => s + i.qty, 0);
  const taxAmt = ((subtotal - discount) * taxRate) / 100;
  const total = Math.max(0, subtotal - discount + taxAmt);
  const change = Math.max(0, Number(paid || 0) - total);

  const openPay = () => {
    if (cart.length === 0) return toast.error("Keranjang masih kosong");
    setPaid(method === "Tunai" ? "" : total);
    setPayOpen(true);
  };

  const pickMethod = (m) => {
    if (m === "Bank Transfer") { setMethod(BANKS[0]); setPaid(total); }
    else { setMethod(m); setPaid(m === "Tunai" ? "" : total); }
  };
  const renderChannelPicker = (prefix) => (
    <div className="mt-2 flex flex-wrap gap-2" data-testid={`${prefix}-channel-picker`}>
      {CHANNELS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => setChannel(c)}
          className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors duration-200 ${channel === c ? "border-primary bg-accent text-accent-foreground" : "border-border text-muted-foreground"}`}
          data-testid={`${prefix}-channel-${c}`}
        >
          {c}
        </button>
      ))}
    </div>
  );
  const renderMethodPicker = (prefix) => (
    <div className="mt-2 space-y-2">
      <div className="grid grid-cols-2 gap-2">
        {METHODS.map((m) => {
          const active = m === "Bank Transfer" ? isBank(method) : method === m;
          return (
            <button
              key={m}
              onClick={() => pickMethod(m)}
              className={`rounded-md border py-3 text-sm font-semibold transition-colors duration-200 ${active ? "border-primary bg-accent text-accent-foreground" : "border-border"}`}
              data-testid={`${prefix}-method-${m}`}
            >
              {m}
            </button>
          );
        })}
      </div>
      {isBank(method) && (
        <div className="grid grid-cols-3 gap-2" data-testid={`${prefix}-bank-options`}>
          {BANKS.map((b) => (
            <button
              key={b}
              onClick={() => { setMethod(b); setPaid(total); }}
              className={`rounded-md border px-2 py-2 text-xs font-semibold transition-colors duration-200 ${method === b ? "border-primary bg-accent text-accent-foreground" : "border-border"}`}
              data-testid={`${prefix}-bank-${b}`}
            >
              {b}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  const submitPay = async () => {
    if (method === "Tunai" && Number(paid) < total)
      return toast.error("Nominal bayar kurang");
    try {
      const { data } = await api.post("/sales", {
        items: cart,
        discount: Number(discount) || 0,
        tax_rate: taxRate,
        payment_method: method,
        paid_amount: method === "Tunai" ? Number(paid) : total,
        customer_id: customerId || null,
        channel,
      });
      setPayOpen(false);
      setCart([]);
      setDiscount(0);
      setPaid("");
      setCustomerId("");
      setChannel("Toko");
      setCartOpen(false);
      load();
      toast.success("Transaksi berhasil");
      setTimeout(() => {
        document.body.style.pointerEvents = "";
        setReceipt(data);
        setWaPhone(data.customer_phone || "");
      }, 300);
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    }
  };

  const printReceipt = async (r) => {
    try {
      const mode = await printReceiptSmart(r, settings);
      if (mode === "bluetooth") toast.success("Struk dikirim ke printer Bluetooth");
    } catch (e) {
      toast.error(e.message || "Gagal mencetak struk");
    }
  };

  const buildBillText = (r) => {
    const lines = [];
    lines.push(`*${settings.business_name || "Daneswara POS"}*`);
    if (settings.address) lines.push(settings.address);
    if (settings.phone) lines.push(`Telp: ${settings.phone}`);
    lines.push("--------------------------------");
    lines.push(`No   : ${r.invoice}`);
    lines.push(`Tgl  : ${new Date(r.created_at).toLocaleString("id-ID")}`);
    if (r.customer_name) lines.push(`Nama : ${r.customer_name}`);
    lines.push("--------------------------------");
    r.items.forEach((i) => {
      lines.push(`${i.qty} x ${i.name}`);
      lines.push(`     @${rupiah(i.price)}  =  ${rupiah(i.price * i.qty)}`);
      if (i.note) lines.push(`     * ${i.note}`);
    });
    lines.push("--------------------------------");
    lines.push(`Subtotal : ${rupiah(r.subtotal)}`);
    if (r.discount) lines.push(`Diskon   : -${rupiah(r.discount)}`);
    if (r.tax) lines.push(`Pajak    : ${rupiah(r.tax)}`);
    lines.push(`*TOTAL   : ${rupiah(r.total)}*`);
    lines.push(`Bayar (${r.payment_method}) : ${rupiah(r.paid_amount)}`);
    if (r.change) lines.push(`Kembali  : ${rupiah(r.change)}`);
    lines.push("--------------------------------");
    lines.push(settings.receipt_footer || "Terima kasih telah berbelanja!");
    return lines.join("\n");
  };

  const normalizePhone = (p) => {
    let d = (p || "").replace(/[^0-9]/g, "");
    if (!d) return "";
    if (d.startsWith("0")) d = "62" + d.slice(1);
    else if (d.startsWith("62")) { /* ok */ }
    else if (d.startsWith("8")) d = "62" + d;
    return d;
  };

  const sendWhatsApp = (r) => {
    const text = buildBillText(r);
    const phone = normalizePhone(waPhone);
    const url = phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
    if (!phone) toast.info("Nomor tujuan kosong — pilih kontak di WhatsApp");
  };

  const saveWaCustomer = async () => {
    if (!waPhone.trim()) return toast.error("Isi nomor WhatsApp dulu");
    const name = window.prompt("Nama pelanggan baru:", receipt?.customer_name || "");
    if (!name || !name.trim()) return;
    try {
      await api.post("/customers", { name: name.trim(), phone: waPhone.trim() });
      toast.success("Pelanggan baru tersimpan");
      api.get("/customers").then((r) => setCustomers(r.data));
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    }
  };

  const copyBill = async (r) => {
    const text = buildBillText(r);
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Struk disalin — tinggal tempel di WhatsApp pelanggan");
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      toast.success("Struk disalin");
    }
  };

  const cartBody = (
    <>
      <div className="space-y-2 border-b border-border p-4">
        <div className="flex items-center justify-between pr-8">
          <h3 className="font-display text-lg font-semibold">Keranjang</h3>
          <Button variant="outline" size="sm" className="gap-1" onClick={openHold} data-testid="pos-hold-button"><PauseCircle className="h-4 w-4" /> Tahan (Draft)</Button>
        </div>
        <Popover open={custOpen} onOpenChange={setCustOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" role="combobox" className="h-9 w-full justify-between font-normal" data-testid="pos-customer-select">
              <span className="truncate">
                {customerId ? (customers.find((c) => c.id === customerId)?.name || "Pelanggan") : "Pilih pelanggan (opsional)"}
              </span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
            <Command shouldFilter={false} value={custHighlight} onValueChange={setCustHighlight} loop>
              <CommandInput
                placeholder="Cari nama / nomor..."
                value={custQuery}
                onValueChange={setCustQuery}
                data-testid="pos-customer-search"
              />
              <CommandList ref={custListRef} data-testid="pos-customer-list">
                <CommandEmpty>Pelanggan tidak ditemukan.</CommandEmpty>
                {!hasCustQuery && (
                  <CommandItem
                    value="__none__"
                    onSelect={() => { setCustomerId(""); setCustOpen(false); }}
                    data-testid="pos-customer-none"
                  >
                    <Check className={`mr-2 h-4 w-4 ${!customerId ? "opacity-100" : "opacity-0"}`} />
                    Tanpa pelanggan
                  </CommandItem>
                )}
                {filteredCustomers.map((c, idx) => (
                  <CommandItem
                    key={c.id}
                    value={c.id}
                    onSelect={() => { setCustomerId(c.id); setCustOpen(false); }}
                    data-testid={`pos-customer-option-${c.id}`}
                    data-rank={idx}
                  >
                    <Check className={`mr-2 h-4 w-4 ${customerId === c.id ? "opacity-100" : "opacity-0"}`} />
                    <span className="min-w-0 flex-1 truncate">{c.name}{c.phone ? ` · ${c.phone}` : ""}</span>
                    {hasCustQuery && idx === 0 && (
                      <span className="ml-2 shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">Teratas</span>
                    )}
                  </CommandItem>
                ))}
                {hasCustQuery && filteredCustomers.length >= CUSTOMER_RESULT_LIMIT && (
                  <p className="px-3 py-2 text-center text-xs text-muted-foreground">Menampilkan {CUSTOMER_RESULT_LIMIT} teratas — ketik lebih spesifik.</p>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        {selectedCustomer && (
          <div className="rounded-md border border-border bg-secondary/40 text-sm" data-testid="pos-customer-history-panel">
            <button
              type="button"
              onClick={() => setCustHistCollapsed((v) => !v)}
              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
              data-testid="pos-customer-history-toggle"
            >
              <div className="flex min-w-0 items-center gap-2">
                <History className="h-4 w-4 shrink-0 text-primary" />
                <div className="min-w-0">
                  <p className="truncate font-medium leading-tight">
                    {selectedCustomer.name}
                    {selectedCustomer.phone && <span className="ml-1.5 text-xs font-normal text-muted-foreground"><Phone className="mr-0.5 inline h-3 w-3" />{selectedCustomer.phone}</span>}
                  </p>
                  <p className="truncate text-xs text-muted-foreground" data-testid="pos-customer-history-stats">
                    {custHistLoading ? "Memuat riwayat..." : custHistStats.count === 0
                      ? "Belum ada riwayat pembelian"
                      : `${custHistStats.count} transaksi · ${rupiah(custHistStats.total)}${custHistStats.last ? ` · terakhir ${fmtShortDate(custHistStats.last)}` : ""}`}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {custHistLoading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : (custHistCollapsed ? <ChevronRight className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />)}
              </div>
            </button>
            {!custHistCollapsed && !custHistLoading && (
              <div className="border-t border-border px-2 py-2">
                {custHistory?.error && <p className="px-1 text-xs text-destructive" data-testid="pos-customer-history-error">{custHistory.error}</p>}
                {!custHistory?.error && custHistStats.count === 0 && (
                  <p className="px-1 text-xs text-muted-foreground">Pelanggan ini belum pernah bertransaksi.</p>
                )}
                {custHistStats.count > 0 && (
                  <>
                    <p className="px-1 pb-1 text-[11px] text-muted-foreground">Ketuk transaksi untuk melihat nota.</p>
                    <div className="max-h-56 space-y-1 overflow-y-auto pr-0.5">
                      {(custHistExpanded ? custHistory.sales : custHistory.sales.slice(0, HISTORY_PREVIEW)).map((s) => {
                        const notes = itemNotes(s.items);
                        return (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => setNota(s)}
                            className="w-full rounded-md bg-background px-2.5 py-2 text-left transition-colors hover:bg-accent"
                            data-testid={`pos-customer-history-item-${s.id}`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="truncate text-xs font-semibold">{s.invoice}</span>
                              <span className="shrink-0 text-xs font-semibold">{rupiah(s.total)}</span>
                            </div>
                            <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                              <span className="truncate">{summarizeItems(s.items) || "-"}</span>
                              <span className="shrink-0">{fmtShortDate(s.created_at)}</span>
                            </div>
                            {notes.length > 0 && (
                              <p className="mt-0.5 truncate text-[11px] italic text-muted-foreground" title={notes.join(" | ")}>
                                <Pencil className="mr-1 inline h-3 w-3" />{notes.join(" | ")}
                              </p>
                            )}
                          </button>
                        );
                      })}
                    </div>
                    {custHistStats.count > HISTORY_PREVIEW && (
                      <button
                        type="button"
                        onClick={() => setCustHistExpanded((v) => !v)}
                        className="mt-1 w-full py-1 text-center text-xs font-medium text-primary hover:underline"
                        data-testid="pos-customer-history-more"
                      >
                        {custHistExpanded ? "Tampilkan lebih sedikit" : `Lihat semua (${custHistStats.count})`}
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <AnimatePresence>
          {cart.length === 0 && <p className="text-sm text-muted-foreground">Belum ada item.</p>}
          {cart.map((i) => (
            <motion.div
              key={i.lineId}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="mb-3 rounded-md border border-border p-3"
              data-testid={`cart-item-${i.product_id}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{i.name}</p>
                  {editingLine === i.lineId ? (
                    <div className="mt-1.5 space-y-1.5">
                      <textarea
                        value={editNoteVal}
                        onChange={(e) => setEditNoteVal(e.target.value)}
                        rows={2}
                        autoFocus
                        placeholder="Tulis catatan..."
                        data-testid={`cart-note-edit-${i.product_id}`}
                        className="w-full resize-none rounded-md border border-input bg-background px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-ring"
                      />
                      <div className="flex gap-1.5">
                        <button onClick={() => saveEditNote(i.lineId)} className="rounded-md bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground" data-testid={`cart-note-save-${i.product_id}`}>Simpan</button>
                        <button onClick={() => { setEditingLine(null); setEditNoteVal(""); }} className="rounded-md bg-secondary px-2.5 py-1 text-xs font-medium" data-testid={`cart-note-cancel-${i.product_id}`}>Batal</button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => startEditNote(i)} className="mt-0.5 flex max-w-full items-center gap-1 text-left text-xs italic text-muted-foreground hover:text-foreground" data-testid={`cart-note-btn-${i.product_id}`}>
                      <Pencil className="h-3 w-3 shrink-0" />
                      <span className="truncate">{i.note ? i.note : "Tambah catatan"}</span>
                    </button>
                  )}
                </div>
                <button onClick={() => removeItem(i.lineId)} className="shrink-0 text-destructive" data-testid={`cart-remove-${i.product_id}`}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button onClick={() => setQty(i.lineId, -1)} className="flex h-7 w-7 items-center justify-center rounded-md bg-secondary" data-testid={`cart-minus-${i.product_id}`}>
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <input
                    type="number"
                    inputMode="numeric"
                    min="1"
                    value={i.qty}
                    onChange={(e) => setQtyAbs(i.lineId, e.target.value)}
                    onFocus={(e) => e.target.select()}
                    className="h-7 w-12 rounded-md border border-border bg-background text-center text-sm font-semibold"
                    data-testid={`cart-qty-input-${i.product_id}`}
                  />
                  <button onClick={() => setQty(i.lineId, 1)} className="flex h-7 w-7 items-center justify-center rounded-md bg-secondary" data-testid={`cart-plus-${i.product_id}`}>
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
                <span className="font-display text-sm font-bold">{rupiah(i.price * i.qty)}</span>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      <div className="border-t border-border p-4">
        <div className="mb-3 flex items-center gap-2">
          <Label className="text-xs whitespace-nowrap">Diskon (Rp)</Label>
          <NumberInput
            value={discount}
            onValueChange={setDiscount}
            className="h-9"
            data-testid="pos-discount-input"
          />
        </div>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>{rupiah(subtotal)}</span></div>
          <div className="flex justify-between text-muted-foreground"><span>Diskon</span><span>-{rupiah(discount)}</span></div>
          <div className="flex justify-between text-muted-foreground"><span>Pajak ({taxRate}%)</span><span>{rupiah(taxAmt)}</span></div>
          <div className="flex justify-between border-t border-border pt-2 font-display text-lg font-bold"><span>Total</span><span data-testid="pos-total">{rupiah(total)}</span></div>
        </div>
        <Button onClick={openPay} className="mt-4 h-14 w-full text-base font-bold" data-testid="pos-pay-button">
          Bayar
        </Button>
        <Button onClick={() => { if (cart.length === 0) return toast.error("Keranjang kosong"); setDepositAmt(""); setDepositOpen(true); }} variant="outline" className="mt-2 h-11 w-full gap-2 font-semibold" data-testid="pos-deposit-button">
          <HandCoins className="h-4 w-4" /> Pesanan + Deposit (DP)
        </Button>
      </div>
    </>
  );

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <div className="flex h-14 items-center justify-between border-b border-border bg-card px-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/app")} data-testid="pos-back-button">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <span className="font-display text-lg font-bold">Kasir POS</span>
        </div>
        <span className="text-sm text-muted-foreground">{user?.name} · {user?.role}</span>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* products */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="border-b border-border p-4">
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <ScanLine className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Scan barcode atau cari produk..."
                  className="h-12 pl-11"
                  data-testid="pos-search-input"
                />
              </div>
              <div className="flex shrink-0 items-center rounded-md border border-border p-0.5" data-testid="grid-density-toggle">
                {[
                  { k: "besar", icon: Grid2x2, label: "Besar" },
                  { k: "sedang", icon: LayoutGrid, label: "Sedang" },
                  { k: "kecil", icon: Grid3x3, label: "Kecil" },
                ].map(({ k, icon: Icon, label }) => (
                  <button
                    key={k}
                    onClick={() => setDens(k)}
                    title={`Ukuran ${label}`}
                    data-testid={`density-${k}`}
                    className={`flex h-9 w-9 items-center justify-center rounded transition-colors ${density === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"}`}
                  >
                    <Icon className="h-4 w-4" />
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {searching ? (
              /* Direct product search results (barcode / name) */
              <div className={`grid ${gridClass}`}>
                {filtered.map((p) => (
                  <motion.button
                    key={p.id}
                    whileTap={{ scale: 0.96 }}
                    onClick={() => (needPrice(p) ? openPrice(p, "direct") : addToCart(p))}
                    data-testid={`pos-product-${p.id}`}
                    className="flex flex-col rounded-md border border-border bg-card p-1.5 text-left transition-colors duration-200 hover:border-primary"
                  >
                    <div className="mb-1 aspect-square overflow-hidden rounded bg-secondary flex items-center justify-center">
                      {p.image ? (
                        <img src={p.image} alt={p.name} className="h-full w-full object-cover" />
                      ) : (
                        <ShoppingCart className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <p className="line-clamp-2 text-[11px] font-medium leading-tight">{p.name}</p>
                    <p className="mt-0.5 font-display text-xs font-bold text-primary">{needPrice(p) ? "Harga manual" : rupiah(p.price)}</p>
                    <p className={`text-[10px] ${p.stock <= 0 ? "font-semibold text-destructive" : "text-muted-foreground"}`}>Stok: {p.stock}</p>
                  </motion.button>
                ))}
                {filtered.length === 0 && <p className="col-span-full text-sm text-muted-foreground">Tidak ada produk.</p>}
              </div>
            ) : (
              /* Category tiles (main products) — variants shown after tapping */
              <div className={`grid ${gridClass}`}>
                {catTiles.map((tile) => {
                  const thumb = tileThumb(tile);
                  return (
                    <motion.button
                      key={tile.id}
                      whileTap={{ scale: 0.96 }}
                      onClick={() => { setVariantCat(tile); setVariantNote(""); setTempItems([]); }}                      data-testid={`pos-cat-tile-${tile.id}`}
                      className="group relative flex aspect-square flex-col overflow-hidden rounded-md border border-border bg-card text-left transition-colors duration-200 hover:border-primary"
                    >
                      <div className="absolute inset-0 flex items-center justify-center bg-secondary">
                        {thumb ? (
                          <img src={thumb} alt={tile.name} className="h-full w-full object-cover" />
                        ) : (
                          <span className="font-display text-xl font-bold text-muted-foreground">{tile.name.charAt(0)}</span>
                        )}
                      </div>
                      <div className="absolute inset-x-0 bottom-0 bg-black/55 px-1 py-1 backdrop-blur-sm">
                        <p className="line-clamp-2 text-center text-[10px] font-semibold leading-tight text-white">{tile.name}</p>
                      </div>
                      <span className="absolute right-1 top-1 rounded-full bg-primary px-1 py-0.5 text-[9px] font-bold leading-none text-primary-foreground">{tile.items.length}</span>
                    </motion.button>
                  );
                })}
                {catTiles.length === 0 && <p className="col-span-full text-sm text-muted-foreground">Belum ada produk.</p>}
              </div>
            )}
          </div>
        </div>

        {/* cart side panel — landscape / desktop */}
        {wide && (
          <aside className="flex w-[340px] shrink-0 flex-col border-l border-border bg-card" data-testid="cart-panel">
            {cartBody}
          </aside>
        )}
      </div>

      {/* floating cart button — portrait */}
      {!wide && (
        <button
          onClick={() => setCartOpen(true)}
          data-testid="pos-cart-fab"
          className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-primary px-5 py-3.5 text-primary-foreground shadow-lg transition-transform active:scale-95"
        >
          <div className="relative">
            <ShoppingCart className="h-6 w-6" />
            {cartCount > 0 && (
              <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white" data-testid="pos-cart-fab-count">{cartCount}</span>
            )}
          </div>
          <span className="font-display text-sm font-bold">{rupiah(total)}</span>
        </button>
      )}

      {/* cart drawer — portrait */}
      {!wide && (
        <Sheet open={cartOpen} onOpenChange={(o) => { setCartOpen(o); if (!o) setTimeout(() => { document.body.style.pointerEvents = ""; }, 100); }}>
          <SheetContent side="right" className="flex w-full flex-col gap-0 bg-card p-0 sm:max-w-md" data-testid="cart-sheet">
            {cartBody}
          </SheetContent>
        </Sheet>
      )}

      {/* variant picker dialog */}
      <Dialog open={!!variantCat} onOpenChange={(o) => { if (!o) { commitVariants(); setVariantCat(null); setTimeout(() => { document.body.style.pointerEvents = ""; }, 100); } }}>
        <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden p-0 sm:max-w-lg" onCloseAutoFocus={() => { document.body.style.pointerEvents = ""; }} data-testid="variant-dialog">
          <DialogHeader className="shrink-0 border-b border-border px-5 pb-3 pt-5">
            <div className="flex items-start justify-between gap-3 pr-6">
              <div className="min-w-0">
                <DialogTitle className="font-display">{variantCat?.name}</DialogTitle>
                <p className="text-xs text-muted-foreground">Pilih varian untuk ditambahkan ke keranjang</p>
              </div>
              {(() => {
                const cnt = tempItems.reduce((s, x) => s + x.qty, 0);
                const tot = tempItems.reduce((s, x) => {
                  const unit = x.price != null ? Number(x.price) : (Number(x.product?.price) || 0);
                  return s + unit * x.qty;
                }, 0);
                return (
                  <div className="shrink-0 text-right" data-testid="variant-total-label">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Total {cnt > 0 ? `(${cnt} item)` : ""}</p>
                    <p className="font-display text-lg font-bold text-primary" data-testid="variant-total-amount">{rupiah(tot)}</p>
                  </div>
                );
              })()}
            </div>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
            <div className="space-y-2">
              {variantCat?.items.map((p) => {
                const inTemp = tempItems.find((x) => x.product.id === p.id);
                return (
                  <div
                    key={p.id}
                    className="flex w-full items-center gap-3 rounded-lg border border-border bg-card p-3 text-left transition-colors hover:border-primary"
                    data-testid={`variant-item-${p.id}`}
                  >
                    <button onClick={() => addTemp(p)} className="flex min-w-0 flex-1 items-center gap-3 text-left" data-testid={`variant-add-${p.id}`}>
                      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md bg-secondary flex items-center justify-center">
                        {p.image ? <img src={p.image} alt="" className="h-full w-full object-cover" /> : <ShoppingCart className="h-5 w-5 text-muted-foreground" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{stripVariant(p.name, variantCat?.name)}</p>
                        <p className={`text-xs ${p.stock <= 0 ? "font-semibold text-destructive" : "text-muted-foreground"}`}>Stok: {p.stock}{p.stock <= 0 ? " (minus)" : ""}</p>
                      </div>
                      <p className="font-display font-bold text-primary">{inTemp?.price != null ? rupiah(inTemp.price) : (needPrice(p) ? "Manual" : rupiah(p.price))}</p>
                    </button>
                    {inTemp ? (
                      <div className="flex shrink-0 items-center gap-1.5">
                        <button onClick={() => decTemp(p.id)} className="flex h-7 w-7 items-center justify-center rounded-md bg-secondary" data-testid={`variant-minus-${p.id}`}><Minus className="h-3.5 w-3.5" /></button>
                        <input
                          type="number"
                          inputMode="numeric"
                          min="1"
                          value={inTemp.qty}
                          onChange={(e) => setTempQty(p, e.target.value)}
                          onFocus={(e) => e.target.select()}
                          className="h-7 w-11 rounded-md border border-border bg-background text-center text-sm font-semibold"
                          data-testid={`variant-qty-${p.id}`}
                        />
                        <button onClick={() => addTemp(p)} className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground" data-testid={`variant-plus-${p.id}`}><Plus className="h-3.5 w-3.5" /></button>
                      </div>
                    ) : (
                      <button onClick={() => addTemp(p)} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground" data-testid={`variant-quickadd-${p.id}`}><Plus className="h-3.5 w-3.5" /></button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="shrink-0 border-t border-border px-5 py-3">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Catatan (muncul di struk)</label>
            <textarea
              value={variantNote}
              onChange={(e) => setVariantNote(e.target.value)}
              placeholder="cth: Sablon logo depan, ukuran L, warna hitam..."
              rows={2}
              data-testid="variant-note-input"
              className="mb-3 w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            <p className="mb-3 text-[11px] text-muted-foreground">Catatan akan menempel ke semua varian yang dipilih saat menekan Selesai.</p>
            <Button className="w-full" onClick={() => { commitVariants(); setVariantCat(null); }} data-testid="variant-done-button">
              {tempItems.reduce((s, x) => s + x.qty, 0) > 0
                ? `Selesai — Tambah ${tempItems.reduce((s, x) => s + x.qty, 0)} item`
                : "Selesai"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* payment dialog */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>        <DialogContent data-testid="payment-dialog">
          <DialogHeader>
            <DialogTitle className="font-display">Pembayaran — {rupiah(total)}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs uppercase tracking-widest text-muted-foreground">Sumber Penjualan</Label>
              {renderChannelPicker("pay")}
            </div>
            <div>
              <Label className="text-xs uppercase tracking-widest text-muted-foreground">Metode Pembayaran</Label>
              {renderMethodPicker("pay")}
            </div>
            {method === "Tunai" && (
              <div>
                <Label>Nominal Diterima</Label>
                <NumberInput value={paid} onValueChange={setPaid} className="mt-1 h-12 text-lg" data-testid="pay-cash-input" />
                <div className="mt-2 flex flex-wrap gap-2">
                  {[total, 50000, 100000, 200000].map((v, idx) => (
                    <button key={idx} onClick={() => setPaid(v)} className="rounded-md bg-secondary px-3 py-1.5 text-xs font-medium">
                      {rupiah(v)}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-sm">Kembalian: <span className="font-bold">{rupiah(change)}</span></p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={submitPay} className="h-12 w-full text-base font-bold" data-testid="pay-confirm-button">
              Konfirmasi & Cetak Struk
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* deposit dialog */}
      <NotaDialog nota={nota} onClose={() => setNota(null)} settings={settings} />
      <Dialog open={depositOpen} onOpenChange={setDepositOpen}>
        <DialogContent data-testid="deposit-dialog">
          <DialogHeader><DialogTitle className="font-display">Pesanan Custom — Total {rupiah(total)}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Simpan pesanan dengan uang muka. Sisa dilunasi saat pesanan selesai (menu Pesanan).</p>
            <div>
              <Label className="text-xs uppercase tracking-widest text-muted-foreground">Sumber Penjualan</Label>
              {renderChannelPicker("deposit")}
            </div>
            <div>
              <Label className="text-xs uppercase tracking-widest text-muted-foreground">Metode Deposit</Label>
              {renderMethodPicker("deposit")}
            </div>
            <div className="space-y-1">
              <Label>Nominal Deposit (DP)</Label>
              <Input type="number" value={depositAmt} onChange={(e) => setDepositAmt(e.target.value)} className="h-12 text-lg" data-testid="deposit-amount-input" />
              <p className="text-sm">Sisa tagihan: <span className="font-bold">{rupiah(Math.max(0, total - Number(depositAmt || 0)))}</span></p>
            </div>
          </div>
          <DialogFooter><Button onClick={submitDeposit} className="h-12 w-full font-bold" data-testid="deposit-confirm-button">Simpan Pesanan</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Hold as Draft order dialog */}
      <Dialog open={holdOpen} onOpenChange={(o) => { if (!o) { setHoldOpen(false); setTimeout(() => { document.body.style.pointerEvents = ""; }, 100); } }}>
        <DialogContent data-testid="hold-dialog">
          <DialogHeader><DialogTitle className="font-display">Tahan sebagai Draft Pesanan</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Pesanan disimpan di menu <b>Pesanan</b> sebagai draft (belum bayar). Total {rupiah(total)}.</p>
            <div className="space-y-1">
              <Label>Nama Pesanan / Pelanggan</Label>
              <Input value={holdName} onChange={(e) => setHoldName(e.target.value)} placeholder="cth: Order Budi / Antrian 3" data-testid="hold-name-input" />
            </div>
            <div className="space-y-1">
              <Label>Jenis Pesanan</Label>
              <Select value={holdType} onValueChange={setHoldType}>
                <SelectTrigger data-testid="hold-type-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ORDER_TYPES.map((t) => <SelectItem key={t} value={t} data-testid={`hold-type-${t}`}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Sumber Penjualan</Label>
              {renderChannelPicker("hold")}
            </div>
          </div>
          <DialogFooter>
            <Button onClick={submitHold} disabled={holdBusy} className="h-12 w-full font-bold" data-testid="hold-confirm-button">
              {holdBusy ? "Menyimpan..." : "Simpan Draft"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* manual price dialog (for products with price 0) */}
      <Dialog open={!!priceModal} onOpenChange={(o) => { if (!o) { setPriceModal(null); setPriceVal(""); setTimeout(() => { document.body.style.pointerEvents = ""; }, 100); } }}>
        <DialogContent data-testid="price-dialog">
          <DialogHeader>
            <DialogTitle className="font-display">Masukkan Harga</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{priceModal?.product?.name}</span>
            </p>
            <div className="space-y-1">
              <Label>Harga Jual (Rp)</Label>
              <NumberInput
                value={priceVal}
                onValueChange={setPriceVal}
                autoFocus
                className="h-12 text-lg"
                data-testid="price-input"
                onKeyDown={(e) => { if (e.key === "Enter") confirmPrice(); }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setPriceModal(null); setPriceVal(""); }} data-testid="price-cancel-button">Batal</Button>
            <Button onClick={confirmPrice} className="font-bold" data-testid="price-confirm-button">Tambah ke Keranjang</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* receipt dialog */}
      <Dialog open={!!receipt} onOpenChange={(o) => { if (!o) { setReceipt(null); document.body.style.pointerEvents = ""; } }}>
        <DialogContent data-testid="receipt-dialog">
          <DialogHeader className="sr-only"><DialogTitle>Pembayaran Berhasil</DialogTitle></DialogHeader>
          {receipt && (
            <div>
              <div className="mb-3 flex flex-col items-center">
                <CheckCircle2 className="h-12 w-12 text-emerald-500" />
                <p className="mt-2 font-display text-lg font-bold">Pembayaran Berhasil</p>
              </div>
              <div className="rounded-md border border-dashed border-border p-4 font-mono text-xs">
                <p className="text-center font-bold">{receipt.invoice}</p>
                <div className="my-2 border-t border-dashed" />
                {receipt.items.map((i, idx) => (
                  <div key={idx}>
                    <div className="flex justify-between">
                      <span>{i.qty}x {i.name}</span>
                      <span>{rupiah(i.price * i.qty)}</span>
                    </div>
                    <p className="pl-2 text-muted-foreground">{rupiah(i.price)} x {i.qty}{i.note ? ` • ${i.note}` : ""}</p>
                  </div>
                ))}
                <div className="my-2 border-t border-dashed" />
                <div className="flex justify-between"><span>Subtotal</span><span>{rupiah(receipt.subtotal)}</span></div>
                <div className="flex justify-between"><span>Diskon</span><span>-{rupiah(receipt.discount)}</span></div>
                <div className="flex justify-between"><span>Pajak</span><span>{rupiah(receipt.tax)}</span></div>
                <div className="flex justify-between font-bold"><span>Total</span><span>{rupiah(receipt.total)}</span></div>
                <div className="flex justify-between"><span>{receipt.payment_method}</span><span>{rupiah(receipt.paid_amount)}</span></div>
                <div className="flex justify-between"><span>Kembalian</span><span>{rupiah(receipt.change)}</span></div>
              </div>
              <div className="mt-4 space-y-2">
                <div className="space-y-1 text-left">
                  <label className="text-xs text-muted-foreground">Nomor WhatsApp pelanggan</label>
                  <Input
                    value={waPhone}
                    onChange={(e) => setWaPhone(e.target.value)}
                    placeholder="cth: 08123456789"
                    inputMode="tel"
                    data-testid="receipt-wa-phone-input"
                  />
                  {waPhone.trim() && !receipt.customer_id && (
                    <button
                      type="button"
                      onClick={saveWaCustomer}
                      className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                      data-testid="receipt-save-customer-button"
                    >
                      <UserPlus className="h-3.5 w-3.5" /> Simpan sebagai pelanggan baru
                    </button>
                  )}
                </div>
                <Button className="w-full gap-2 bg-[#25D366] text-white hover:bg-[#1ebe5b]" onClick={() => sendWhatsApp(receipt)} data-testid="receipt-whatsapp-button">
                  <MessageCircle className="h-4 w-4" /> Kirim Struk via WhatsApp
                </Button>
                <ShareNotaImageButton nota={receipt} settings={settings} />
                <Button variant="secondary" className="w-full gap-2" onClick={() => copyBill(receipt)} data-testid="receipt-copy-button">
                  <Copy className="h-4 w-4" /> Salin Struk
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => printReceipt(receipt)} data-testid="receipt-print-button">Cetak</Button>
                  <Button className="flex-1" onClick={() => { setReceipt(null); document.body.style.pointerEvents = ""; }} data-testid="receipt-close-button">Transaksi Baru</Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
