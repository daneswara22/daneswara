import { forwardRef } from "react";
import { rupiah } from "@/lib/api";
import { terbilang } from "@/lib/terbilang";

// Offscreen voucher card for a SINGLE expense / other-income transaction.
// Same width/paper as the sales receipt (460px) but a distinct "bukti kas" layout.
// Theme: charcoal + gold to match the brand logo.
const BG = "#15171c";
const GOLD = "#a9791b";
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

export const VoucherShareCard = forwardRef(function VoucherShareCard({ data, kind = "expense", settings = {} }, ref) {
  const o = data || {};
  const isExpense = kind === "expense";
  const heading = isExpense ? "Bukti Kas Keluar" : "Bukti Kas Masuk";
  const amountColor = isExpense ? "#b91c1c" : "#059669";
  const sign = isExpense ? "-" : "+";
  const ref_no = (isExpense ? "BKK" : "BKM") + "-" + String(o.id || "").slice(0, 8).toUpperCase();
  const bumps = Array.from({ length: 22 });

  return (
    <div style={{ position: "fixed", left: "-10000px", top: 0 }} aria-hidden="true">
      <div ref={ref} style={{ width: "460px", background: BG, padding: "30px 22px 26px", fontFamily: "Arial, Helvetica, sans-serif" }}>
        <div style={{ display: "flex", justifyContent: "center", overflow: "hidden", height: "10px" }}>
          {bumps.map((_, i) => (
            <div key={i} style={{ width: "18px", height: "10px", background: "#ffffff", borderTopLeftRadius: "9px", borderTopRightRadius: "9px", marginLeft: i ? "1px" : 0 }} />
          ))}
        </div>

        <div style={{ position: "relative", background: "#ffffff", borderBottomLeftRadius: "16px", borderBottomRightRadius: "16px", padding: "22px 26px 26px" }}>
          {/* header */}
          <div style={{ textAlign: "center" }}>
            <img src={settings.logo || "/logo.png"} alt="" crossOrigin="anonymous" style={{ maxWidth: "120px", maxHeight: "46px", objectFit: "contain", margin: "0 auto 6px" }} />
            <div style={{ fontSize: "16px", fontWeight: 800, color: DARK, letterSpacing: "0.2px" }}>{settings.business_name || "Daneswara POS"}</div>
            {settings.address ? <div style={{ fontSize: "11px", color: GRAY, marginTop: "2px" }}>{settings.address}</div> : null}
            <div style={{ fontSize: "18px", fontWeight: 800, color: DARK, marginTop: "12px", textTransform: "uppercase", letterSpacing: "1px" }}>{heading}</div>
            <div style={{ width: "48px", height: "3px", background: GOLD, borderRadius: "2px", margin: "12px auto 0" }} />
          </div>

          <div style={{ borderTop: "1px solid #eef1f5", margin: "16px 0 4px" }} />

          <Row label="No. Bukti" value={ref_no} />
          <Row label="Tanggal" value={o.date || "-"} />
          <Row label={isExpense ? "Jenis Pengeluaran" : "Kategori Pendapatan"} value={o.category || "-"} />
          {o.note ? <Row label="Keterangan" value={o.note} /> : null}
          {o.created_by ? <Row label="Dicatat oleh" value={o.created_by} /> : null}

          <div style={{ borderTop: "1px solid #eef1f5", margin: "10px 0 4px" }} />

          {/* amount block */}
          <div style={{ background: "#f7f8fa", borderRadius: "12px", padding: "14px 16px", margin: "12px 0 4px" }}>
            <div style={{ fontSize: "11.5px", fontWeight: 700, color: GRAY, letterSpacing: "0.6px", textTransform: "uppercase" }}>{isExpense ? "Jumlah Dikeluarkan" : "Jumlah Diterima"}</div>
            <div style={{ color: amountColor, fontSize: "26px", fontWeight: 800, marginTop: "4px" }}>{sign}{rupiah(o.amount)}</div>
            <div style={{ color: DARK, fontSize: "11.5px", fontStyle: "italic", marginTop: "6px" }}>Terbilang: {terbilang(o.amount)}</div>
          </div>

          <div style={{ borderTop: "1px solid #eef1f5", margin: "16px 0 12px" }} />
          <div style={{ textAlign: "center", fontSize: "10.5px", color: GRAY, lineHeight: 1.5 }}>
            Dokumen ini adalah bukti transaksi kas yang sah.
            <br />
            {settings.business_name || "Daneswara POS"}{settings.phone ? ` • ${settings.phone}` : ""}
          </div>
        </div>
      </div>
    </div>
  );
});
