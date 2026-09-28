import { useEffect, useState } from "react";
import api, { rupiah, formatApiError } from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, Loader2, Store, Truck, User, Package, Shirt } from "lucide-react";
import { toast } from "sonner";

const fmt = (iso) => (iso ? new Date(iso).toLocaleString("id-ID") : "—");

function Row({ label, value, testid }) {
  return (
    <div className="flex justify-between gap-3 py-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium break-words" data-testid={testid}>{value || "—"}</span>
    </div>
  );
}

function Section({ title, icon: Icon, children }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <p className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {title}
      </p>
      {children}
    </div>
  );
}

/**
 * Detail pesanan lintas kanal. Untuk pesanan marketplace ditambah info
 * pengiriman, status asli marketplace, dan bagian "Data Mentah" yang bisa
 * dibuka-tutup (untuk debugging, tidak ditonjolkan).
 */
export function OrderDetailDialog({ orderId, onClose }) {
  const [data, setData] = useState(null);
  const [rawOpen, setRawOpen] = useState(false);

  useEffect(() => {
    setData(null);
    setRawOpen(false);
    if (!orderId) return;
    api
      .get(`/orders/${orderId}`)
      .then((r) => setData(r.data))
      .catch((e) => toast.error(formatApiError(e.response?.data?.detail)));
  }, [orderId]);

  const o = data;
  const isShopee = o?.sales_channel === "shopee";

  return (
    <Dialog open={!!orderId} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto" data-testid="order-detail-dialog">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            {isShopee && (
              <span className="rounded bg-orange-500 px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">Shopee</span>
            )}
            Detail Pesanan {o?.order_number || ""}
          </DialogTitle>
        </DialogHeader>

        {!o && (
          <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Memuat detail...
          </div>
        )}

        {o && (
          <div className="space-y-3">
            <Section title="Informasi Pesanan" icon={Store}>
              <Row label="No. Pesanan Internal" value={o.order_number} testid="detail-order-number" />
              {o.external_order_id && (
                <Row label="ID Pesanan Marketplace" value={o.external_order_id} testid="detail-external-id" />
              )}
              <Row label="Kanal Penjualan" value={(o.sales_channel || "manual").toUpperCase()} testid="detail-channel" />
              <Row label="Tanggal Pesanan" value={fmt(o.order_date || o.created_at)} />
              <Row label="Status Internal" value={o.internal_status || o.status} testid="detail-internal-status" />
              {o.external_status && <Row label="Status Asli Marketplace" value={o.external_status} testid="detail-external-status" />}
              <Row label="Status Pembayaran" value={o.payment_status || (o.remaining > 0 ? "BELUM LUNAS" : "LUNAS")} />
              <Row label="Metode Pembayaran" value={o.payment_method} />
              {o.synced_at && <Row label="Terakhir Sinkron" value={fmt(o.synced_at)} />}
            </Section>

            <Section title="Pelanggan" icon={User}>
              <Row label="Nama" value={o.customer_name} />
              <Row label="Telepon" value={o.customer_phone} />
              <Row label="Alamat Kirim" value={o.shipping_address} />
              <Row label="Kota / Provinsi" value={[o.shipping_city, o.shipping_province].filter(Boolean).join(", ")} />
              <Row label="Kode Pos" value={o.shipping_postal} />
              {o.customer_note && <Row label="Catatan Pembeli" value={o.customer_note} />}
            </Section>

            <Section title="Produk" icon={Package}>
              <div className="space-y-2">
                {(o.items || []).map((it, i) => (
                  <div key={i} className="rounded-md bg-secondary/40 p-2 text-sm" data-testid={`detail-item-${i}`}>
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium">{it.name}</p>
                      <p className="shrink-0 font-semibold">{rupiah((Number(it.price) || 0) * (Number(it.qty) || 0))}</p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {it.sku ? `SKU ${it.sku} · ` : ""}{it.variation_name ? `${it.variation_name} · ` : ""}
                      {it.qty} × {rupiah(it.price)}
                      {Number(it.discount) > 0 ? ` · diskon ${rupiah(it.discount)}` : ""}
                    </p>
                    {it.mapping_status === "UNMAPPED" && (
                      <span className="mt-1 inline-block rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-600">
                        Produk belum dipetakan
                      </span>
                    )}
                    {it.is_custom && (
                      <span className="mt-1 ml-1 inline-block rounded-full bg-blue-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-blue-600">
                        Custom Tees
                      </span>
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-2 border-t border-border pt-2">
                <Row label="Subtotal" value={rupiah(o.subtotal)} />
                <Row label="Diskon" value={rupiah(o.discount)} />
                <Row label="Ongkir" value={rupiah(o.shipping_fee)} />
                <div className="flex justify-between pt-1 text-sm font-bold">
                  <span>Total</span>
                  <span data-testid="detail-total">{rupiah(o.total)}</span>
                </div>
              </div>
            </Section>

            {(o.shipping_carrier || o.tracking_number || o.shipping_status) && (
              <Section title="Pengiriman" icon={Truck}>
                <Row label="Kurir" value={o.shipping_carrier} testid="detail-carrier" />
                <Row label="No. Resi" value={o.tracking_number} testid="detail-tracking" />
                <Row label="Status Pengiriman" value={o.shipping_status} />
              </Section>
            )}

            {(o.custom_tee_orders || []).length > 0 && (
              <Section title="Pesanan Custom Tees Terkait" icon={Shirt}>
                {(o.custom_tee_orders || []).map((c) => (
                  <Row key={c.id} label={`${c.order_code} · ${c.product_title}`} value={`${c.qty} pcs · ${c.status}`} />
                ))}
                <p className="mt-1 text-xs text-muted-foreground">
                  Dikerjakan lewat menu Custom Tees → Pesanan Custom (alur produksi yang sudah ada).
                </p>
              </Section>
            )}

            {o.external_raw && (
              <div className="rounded-lg border border-border">
                <button
                  type="button"
                  onClick={() => setRawOpen((v) => !v)}
                  className="flex w-full items-center gap-2 p-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                  data-testid="raw-toggle"
                >
                  {rawOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  Data Mentah Marketplace (debug)
                </button>
                {rawOpen && (
                  <pre className="max-h-72 overflow-auto border-t border-border bg-secondary/40 p-3 text-[11px] leading-relaxed" data-testid="raw-json">
                    {JSON.stringify(o.external_raw, null, 2)}
                  </pre>
                )}
              </div>
            )}

            <div className="flex justify-end">
              <Button variant="outline" onClick={onClose} data-testid="detail-close">Tutup</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default OrderDetailDialog;
