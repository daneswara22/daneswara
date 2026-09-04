import { useState, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, Send } from "lucide-react";
import { useLang } from "@/landing/i18n/LangContext";
import { SubPageBar } from "@/landing/components/SubPageBar";

const STUDIO_WA = "6285888102930";
const formatRp = (n) => "Rp " + Number(n).toLocaleString("id-ID");

export default function Order() {
  const [params] = useSearchParams();
  const { lang } = useLang();
  const isID = lang === "id";

  const shirt = params.get("shirt") || "-";
  const pkg = params.get("package") || "-";
  const unitPrice = Number(params.get("price")) || 0;

  const [qty, setQty] = useState(1);
  const [wa, setWa] = useState("");

  const total = useMemo(() => unitPrice * Math.max(1, Number(qty) || 0), [unitPrice, qty]);

  const sendWA = () => {
    const lines = [
      "*ORDER TYPE: DTF Digital Printing*",
      `- T-SHIRT MODEL = ${shirt}`,
      `- SELECTED PACKAGE = ${pkg}`,
      `- ORDER QUANTITY = ${qty}`,
      `- WHATSAPP NUMBER = ${wa || "-"}`,
      "",
      `Unit Price : ${formatRp(unitPrice)}`,
      `Total Estimate : ${formatRp(total)}`,
    ];
    const text = encodeURIComponent(lines.join("\n"));
    window.open(`https://wa.me/${STUDIO_WA}?text=${text}`, "_blank");
  };

  const labelCls = "block text-[11px] font-bold uppercase tracking-[0.2em] mb-1.5";
  const inputCls = "w-full bg-background border-2 border-foreground px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary";

  return (
    <div className="min-h-screen bg-background">
      <SubPageBar />
      <header className="border-b-2 border-foreground bg-card">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-10 py-8">
          <Link to="/price-list" className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground">
            <ArrowLeft size={14} /> {isID ? "Kembali ke daftar harga" : "Back to price list"}
          </Link>
          <div className="mt-4 text-xs uppercase tracking-[0.3em] text-primary font-bold">★ {isID ? "Ringkasan Pesanan" : "Order Summary"} ★</div>
          <h1 className="font-display mt-2 text-4xl sm:text-5xl uppercase tracking-wider leading-none">
            {isID ? "Konfirmasi Order" : "Confirm Your Order"}
          </h1>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-10 py-10">
        <div className="bg-card border-2 border-foreground shadow-stamp-lg p-6 sm:p-8">
          <div className="text-[10px] uppercase tracking-[0.3em] text-primary font-bold">ORDER TYPE</div>
          <div className="font-display text-2xl uppercase tracking-wider mt-1">DTF Digital Printing</div>
          <dl className="mt-6 space-y-3 text-sm">
            <div className="flex justify-between gap-4 border-b border-foreground/15 pb-2">
              <dt className="uppercase tracking-widest text-[11px] font-bold">T-Shirt Model</dt>
              <dd className="text-right">{shirt}</dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-foreground/15 pb-2">
              <dt className="uppercase tracking-widest text-[11px] font-bold">Selected Package</dt>
              <dd className="text-right">{pkg}</dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-foreground/15 pb-2">
              <dt className="uppercase tracking-widest text-[11px] font-bold">Unit Price</dt>
              <dd className="text-right font-bold">{formatRp(unitPrice)}</dd>
            </div>
          </dl>

          <div className="grid sm:grid-cols-2 gap-4 mt-6">
            <div>
              <label className={labelCls}>Order Quantity</label>
              <input type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>WhatsApp Number</label>
              <input type="tel" value={wa} onChange={(e) => setWa(e.target.value)} placeholder="+62 ..." className={inputCls} />
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between bg-foreground text-background border-2 border-foreground px-4 py-3">
            <span className="uppercase tracking-[0.2em] text-[11px] font-bold">{isID ? "Total" : "Total"}</span>
            <span className="font-display text-2xl text-primary">{formatRp(total)}</span>
          </div>

          <button
            onClick={sendWA}
            disabled={!wa.trim() || !qty}
            className="mt-6 inline-flex items-center justify-center gap-2 w-full bg-primary text-primary-foreground px-6 py-3.5 border-2 border-foreground shadow-stamp font-bold uppercase tracking-wider text-sm lift disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send size={16} /> {isID ? "Kirim ke WhatsApp" : "Send to WhatsApp"}
          </button>
          <p className="mt-3 text-xs text-muted-foreground text-center">
            {isID ? "Ringkasan akan dikirim langsung ke" : "The summary will be sent directly to"} <b>+62 858 8810 2930</b>
          </p>
        </div>
      </main>
    </div>
  );
}
