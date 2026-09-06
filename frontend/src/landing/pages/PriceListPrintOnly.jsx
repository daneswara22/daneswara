import { Link } from "react-router-dom";
import { ArrowLeft, Printer } from "lucide-react";
import { useLang } from "@/landing/i18n/LangContext";
import { SubPageBar } from "@/landing/components/SubPageBar";

const PRINTS = [
  { id: "a3", label: "A3", base: 30000 },
  { id: "a4", label: "A4", base: 25000 },
  { id: "a5", label: "A5", base: 15000 },
  { id: "logo", label: "Logo", base: 10000 },
];
const ADD_ON = 5000;

const formatRp = (n) => "Rp " + n.toLocaleString("id-ID");

export default function PriceListPrintOnly() {
  const { lang } = useLang();
  const isID = lang === "id";

  return (
    <div className="min-h-screen bg-background">
      <SubPageBar />
      <header className="border-b-2 border-foreground bg-card">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10 py-8">
          <Link
            to="/"
            data-testid="back-home"
            className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft size={14} /> {isID ? "Kembali" : "Back"}
          </Link>
          <div className="mt-4 text-xs uppercase tracking-[0.3em] text-primary font-bold">
            ★ {isID ? "Daftar Harga" : "Price List"} ★
          </div>
          <h1 className="font-display mt-2 text-4xl sm:text-5xl lg:text-6xl uppercase tracking-wider leading-none">
            {isID ? "Sablon Saja" : "Screen Print Only"}
          </h1>
          <p className="mt-3 max-w-2xl text-base sm:text-lg text-muted-foreground">
            {isID
              ? "Customer bawa kaos sendiri. Setiap ukuran sablon ditambah Rp 5.000."
              : "Customer brings their own t-shirt. Each print size has a Rp 5,000 surcharge."}
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10 py-12 sm:py-16 space-y-12">
        <section>
          <div className="flex items-center gap-3">
            <Printer size={22} />
            <h2 className="font-display text-2xl sm:text-3xl uppercase tracking-wider">
              {isID ? "Harga per Ukuran" : "Pricing by Size"}
            </h2>
          </div>

          <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
            {PRINTS.map((p) => {
              const mockup = { a3: "/assets/mockups/a3.webp", a4: "/assets/mockups/a4.webp", a5: "/assets/mockups/a5.webp", logo: "/assets/mockups/logo-front.webp" }[p.id];
              const params = new URLSearchParams({
                shirt: isID ? "Sablon Saja (bawa kaos sendiri)" : "Screen Print Only (BYO shirt)",
                shirtId: "byo", package: p.label, packageId: `only-${p.id}`, price: String(p.base + ADD_ON),
              });
              return (
                <div key={p.id} data-testid={`only-${p.id}`} className="bg-card border-2 border-foreground shadow-stamp flex flex-col">
                  <div className="aspect-square bg-[#F4F1EA] border-b-2 border-foreground overflow-hidden">
                    <img src={mockup} alt={p.label} loading="lazy" className="w-full h-full object-contain" />
                  </div>
                  <div className="p-4 flex-1 flex flex-col">
                    <div className="font-display text-xl uppercase tracking-wider">{p.label}</div>
                    <div className="font-display text-2xl text-primary mt-2 leading-none">{formatRp(p.base + ADD_ON)}</div>
                    <div className="mt-1 text-[11px] text-muted-foreground">{formatRp(p.base)} + {formatRp(ADD_ON)}</div>
                    <Link data-testid="price-list-print-only-link-1" to={`/order?${params.toString()}`} className="mt-4 inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 border-2 border-foreground shadow-stamp font-bold uppercase tracking-wider text-xs lift">
                      {isID ? "Pesan" : "Order"}
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-8 border-2 border-foreground bg-card p-5 text-sm text-muted-foreground">
            {isID
              ? "Catatan: harga di atas hanya untuk jasa sablon. Pastikan kaos yang dibawa bersih, kering, dan sesuai ukuran cetak."
              : "Note: prices above cover screen printing service only. Please bring a clean, dry t-shirt that fits the chosen print size."}
          </div>
        </section>
      </main>
    </div>
  );
}
