/* Daftar pesanan Custom Sticker (Sales Channel > Pesanan Merchandise). */
import { useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Search, RefreshCw } from "lucide-react";
import { STICKER_STATUSES } from "@/lib/stickerPricing";

const rp = (n) => `Rp ${Number(n || 0).toLocaleString("id-ID")}`;

export default function StickerOrders() {
  const [list, setList] = useState([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [loading, setLoading] = useState(false);

  const load = () => {
    setLoading(true);
    api
      .get("/sticker-orders")
      .then((r) => setList(r.data || []))
      .catch(() => toast.error("Gagal memuat pesanan sticker"))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const term = q.trim().toLowerCase();
  const rows = useMemo(
    () =>
      list.filter((o) => {
        if (status !== "all" && o.status !== status) return false;
        if (!term) return true;
        return `${o.order_code} ${o.customer_name} ${o.customer_phone} ${o.material} ${o.status}`.toLowerCase().includes(term);
      }),
    [list, status, term],
  );

  const setOrderStatus = async (o, next) => {
    try {
      await api.patch(`/sticker-orders/${o.id}`, { status: next });
      setList((prev) => prev.map((x) => (x.id === o.id ? { ...x, status: next } : x)));
      toast.success(`Status ${o.order_code} → ${next}`);
    } catch {
      toast.error("Gagal mengubah status");
    }
  };

  return (
    <div className="space-y-4" data-testid="sticker-orders-page">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Sales Channel · Pesanan Merchandise</p>
        <h1 className="font-display text-3xl font-bold tracking-tight">Pesanan Custom Sticker</h1>
        <p className="mt-1 text-sm text-muted-foreground">BONTAX Rp 15.000/lembar · VINYL (Waterproof) Rp 25.000/lembar · beli ≥ 6 lembar potong Rp 2.000/lembar (harga termasuk print + cut setengah putus).</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari kode, nama, telepon, bahan..." className="pl-10" data-testid="sticker-order-search" />
        </div>
        <div className="flex flex-wrap gap-1">
          {["all", ...STICKER_STATUSES].map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              data-testid={`sticker-order-tab-${s}`}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                status === s ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {s === "all" ? "Semua" : s}
            </button>
          ))}
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={load} data-testid="sticker-order-refresh">
          <RefreshCw className="h-4 w-4" /> Muat Ulang
        </Button>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Memuat...</p>}
      {!loading && rows.length === 0 && <p className="text-sm text-muted-foreground">Belum ada pesanan sticker.</p>}

      <div className="space-y-2">
        {rows.map((o) => (
          <div key={o.id} className="rounded-lg border border-border bg-card p-3" data-testid={`sticker-order-${o.id}`}>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-semibold">{o.order_code}</span>
              <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-bold uppercase">{o.material}</span>
              <span className="text-muted-foreground">{o.customer_name} · {o.customer_phone}</span>
              <span className="ml-auto font-bold">{rp(o.total_price)}</span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span>{o.sheets} lembar × {rp(o.unit_price)}</span>
              {o.layout?.template && <span>Template: {o.layout.template}</span>}
              {o.layout?.per_sheet ? <span>{o.layout.per_sheet} pcs/lembar</span> : null}
              {o.note && <span>Catatan: {o.note}</span>}
              <span className="ml-auto">{o.created_at ? new Date(o.created_at).toLocaleString("id-ID") : ""}</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {STICKER_STATUSES.map((s) => (
                <button
                  key={s}
                  onClick={() => setOrderStatus(o, s)}
                  data-testid={`sticker-order-status-${s}-${o.id}`}
                  className={`rounded-md border px-2 py-1 text-[11px] font-semibold transition ${
                    o.status === s ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
