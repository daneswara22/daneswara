import { forwardRef } from "react";
import { rupiah } from "@/lib/api";

// Offscreen receipt card, shared by the paid receipt (NotaDialog) and the unpaid
// draft (DraftPreviewDialog). Theme: charcoal + gold to match the brand logo.
// The ONLY differences between paid vs draft are the heading ("keterangan") and
// the payment type — plus a "LUNAS" stamp on paid transactions.
const BG = "#15171c";      // charcoal backdrop (matches dark/gold logo)
const GOLD = "#a9791b";    // deep gold accent (readable on white)
const DARK = "#1f2430";
const GRAY = "#8a92a3";

function Row({ label, value, strong }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px", margin: "9px 0" }}>
      <span style={{ color: GRAY, fontSize: "12.5px", whiteSpace: "nowrap" }}>{label}</span>
      <span style={{ color: DARK, fontSize: "12.5px", fontWeight: strong ? 700 : 600, textAlign: "right" }}>{value}</span>
    </div>
  );
}

export const ReceiptShareCard = forwardRef(function ReceiptShareCard({ data, settings = {} }, ref) {
  const o = data || {};
  const isDraft = o.__draft === true || o.status === "Draft";
  const isPendingDeposit = !isDraft && o.deposit_amount != null && o.status && o.status !== "Selesai";

  const heading = isDraft ? "Menunggu Pembayaran" : isPendingDeposit ? "Uang Muka (DP) Diterima" : "Transaksi Berhasil";
  const payType = isDraft ? "Belum Dibayar" : isPendingDeposit ? (o.deposit_method || "-") : (o.payment_method || "-");
  const isPaid = !isDraft && !isPendingDeposit;
  const items = o.items || [];
  const bumps = Array.from({ length: 22 });

  return (
    <div style={{ position: "fixed", left: "-10000px", top: 0 }} aria-hidden="true">
      <div ref={ref} style={{ width: "460px", background: BG, padding: "30px 22px 26px", fontFamily: "Arial, Helvetica, sans-serif" }}>
        {/* scalloped top */}
        <div style={{ display: "flex", justifyContent: "center", overflow: "hidden", height: "10px" }}>
          {bumps.map((_, i) => (
            <div key={i} style={{ width: "18px", height: "10px", background: "#ffffff", borderTopLeftRadius: "9px", borderTopRightRadius: "9px", marginLeft: i ? "1px" : 0 }} />
          ))}
        </div>

        <div style={{ position: "relative", background: "#ffffff", borderBottomLeftRadius: "16px", borderBottomRightRadius: "16px", padding: "22px 26px 26px" }}>
          {/* LUNAS watermark stamp — shown for any paid transaction */}
          {isPaid && (
            <div style={{ position: "absolute", top: "52%", left: "50%", transform: "translate(-50%,-50%) rotate(-16deg)", pointerEvents: "none", zIndex: 5 }}>
              <div style={{ border: "6px solid rgba(21,128,61,0.16)", color: "rgba(21,128,61,0.16)", borderRadius: "16px", padding: "6px 26px", fontSize: "58px", fontWeight: 900, letterSpacing: "6px" }}>LUNAS</div>
            </div>
          )}
          {/* header */}
          <div style={{ position: "relative", zIndex: 1, textAlign: "center" }}>
            <img src={settings.logo || "/logo.png"} alt="" crossOrigin="anonymous" style={{ maxWidth: "120px", maxHeight: "46px", objectFit: "contain", margin: "0 auto 6px" }} />
            <div style={{ fontSize: "16px", fontWeight: 800, color: DARK, letterSpacing: "0.2px" }}>{settings.business_name || "Daneswara POS"}</div>
            <div style={{ fontSize: "18px", fontWeight: 800, color: DARK, marginTop: "10px" }}>{heading}</div>
            <div style={{ width: "48px", height: "3px", background: GOLD, borderRadius: "2px", margin: "12px auto 0" }} />
          </div>

          <div style={{ borderTop: "1px solid #eef1f5", margin: "16px 0 4px" }} />

          {/* meta */}
          <Row label="Tanggal" value={new Date(o.created_at).toLocaleString("id-ID")} />
          <Row label="Nomor Referensi" value={o.invoice || o.order_number || "-"} />

          <div style={{ borderTop: "1px solid #eef1f5", margin: "8px 0 4px" }} />

          {/* details */}
          <Row label="Nama Pelanggan" value={o.customer_name || "Umum"} />
          {o.cashier ? <Row label="Kasir" value={o.cashier} /> : null}
          <Row label="Jenis Pembayaran" value={payType} />
          {o.order_type ? <Row label="Jenis Pesanan" value={o.order_type} /> : null}
          {o.note ? <Row label="Catatan" value={o.note} /> : null}

          <div style={{ borderTop: "1px solid #eef1f5", margin: "8px 0 4px" }} />

          {/* items */}
          <div style={{ margin: "10px 0 4px", fontSize: "11.5px", fontWeight: 700, color: GRAY, letterSpacing: "0.6px", textTransform: "uppercase" }}>Rincian Pesanan</div>
          {items.map((i, idx) => (
            <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px", margin: "7px 0" }}>
              <div style={{ maxWidth: "270px" }}>
                <div style={{ color: DARK, fontSize: "12.5px", fontWeight: 600 }}>{i.name}</div>
                <div style={{ color: GRAY, fontSize: "11px" }}>{i.qty} x {rupiah(i.price)}{i.note ? ` • ${i.note}` : ""}</div>
              </div>
              <div style={{ color: DARK, fontSize: "12.5px", fontWeight: 700, whiteSpace: "nowrap" }}>{rupiah(i.price * i.qty)}</div>
            </div>
          ))}

          <div style={{ borderTop: "1px solid #eef1f5", margin: "10px 0 4px" }} />

          {/* amounts */}
          <Row label="Subtotal" value={rupiah(o.subtotal)} />
          {o.discount ? <Row label="Diskon" value={`-${rupiah(o.discount)}`} /> : null}
          {o.tax ? <Row label={`Pajak${o.tax_rate ? ` (${o.tax_rate}%)` : ""}`} value={rupiah(o.tax)} /> : null}
          {isDraft ? null : o.deposit_amount != null ? (
            <>
              <Row label="Deposit (DP)" value={rupiah(o.deposit_amount)} />
              <Row label={isPendingDeposit ? "Sisa Tagihan" : "Pelunasan"} value={rupiah(isPendingDeposit ? o.remaining : (o.settle_paid ?? 0))} />
            </>
          ) : (
            <>
              <Row label={`Bayar (${o.payment_method || "-"})`} value={rupiah(o.paid_amount)} />
              {o.change ? <Row label="Kembalian" value={rupiah(o.change)} /> : null}
            </>
          )}

          <div style={{ borderTop: "2px solid #e3e8ef", margin: "12px 0 8px" }} />

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: DARK, fontSize: "16px", fontWeight: 800 }}>Total</span>
            <span style={{ color: GOLD, fontSize: "22px", fontWeight: 800 }}>{rupiah(o.total)}</span>
          </div>

          <div style={{ borderTop: "1px solid #eef1f5", margin: "16px 0 12px" }} />
          <div style={{ textAlign: "center", fontSize: "10.5px", color: GRAY, lineHeight: 1.5 }}>
            {settings.receipt_footer || "Terima kasih telah berbelanja!"}
            <br />
            {settings.business_name || "Daneswara POS"}{settings.phone ? ` • ${settings.phone}` : ""}
          </div>
        </div>
      </div>
    </div>
  );
});
