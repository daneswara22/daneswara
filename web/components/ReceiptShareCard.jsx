import { forwardRef } from "react";
import { rupiah } from "@/lib/api";
import { canvasSafeUrl } from "@/lib/media";
import { paymentStatus } from "@/lib/printer";
import { INVOICE_CSS_IMAGE, IMAGE_PADDING_PX, buildInvoiceBody } from "@/lib/invoiceTemplate";

/**
 * Kartu offscreen untuk "Bagikan Nota/Penawaran sebagai Gambar".
 * Dipakai NotaDialog (nota) dan DraftPreviewDialog (penawaran/draft).
 *
 * Memakai TEMPLATE INVOICE YANG SAMA dengan print Desktop/PC
 * (lib/invoiceTemplate.js), jadi gambar hasil share identik dan proporsional
 * dengan hasil cetak A6 — berlaku di Desktop/PC maupun mobile/tablet.
 *
 * Print dari HP/tablet tidak lewat sini; jalur itu tetap memakai struk lama.
 *
 * Seluruh style ter-scope di dalam `.dnsw-inv`, sehingga <style> di bawah tidak
 * memengaruhi tampilan halaman aplikasi lainnya.
 */
export const ReceiptShareCard = forwardRef(function ReceiptShareCard({ data, settings = {} }, ref) {
  const o = data || {};
  const html = buildInvoiceBody(o, settings, {
    rp: rupiah,
    paymentStatus,
    logo: canvasSafeUrl(settings.logo) || "/logo.png",
  });

  return (
    <div style={{ position: "fixed", left: "-10000px", top: 0 }} aria-hidden="true">
      {/* Padding setara margin cetak A6 5mm. Semua ukuran dalam px (bukan mm/pt)
          supaya html2canvas tidak menggeser garis tabel & spacing. */}
      <div
        ref={ref}
        style={{ background: "#ffffff", padding: `${IMAGE_PADDING_PX}px`, display: "inline-block" }}
      >
        <style>{INVOICE_CSS_IMAGE}</style>
        <div dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    </div>
  );
});
