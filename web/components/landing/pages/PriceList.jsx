import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ShoppingBag, Check } from "lucide-react";
import { useLang } from "@/components/landing/i18n/LangContext";
import { SubPageBar } from "@/components/landing/components/SubPageBar";

const SHIRTS = [
  { id: "local", name: "SIZE LOCAL (BuildUp Tees)", price: 55000,
    spec: { Suplier: "New State Apparel 24s Premium", Size: "Asia / Local Size", Model: "Kaos tanpa jaritan samping", Bahan: "Cotton 100% 24s" } },
  { id: "usa", name: "SIZE LUAR (BuildUp Tees)", price: 60000,
    spec: { Suplier: "Stich Premium 24s", Size: "Eropa / USA", Model: "Kaos tanpa jaritan samping", Bahan: "Cotton 100% 24s" } },
  { id: "dns", name: "Standar DNS", price: 50000,
    spec: { Suplier: "Produk Original dari DANESWARA PRINTING", Size: "Asia / Local Size", Model: "Kaos Reguler dengan jaritan samping", Bahan: "Cotton 100% 30s (Nirwana Textile) softees" } },
];
const PRINTS = [
  { id: "logo", label: "Logo", price: 10000, mockup: "/assets/mockups/logo-front.webp" },
  { id: "a5", label: "A5", price: 15000, mockup: "/assets/mockups/a5.webp" },
  { id: "a4", label: "A4", price: 25000, mockup: "/assets/mockups/a4.webp" },
  { id: "a3", label: "A3", price: 30000, mockup: "/assets/mockups/a3.webp" },
];
const DOUBLE = {
  "logo+logo": "/assets/mockups/logo-logo.webp", "a5+logo": "/assets/mockups/logo-a5.webp",
  "a4+logo": "/assets/mockups/logo-a4.webp", "a3+logo": "/assets/mockups/logo-a3.webp",
  "a5+a5": "/assets/mockups/a5-a5.webp", "a4+a5": "/assets/mockups/a5-a4.webp",
  "a3+a5": "/assets/mockups/a5-a3.webp", "a4+a4": "/assets/mockups/a4-a4.webp",
  "a3+a4": "/assets/mockups/a4-a3.webp", "a3+a3": "/assets/mockups/a3-a3.webp",
};
const DISCOUNT = 5000;
const key = (a, b) => [a.id, b.id].sort().join("+");
const Rp = (n) => "Rp " + n.toLocaleString("id-ID");
const PAIRS = (() => { const o=[]; for (let i=0;i<PRINTS.length;i++) for (let j=i;j<PRINTS.length;j++) o.push([PRINTS[i],PRINTS[j]]); return o.sort((a,b)=>a[0].price+a[1].price-(b[0].price+b[1].price)); })();

function Card({ shirt, label, pkgId, mockup, price, isID }) {
  const p = new URLSearchParams({ shirt: shirt.name, shirtId: shirt.id, package: label, packageId: pkgId, price: String(price) });
  return (
    <div className="bg-card border-2 border-foreground shadow-stamp flex flex-col">
      <div className="aspect-square bg-[#F4F1EA] border-b-2 border-foreground overflow-hidden">
        <img src={mockup} alt={label} loading="lazy" className="w-full h-full object-contain" />
      </div>
      <div className="p-4 flex-1 flex flex-col">
        <div className="font-display text-xl uppercase tracking-wider">{label}</div>
        <div className="font-display text-2xl text-primary mt-2 leading-none">{Rp(price)}</div>
        <Link data-testid="price-list-link-1" to={`/order?${p.toString()}`} className="mt-4 inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 border-2 border-foreground shadow-stamp font-bold uppercase tracking-wider text-xs lift">
          <ShoppingBag size={14} /> {isID ? "Pesan" : "Order"}
        </Link>
      </div>
    </div>
  );
}

export default function PriceList() {
  const { lang } = useLang();
  const isID = lang === "id";
  const [sel, setSel] = useState(null);

  return (
    <div className="min-h-screen bg-background">
      <SubPageBar />
      <header className="border-b-2 border-foreground bg-card">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10 py-8">
          <Link data-testid="price-list-link-2" to="/" className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground">
            <ArrowLeft size={14} /> {isID ? "Kembali" : "Back"}
          </Link>
          <div className="mt-4 text-xs uppercase tracking-[0.3em] text-primary font-bold">★ {isID ? "Daftar Harga" : "Price List"} ★</div>
          <h1 className="font-display mt-2 text-4xl sm:text-5xl lg:text-6xl uppercase tracking-wider leading-none">DTF Digital Printing</h1>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10 py-10 sm:py-14">
        {/* STEP 1 — Choose Shirt */}
        <section>
          <div className="text-[10px] uppercase tracking-[0.3em] font-bold text-primary">{isID ? "Langkah 1" : "Step 1"}</div>
          <h2 className="font-display text-2xl sm:text-3xl uppercase tracking-wider mt-1">
            {isID ? "Pilih Jenis Kaos" : "Choose Your T-Shirt"}
          </h2>
          <div className="mt-6 grid sm:grid-cols-3 gap-4">
            {SHIRTS.map((s) => {
              const active = sel?.id === s.id;
              return (
                <button data-testid="price-list-button-1" key={s.id} onClick={() => setSel(s)}
                  className={`text-left bg-card border-2 border-foreground p-5 lift ${active ? "shadow-stamp-red ring-2 ring-primary" : "shadow-stamp"}`}>
                  <div className="flex items-start justify-between">
                    <div className="font-display text-lg uppercase tracking-wider">{s.name}</div>
                    {active && <Check size={18} className="text-primary shrink-0" />}
                  </div>
                  <div className="font-display text-2xl text-primary mt-2 leading-none">{Rp(s.price)}</div>
                  <div className="text-xs uppercase tracking-widest text-muted-foreground mt-1">{isID ? "harga kaos" : "shirt only"}</div>
                </button>
              );
            })}
          </div>
        </section>

        {sel && (
          <>
            {/* Shirt detail */}
            <section className="mt-12 bg-card border-2 border-foreground shadow-stamp-lg p-6 sm:p-8">
              <div className="text-[10px] uppercase tracking-[0.3em] font-bold text-primary">{isID ? "Detail Kaos" : "Shirt Details"}</div>
              <h3 className="font-display text-2xl uppercase tracking-wider mt-1">{sel.name}</h3>
              <dl className="mt-4 grid sm:grid-cols-2 gap-x-8 gap-y-2 text-sm">
                {Object.entries(sel.spec).map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4 border-b border-foreground/15 pb-2">
                    <dt className="uppercase tracking-widest text-[11px] font-bold">{k}</dt>
                    <dd className="text-right">{v}</dd>
                  </div>
                ))}
              </dl>
            </section>

            {/* STEP 2 — Choose Package */}
            <section className="mt-12">
              <div className="text-[10px] uppercase tracking-[0.3em] font-bold text-primary">{isID ? "Langkah 2" : "Step 2"}</div>
              <h2 className="font-display text-2xl sm:text-3xl uppercase tracking-wider mt-1">
                {isID ? "Pilih Paket Cetakan" : "Choose Your Print Package"}
              </h2>

              <div className="mt-8 mb-4 flex items-center gap-3 bg-foreground text-background border-2 border-foreground px-4 py-2.5 shadow-stamp">
                <span className="font-display text-base sm:text-lg uppercase tracking-wider">
                  {isID ? "Sablon Satu Sisi" : "Single-Sided Printing"}
                </span>
                <span className="text-[10px] uppercase tracking-[0.25em] text-background/70 hidden sm:inline">
                  {isID ? "Cetak depan saja" : "Front only"}
                </span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {PRINTS.map((p) => (
                  <Card key={p.id} shirt={sel} label={p.label} pkgId={`single-${p.id}`} mockup={p.mockup} price={sel.price + p.price} isID={isID} />
                ))}
              </div>

              <div className="my-10 border-t-2 border-dashed border-foreground/40" />

              <div className="mt-6 mb-4 flex items-center gap-3 bg-primary text-primary-foreground border-2 border-foreground px-4 py-2.5 shadow-stamp">
                <span className="font-display text-base sm:text-lg uppercase tracking-wider">
                  {isID ? "Sablon Dua Sisi" : "Double-Sided Printing"}
                </span>
                <span className="text-[10px] uppercase tracking-[0.25em] text-primary-foreground/80">
                  {isID ? "Hemat Rp 5.000" : "Save Rp 5,000"}
                </span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {(PAIRS || []).map(([a, b]) => {
                  const k = key(a, b);
                  return <Card key={k} shirt={sel} label={`${a.label} + ${b.label}`} pkgId={`double-${k}`} mockup={DOUBLE[k]} price={sel.price + a.price + b.price - DISCOUNT} isID={isID} />;
                })}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
