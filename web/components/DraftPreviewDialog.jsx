import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { rupiah } from "@/lib/api";
import { rp, normalizePhone, printReceiptSmart } from "@/lib/printer";
import { captureToBlob, shareOrDownload } from "@/lib/captureImage";
import { ReceiptShareCard } from "@/components/ReceiptShareCard";
import { toast } from "sonner";
import { MessageCircle, Copy, Image as ImageIcon, FileText, Printer } from "lucide-react";

// Plain-text quotation for WhatsApp / clipboard (distinct from paid receipt text).
export function buildDraftText(o, settings = {}) {
  const L = [];
  L.push("*PENAWARAN / DRAFT PESANAN*");
  L.push(`*${settings.business_name || "Daneswara POS"}*`);
  if (settings.address) L.push(settings.address);
  if (settings.phone) L.push(`Telp: ${settings.phone}`);
  L.push("--------------------------------");
  L.push(`No    : ${o.order_number || "-"}`);
  L.push(`Tgl   : ${new Date(o.created_at).toLocaleString("id-ID")}`);
  if (o.customer_name) L.push(`Nama  : ${o.customer_name}`);
  if (o.order_type) L.push(`Jenis : ${o.order_type}`);
  L.push("--------------------------------");
  (o.items || []).forEach((i) => {
    L.push(`${i.qty} x ${i.name}`);
    L.push(`     ${i.qty} x ${rp(i.price)}  =  ${rp(i.price * i.qty)}`);
    if (i.note) L.push(`     * ${i.note}`);
  });
  L.push("--------------------------------");
  L.push(`Subtotal : ${rp(o.subtotal)}`);
  if (o.discount) L.push(`Diskon   : -${rp(o.discount)}`);
  if (o.tax) L.push(`Pajak    : ${rp(o.tax)}`);
  L.push(`*TOTAL   : ${rp(o.total)}*`);
  L.push("--------------------------------");
  L.push("⚠️ Pesanan ini *BELUM DIBAYAR*.");
  L.push("Mohon konfirmasi untuk kami proses. Terima kasih 🙏");
  return L.join("\n");
}

// Preview/quotation dialog for DRAFT (unpaid) orders — deliberately styled
// differently from the paid NotaDialog (amber quotation vs blue receipt).
export function DraftPreviewDialog({ order, onClose, settings = {} }) {
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const cardRef = useRef(null);
  useEffect(() => { setPhone(order?.customer_phone || ""); }, [order]);

  const open = !!order;
  const items = order?.items || [];

  const doWa = () => {
    const text = buildDraftText(order, settings);
    const d = normalizePhone(phone);
    const url = d ? `https://wa.me/${d}?text=${encodeURIComponent(text)}` : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
    if (!d) toast.info("Nomor kosong — pilih kontak di WhatsApp");
  };
  const doCopy = async () => {
    const text = buildDraftText(order, settings);
    try { await navigator.clipboard.writeText(text); }
    catch {
      const ta = document.createElement("textarea"); ta.value = text;
      document.body.appendChild(ta); ta.select(); document.execCommand("copy"); document.body.removeChild(ta);
    }
    toast.success("Draft pesanan disalin — tinggal tempel di WhatsApp");
  };
  const shareImage = async () => {
    if (!cardRef.current) return;
    setBusy(true);
    try {
      const blob = await captureToBlob(cardRef.current, { backgroundColor: "#15171c" });
      const fname = `penawaran-${order.order_number || "draft"}.png`;
      const res = await shareOrDownload(blob, fname, { title: "Penawaran Pesanan", text: `Penawaran ${order.order_number || ""}` });
      if (res === "downloaded") toast.success("Gambar penawaran diunduh — tinggal lampirkan di WhatsApp");
    } catch (e) { toast.error("Gagal membuat gambar penawaran. Coba lagi sebentar."); }
    finally { setBusy(false); }
  };
  const doPrint = async () => {
    try {
      const mode = await printReceiptSmart({ ...order, __draft: true }, settings);
      if (mode === "bluetooth") toast.success("Penawaran dikirim ke printer Bluetooth");
    } catch (e) { toast.error(e.message || "Gagal mencetak penawaran"); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { onClose(); setTimeout(() => { document.body.style.pointerEvents = ""; }, 100); } }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto" data-testid="draft-preview-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <FileText className="h-5 w-5 text-amber-500" /> Preview Penawaran
          </DialogTitle>
        </DialogHeader>
        {order && (
          <div className="space-y-3">
            <div className="rounded-md border border-dashed border-amber-500/60 bg-amber-500/10 px-3 py-2 text-center text-sm font-bold uppercase tracking-wide text-amber-600" data-testid="draft-status-badge">
              Draft — Belum Bayar
            </div>
            <div className="rounded-md bg-secondary/50 p-3 font-mono text-xs">
              <p className="text-center font-bold">{settings.business_name || "Daneswara POS"}</p>
              <p className="mt-1 text-center">{order.order_number}</p>
              <p className="text-center text-muted-foreground">{new Date(order.created_at).toLocaleString("id-ID")}</p>
              {order.customer_name && <p className="text-center">Nama: {order.customer_name}</p>}
              {order.order_type && <p className="text-center">Jenis: {order.order_type}</p>}
              <div className="my-2 border-t border-dashed border-border" />
              {items.map((i, idx) => (
                <div key={idx}>
                  <div className="flex justify-between"><span>{i.qty}x {i.name}</span><span>{rupiah(i.price * i.qty)}</span></div>
                  {i.note && <p className="pl-2 italic text-muted-foreground">* {i.note}</p>}
                </div>
              ))}
              <div className="my-2 border-t border-dashed border-border" />
              <div className="flex justify-between"><span>Subtotal</span><span>{rupiah(order.subtotal)}</span></div>
              {order.discount ? <div className="flex justify-between"><span>Diskon</span><span>-{rupiah(order.discount)}</span></div> : null}
              {order.tax ? <div className="flex justify-between"><span>Pajak</span><span>{rupiah(order.tax)}</span></div> : null}
              <div className="flex justify-between font-bold"><span>TOTAL</span><span>{rupiah(order.total)}</span></div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground">Nomor WhatsApp pelanggan</label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="cth: 08123456789" data-testid="draft-wa-phone-input" />
            </div>
            <Button className="w-full gap-2 bg-amber-500 text-white hover:bg-amber-600" onClick={shareImage} disabled={busy} data-testid="draft-share-image-button">
              <ImageIcon className="h-4 w-4" /> {busy ? "Membuat gambar..." : "Bagikan Penawaran sebagai Gambar"}
            </Button>
            <Button className="w-full gap-2 bg-[#25D366] text-white hover:bg-[#1ebe5b]" onClick={doWa} data-testid="draft-whatsapp-button">
              <MessageCircle className="h-4 w-4" /> Kirim Penawaran via WhatsApp
            </Button>
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1 gap-2" onClick={doCopy} data-testid="draft-copy-button"><Copy className="h-4 w-4" /> Salin Pesanan</Button>
              <Button variant="outline" className="flex-1 gap-2" onClick={doPrint} data-testid="draft-print-button"><Printer className="h-4 w-4" /> Cetak</Button>
              <Button className="flex-1" onClick={onClose} data-testid="draft-close-button">Tutup</Button>
            </div>
          </div>
        )}

        {/* Offscreen share card — same BRImo-style format as paid receipt; only keterangan & jenis pembayaran differ. */}
        {order && <ReceiptShareCard ref={cardRef} data={{ ...order, __draft: true }} settings={settings} />}
      </DialogContent>
    </Dialog>
  );
}
