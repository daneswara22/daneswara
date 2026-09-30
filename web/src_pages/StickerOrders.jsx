/* Daftar pesanan Custom Sticker (Sales Channel > Pesanan Merchandise).
 * Aksi: Lihat (detail + preview kanvas tersimpan), Proses (kirim ke POS), Hapus.
 */
import { useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Search, RefreshCw, Eye, Play, Trash2, Copy } from "lucide-react";
import { STICKER_STATUSES } from "@/lib/stickerPricing";

const rp = (n) => `Rp ${Number(n || 0).toLocaleString("id-ID")}`;

export default function StickerOrders() {
  const [list, setList] = useState([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState(null);
  const [busy, setBusy] = useState("");

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

  const openDetail = async (o) => {
    setBusy(o.id);
    try {
      const { data } = await api.get(`/sticker-orders/${o.id}/detail`);
      setDetail(data);
    } catch {
      toast.error("Gagal memuat detail pesanan");
    } finally {
      setBusy("");
    }
  };

  const processOrder = async (o) => {
    setBusy(o.id);
    try {
      const { data } = await api.post(`/sticker-orders/${o.id}/process`);
      setList((prev) => prev.map((x) => (x.id === o.id ? { ...x, status: data.status, pos_order_id: data.pos_order_id } : x)));
      toast.success(data.already ? `Sudah ada di POS: ${data.pos_order_number}` : `Terkirim ke POS: ${data.pos_order_number}`);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Gagal memproses pesanan");
    } finally {
      setBusy("");
    }
  };

  const removeOrder = async (o) => {
    if (!window.confirm(`Hapus pesanan ${o.order_code}?`)) return;
    setBusy(o.id);
    try {
      await api.delete(`/sticker-orders/${o.id}`);
      setList((prev) => prev.filter((x) => x.id !== o.id));
      toast.success("Pesanan dihapus");
    } catch {
      toast.error("Gagal menghapus pesanan");
    } finally {
      setBusy("");
    }
  };

  const copyContact = async (o) => {
    const text = `${o.customer_name} - ${o.customer_phone}`;
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Nama + No HP disalin");
    } catch {
      toast.error("Gagal menyalin");
    }
  };

  return (
    <div className="space-y-4" data-testid="sticker-orders-page">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Sales Channel · Pesanan Merchandise</p>
        <h1 className="font-display text-3xl font-bold tracking-tight">Pesanan Custom Sticker</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          BONTAX Rp 15.000/lembar · VINYL (Waterproof) Rp 25.000/lembar · beli ≥ 6 lembar potong Rp 2.000/lembar (termasuk print + cut setengah putus).
        </p>
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
              <span className="rounded-full border border-border px-2 py-0.5 text-[11px] font-semibold">{o.status}</span>
              <span className="text-muted-foreground">{o.customer_name} - {o.customer_phone}</span>
              <span className="ml-auto font-bold">{rp(o.total_price)}</span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span>{o.sheets} lembar × {rp(o.unit_price)}</span>
              {o.layout?.template && <span>Template: {o.layout.template}</span>}
              {o.layout?.per_sheet ? <span>{o.layout.per_sheet} pcs/lembar</span> : null}
              {o.note && <span>Catatan: {o.note}</span>}
              <span className="ml-auto">{o.created_at ? new Date(o.created_at).toLocaleString("id-ID") : ""}</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button variant="outline" size="sm" className="gap-1" disabled={busy === o.id} onClick={() => openDetail(o)} data-testid={`sticker-view-${o.id}`}>
                <Eye className="h-3.5 w-3.5" /> Lihat
              </Button>
              <Button size="sm" className="gap-1" disabled={busy === o.id} onClick={() => processOrder(o)} data-testid={`sticker-process-${o.id}`}>
                <Play className="h-3.5 w-3.5" /> Proses
              </Button>
              <Button variant="outline" size="sm" className="gap-1 text-red-600" disabled={busy === o.id} onClick={() => removeOrder(o)} data-testid={`sticker-delete-${o.id}`}>
                <Trash2 className="h-3.5 w-3.5" /> Hapus
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={!!detail} onOpenChange={(v) => !v && setDetail(null)}>
        <DialogContent className="max-w-lg" data-testid="sticker-detail-dialog">
          <DialogHeader>
            <DialogTitle>{detail?.order_code}</DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-2 text-sm">
              <Row label="Nama Pelanggan" value={`${detail.customer_name} - ${detail.customer_phone}`} />
              <Row label="Status" value={detail.status} />
              <Row label="Bahan" value={detail.material} />
              <Row
                label="Ukuran Sticker"
                value={
                  detail.layout?.height_cm
                    ? `${Number(detail.layout.width_cm || 0).toFixed(2)} × ${Number(detail.layout.height_cm).toFixed(2)} cm`
                    : `lebar ${Number(detail.layout?.width_cm || 0).toFixed(2)} cm (rasio asli)`
                }
              />
              <Row label="Template" value={detail.layout?.template} />
              <Row label="Jumlah" value={`${detail.layout?.per_sheet || 0} pcs/lembar · ${detail.sheets} lembar`} />
              <Row label="Harga / lembar" value={rp(detail.unit_price)} />
              <Row label="Total" value={rp(detail.total_price)} />
              {detail.note && <Row label="Catatan" value={detail.note} />}
              <div className="rounded-md border border-border bg-white p-2">
                {detail.preview ? (
                  <img src={detail.preview} alt="Preview lembar" className="mx-auto max-h-72 w-auto" data-testid="sticker-detail-preview" />
                ) : (
                  <p className="text-center text-xs text-muted-foreground">Preview kanvas tidak tersimpan.</p>
                )}
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" className="gap-1" onClick={() => copyContact(detail)} data-testid="sticker-copy-contact">
              <Copy className="h-4 w-4" /> Copy Nama + No HP
            </Button>
            <Button onClick={() => setDetail(null)} data-testid="sticker-detail-close">Tutup</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-semibold">{value || "-"}</span>
    </div>
  );
}
