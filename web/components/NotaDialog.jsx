import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { rupiah } from "@/lib/api";
import { captureToBlob, shareOrDownload } from "@/lib/captureImage";
import { printReceiptSmart, paymentStatus, sendReceiptWhatsApp, copyReceiptText } from "@/lib/printer";
import { ReceiptShareCard } from "@/components/ReceiptShareCard";
import { toast } from "sonner";
import { MessageCircle, Copy, Printer, Image as ImageIcon } from "lucide-react";

// Reusable "Bagikan Nota sebagai Gambar" button + offscreen PNG card.
// Renders the shareable card offscreen and shares (mobile) or downloads (desktop).
export function ShareNotaImageButton({ nota, settings = {}, className = "w-full gap-2" }) {
  const [busy, setBusy] = useState(false);
  const cardRef = useRef(null);
  if (!nota) return null;

  const shareImage = async () => {
    if (!cardRef.current) return;
    setBusy(true);
    try {
      const blob = await captureToBlob(cardRef.current, { backgroundColor: "#15171c" });
      const fname = `nota-${nota.invoice || nota.order_number || "struk"}.png`;
      const res = await shareOrDownload(blob, fname, { title: "Nota Transaksi", text: `Nota ${nota.invoice || nota.order_number || ""}` });
      if (res === "downloaded") toast.success("Gambar nota diunduh — tinggal lampirkan di WhatsApp");
    } catch (e) {
      toast.error("Gagal membuat gambar nota. Coba lagi sebentar.");
    } finally { setBusy(false); }
  };

  return (
    <>
      <Button className={className} onClick={shareImage} disabled={busy} data-testid="nota-share-image-button">
        <ImageIcon className="h-4 w-4" /> {busy ? "Membuat gambar..." : "Bagikan Nota sebagai Gambar"}
      </Button>
      <ReceiptShareCard ref={cardRef} data={nota} settings={settings} />
    </>
  );
}

// Reusable nota/receipt dialog with Cetak / Kirim WA (teks) / Salin / Bagikan Gambar.
export function NotaDialog({ nota, onClose, settings = {} }) {
  const [phone, setPhone] = useState("");
  useEffect(() => { setPhone(nota?.customer_phone || ""); }, [nota]);

  const open = !!nota;
  const status = nota ? paymentStatus(nota) : "";
  const isDeposit = status === "DEPOSIT";

  const doPrint = async () => {
    try {
      const mode = await printReceiptSmart(nota, settings);
      if (mode === "bluetooth") toast.success("Nota dikirim ke printer Bluetooth");
    } catch (e) { toast.error(e.message || "Gagal mencetak nota"); }
  };
  const doWa = () => {
    const ok = sendReceiptWhatsApp(nota, settings, phone);
    if (!ok) toast.info("Nomor tujuan kosong — pilih kontak di WhatsApp");
  };
  const doCopy = async () => { await copyReceiptText(nota, settings); toast.success("Nota disalin — tinggal tempel di WhatsApp pelanggan"); };

  const items = nota?.items || [];

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { onClose(); setTimeout(() => { document.body.style.pointerEvents = ""; }, 100); } }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto" data-testid="nota-dialog">
        <DialogHeader><DialogTitle className="font-display">Nota Transaksi</DialogTitle></DialogHeader>
        {nota && (
          <div className="space-y-3">
            <div className={`rounded-md px-3 py-2 text-center text-sm font-bold ${isDeposit ? "bg-orange-500/15 text-orange-600" : "bg-emerald-500/15 text-emerald-600"}`} data-testid="nota-status">
              {status}
            </div>
            <div className="rounded-md bg-secondary/50 p-3 font-mono text-xs">
              <p className="text-center font-bold">{settings.business_name || "Daneswara POS"}</p>
              <p className="mt-1 text-center">{nota.invoice || nota.order_number}</p>
              <p className="text-center text-muted-foreground">{new Date(nota.created_at).toLocaleString("id-ID")}</p>
              {nota.customer_name && <p className="text-center">Nama: {nota.customer_name}</p>}
              <div className="my-2 border-t border-dashed border-border" />
              {items.map((i, idx) => (
                <div key={idx} className="mb-1">
                  <div className="flex justify-between"><span>{i.qty}x {i.name}</span><span>{rupiah(i.price * i.qty)}</span></div>
                  <div className="text-muted-foreground">{rupiah(i.price)} x {i.qty}{i.note ? ` • ${i.note}` : ""}</div>
                </div>
              ))}
              <div className="my-2 border-t border-dashed border-border" />
              <div className="flex justify-between"><span>Subtotal</span><span>{rupiah(nota.subtotal)}</span></div>
              {nota.discount ? <div className="flex justify-between"><span>Diskon</span><span>-{rupiah(nota.discount)}</span></div> : null}
              {nota.tax ? <div className="flex justify-between"><span>Pajak</span><span>{rupiah(nota.tax)}</span></div> : null}
              <div className="flex justify-between font-bold"><span>TOTAL</span><span>{rupiah(nota.total)}</span></div>
              {nota.deposit_amount != null ? (
                <>
                  <div className="flex justify-between"><span>Deposit (DP)</span><span>{rupiah(nota.deposit_amount)}</span></div>
                  <div className="flex justify-between"><span>{isDeposit ? "Sisa" : "Pelunasan"}</span><span>{rupiah(isDeposit ? nota.remaining : (nota.settle_paid ?? 0))}</span></div>
                </>
              ) : (
                <div className="flex justify-between"><span>Bayar ({nota.payment_method})</span><span>{rupiah(nota.paid_amount)}</span></div>
              )}
            </div>

            <div>
              <label className="text-xs text-muted-foreground">Nomor WhatsApp pelanggan</label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="cth: 08123456789" data-testid="nota-wa-phone-input" />
            </div>
            <ShareNotaImageButton nota={nota} settings={settings} />
            <Button className="w-full gap-2 bg-[#25D366] text-white hover:bg-[#1ebe5b]" onClick={doWa} data-testid="nota-whatsapp-button">
              <MessageCircle className="h-4 w-4" /> Kirim Teks via WhatsApp
            </Button>
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1 gap-2" onClick={doCopy} data-testid="nota-copy-button"><Copy className="h-4 w-4" /> Salin</Button>
              <Button variant="outline" className="flex-1 gap-2" onClick={doPrint} data-testid="nota-print-button"><Printer className="h-4 w-4" /> Cetak</Button>
              <Button className="flex-1" onClick={onClose} data-testid="nota-close-button">Tutup</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
