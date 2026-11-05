import { forwardRef } from "react";
import { rupiah } from "@/lib/api";
import { canvasSafeUrl } from "@/lib/media";
import { terbilang } from "@/lib/terbilang";

/**
 * Kartu offscreen untuk "Buat Gambar" pada bukti pengeluaran / pendapatan lain.
 *
 * Desainnya SENGAJA dibuat sama dengan hasil Cetak A5 (VoucherDialog.printA5):
 * header logo + nama toko, garis tebal, judul "BUKTI KAS KELUAR", nomor bukti
 * emas, tabel field bertitik dua, kotak nominal bergaris, dan dua kolom tanda
 * tangan. Jadi gambar dan cetakan terlihat identik.
 *
 * Nominal tanpa tanda minus/plus; warna tetap merah untuk pengeluaran dan
 * hijau untuk pendapatan.
 */
const DARK = "#15171c";
const GOLD = "#a9791b";
const GRAY = "#555555";

function Field({ label, value }) {
  return (
    <tr>
      <td style={{ width: "150px", color: GRAY, padding: "8px 4px", verticalAlign: "top", fontSize: "13px" }}>{label}</td>
      <td style={{ width: "12px", padding: "8px 4px", verticalAlign: "top", fontSize: "13px" }}>:</td>
      <td style={{ padding: "8px 4px", verticalAlign: "top", fontSize: "13px", color: DARK }}>{value}</td>
    </tr>
  );
}

export const VoucherShareCard = forwardRef(function VoucherShareCard({ data, kind = "expense", settings = {} }, ref) {
  const o = data || {};
  const isExpense = kind === "expense";
  const title = isExpense ? "BUKTI KAS KELUAR" : "BUKTI KAS MASUK";
  const amtLabel = isExpense ? "JUMLAH DIKELUARKAN" : "JUMLAH DITERIMA";
  const amountColor = isExpense ? "#b91c1c" : "#059669";
  const refNo = (isExpense ? "BKK" : "BKM") + "-" + String(o.id || "").slice(0, 8).toUpperCase();
  const amount = Number(o.amount) || 0;
  const biz = settings.business_name || "Daneswara POS";
  const logo = canvasSafeUrl(settings.logo) || "/logo.png";

  return (
    <div style={{ position: "fixed", left: "-10000px", top: 0 }} aria-hidden="true">
      <div
        ref={ref}
        style={{
          width: "560px",
          background: "#ffffff",
          padding: "34px 34px 30px",
          fontFamily: "Arial, Helvetica, sans-serif",
          color: DARK,
          boxSizing: "border-box",
        }}
      >
        {/* Header: logo kiri, nama + alamat + telepon */}
        <div style={{ display: "flex", alignItems: "center", gap: "14px", borderBottom: `3px solid ${DARK}`, paddingBottom: "12px" }}>
          <img src={logo} alt="" crossOrigin="anonymous" style={{ width: "56px", height: "56px", objectFit: "contain" }} />
          <div>
            <div style={{ fontSize: "19px", fontWeight: 800, margin: 0, lineHeight: 1.2 }}>{biz}</div>
            {settings.address ? <div style={{ fontSize: "11px", color: GRAY, marginTop: "3px" }}>{settings.address}</div> : null}
            {settings.phone ? <div style={{ fontSize: "11px", color: GRAY, marginTop: "1px" }}>Telp: {settings.phone}</div> : null}
          </div>
        </div>

        {/* Judul + nomor bukti */}
        <div style={{ textAlign: "center", fontSize: "18px", fontWeight: 800, letterSpacing: "3px", margin: "22px 0 4px" }}>{title}</div>
        <div style={{ textAlign: "center", fontSize: "12px", color: GOLD, fontWeight: 700, marginBottom: "18px" }}>No. {refNo}</div>

        {/* Field */}
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "18px" }}>
          <tbody>
            <Field label="Tanggal" value={o.date || "-"} />
            <Field label={isExpense ? "Jenis Pengeluaran" : "Kategori Pendapatan"} value={o.category || "-"} />
            <Field label="Keterangan" value={o.note || "-"} />
            {o.created_by ? <Field label="Dicatat oleh" value={o.created_by} /> : null}
          </tbody>
        </table>

        {/* Kotak nominal */}
        <div style={{ border: `2px solid ${DARK}`, borderRadius: "10px", padding: "14px 18px", margin: "8px 0 6px" }}>
          <div style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "1px", color: GRAY }}>{amtLabel}</div>
          <div style={{ fontSize: "27px", fontWeight: 800, marginTop: "4px", color: amountColor }}>{rupiah(amount)}</div>
          <div style={{ fontSize: "12px", fontStyle: "italic", marginTop: "8px" }}>
            Terbilang: <b>{terbilang(amount)}</b>
          </div>
        </div>

        {/* Tanda tangan */}
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "40px", fontSize: "12px" }}>
          <div style={{ width: "40%", textAlign: "center" }}>
            Dibuat oleh,
            <div style={{ marginTop: "56px", borderTop: "1px solid #333", paddingTop: "6px" }}>
              ( {o.created_by || "..............................."} )
            </div>
          </div>
          <div style={{ width: "40%", textAlign: "center" }}>
            {isExpense ? "Disetujui oleh," : "Diterima oleh,"}
            <div style={{ marginTop: "56px", borderTop: "1px solid #333", paddingTop: "6px" }}>
              ( ............................... )
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});