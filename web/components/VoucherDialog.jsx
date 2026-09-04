import { useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { rupiah } from "@/lib/api";
import { terbilang } from "@/lib/terbilang";
import { captureToBlob, shareOrDownload } from "@/lib/captureImage";
import { VoucherShareCard } from "@/components/VoucherShareCard";
import { toast } from "sonner";
import { Printer, Image as ImageIcon } from "lucide-react";

// Dialog to Cetak (A4) atau Buat Gambar untuk SATU transaksi pengeluaran / pendapatan lain.
export function VoucherDialog({ trx, kind = "expense", settings = {}, onClose }) {
  const open = !!trx;
  const [busy, setBusy] = useState(false);
  const cardRef = useRef(null);
  const isExpense = kind === "expense";

  const shareImage = async () => {
    if (!cardRef.current) return;
    setBusy(true);
    try {
      const fname = `${isExpense ? "bukti-pengeluaran" : "bukti-pendapatan"}-${String(trx.id || "").slice(0, 8)}.png`;
      const blob = await captureToBlob(cardRef.current, { backgroundColor: "#15171c" });
      const res = await shareOrDownload(blob, fname, { title: isExpense ? "Bukti Pengeluaran" : "Bukti Pendapatan" });
      if (res === "downloaded") toast.success("Gambar bukti diunduh");
    } catch (e) {
      toast.error("Gagal membuat gambar bukti. Coba lagi sebentar.");
    } finally { setBusy(false); }
  };

  const printA4 = () => {
    const biz = settings.business_name || "Daneswara POS";
    const logo = settings.logo || "/logo.png";
    const ref_no = (isExpense ? "BKK" : "BKM") + "-" + String(trx.id || "").slice(0, 8).toUpperCase();
    const title = isExpense ? "BUKTI KAS KELUAR" : "BUKTI KAS MASUK";
    const amtLabel = isExpense ? "Jumlah Dikeluarkan" : "Jumlah Diterima";
    const esc = (s) => String(s || "").replace(/</g, "&lt;");
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
      <style>
        *{font-family:Arial,Helvetica,sans-serif;box-sizing:border-box}
        body{margin:0;color:#15171c}
        .page{width:210mm;min-height:148mm;padding:18mm 20mm}
        .head{display:flex;align-items:center;gap:16px;border-bottom:3px solid #15171c;padding-bottom:14px}
        .head img{width:64px;height:64px;object-fit:contain}
        .head .biz{font-size:22px;font-weight:800;margin:0}
        .head .addr{font-size:12px;color:#555;margin:3px 0 0}
        .title{text-align:center;font-size:20px;font-weight:800;letter-spacing:3px;margin:26px 0 4px}
        .refno{text-align:center;font-size:13px;color:#a9791b;font-weight:700;margin-bottom:22px}
        table.fields{width:100%;border-collapse:collapse;font-size:14px;margin-bottom:20px}
        table.fields td{padding:9px 4px;vertical-align:top}
        table.fields td.k{width:180px;color:#555}
        table.fields td.s{width:14px}
        .amount-box{border:2px solid #15171c;border-radius:10px;padding:16px 20px;margin:8px 0 6px}
        .amount-box .lbl{font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#555}
        .amount-box .val{font-size:30px;font-weight:800;margin-top:4px;color:${isExpense ? "#b91c1c" : "#059669"}}
        .amount-box .tb{font-size:13px;font-style:italic;margin-top:8px}
        .sign{display:flex;justify-content:space-between;margin-top:48px;font-size:13px}
        .sign .col{width:40%;text-align:center}
        .sign .line{margin-top:64px;border-top:1px solid #333;padding-top:6px}
        @media print{.page{padding:14mm 18mm}}
      </style></head><body>
      <div class="page">
        <div class="head">
          <img src="${logo}" onerror="this.style.display='none'"/>
          <div><p class="biz">${esc(biz)}</p>${settings.address ? `<p class="addr">${esc(settings.address)}</p>` : ""}${settings.phone ? `<p class="addr">Telp: ${esc(settings.phone)}</p>` : ""}</div>
        </div>
        <div class="title">${title}</div>
        <div class="refno">No. ${ref_no}</div>
        <table class="fields">
          <tr><td class="k">Tanggal</td><td class="s">:</td><td>${esc(trx.date)}</td></tr>
          <tr><td class="k">${isExpense ? "Jenis Pengeluaran" : "Kategori Pendapatan"}</td><td class="s">:</td><td>${esc(trx.category)}</td></tr>
          <tr><td class="k">Keterangan</td><td class="s">:</td><td>${esc(trx.note) || "-"}</td></tr>
          ${trx.created_by ? `<tr><td class="k">Dicatat oleh</td><td class="s">:</td><td>${esc(trx.created_by)}</td></tr>` : ""}
        </table>
        <div class="amount-box">
          <div class="lbl">${amtLabel}</div>
          <div class="val">${isExpense ? "-" : "+"}${rupiah(trx.amount)}</div>
          <div class="tb">Terbilang: <b>${terbilang(trx.amount)}</b></div>
        </div>
        <div class="sign">
          <div class="col">Dibuat oleh,<div class="line">( ${esc(trx.created_by) || "..............................."} )</div></div>
          <div class="col">${isExpense ? "Disetujui oleh," : "Diterima oleh,"}<div class="line">( ............................... )</div></div>
        </div>
      </div>
      <script>window.onload=function(){setTimeout(function(){window.print();},300);}</script>
      </body></html>`;
    const w = window.open("", "_blank");
    if (!w) return toast.error("Popup diblokir browser. Izinkan popup untuk mencetak.");
    w.document.open(); w.document.write(html); w.document.close();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { onClose(); setTimeout(() => { document.body.style.pointerEvents = ""; }, 100); } }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto" data-testid="voucher-dialog">
        <DialogHeader><DialogTitle className="font-display">{isExpense ? "Bukti Pengeluaran" : "Bukti Pendapatan"}</DialogTitle></DialogHeader>
        {trx && (
          <div className="space-y-3">
            <div className="rounded-md bg-secondary/50 p-4 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Tanggal</span><span className="font-medium">{trx.date}</span></div>
              <div className="mt-1 flex justify-between"><span className="text-muted-foreground">{isExpense ? "Jenis" : "Kategori"}</span><span className="font-medium">{trx.category}</span></div>
              {trx.note && <div className="mt-1 flex justify-between gap-4"><span className="text-muted-foreground">Keterangan</span><span className="text-right font-medium">{trx.note}</span></div>}
              <div className="my-2 border-t border-dashed border-border" />
              <div className="flex items-baseline justify-between">
                <span className="text-muted-foreground">{isExpense ? "Jumlah Dikeluarkan" : "Jumlah Diterima"}</span>
                <span className={`font-display text-xl font-bold ${isExpense ? "text-destructive" : "text-emerald-600"}`}>{isExpense ? "-" : "+"}{rupiah(trx.amount)}</span>
              </div>
              <p className="mt-1 text-xs italic text-muted-foreground">Terbilang: {terbilang(trx.amount)}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 gap-2" onClick={printA4} data-testid="voucher-print-button"><Printer className="h-4 w-4" /> Cetak (A4)</Button>
              <Button className="flex-1 gap-2" onClick={shareImage} disabled={busy} data-testid="voucher-image-button"><ImageIcon className="h-4 w-4" /> {busy ? "Membuat..." : "Buat Gambar"}</Button>
            </div>
            <Button variant="secondary" className="w-full" onClick={onClose} data-testid="voucher-close-button">Tutup</Button>
          </div>
        )}
        <VoucherShareCard ref={cardRef} data={trx} kind={kind} settings={settings} />
      </DialogContent>
    </Dialog>
  );
}
