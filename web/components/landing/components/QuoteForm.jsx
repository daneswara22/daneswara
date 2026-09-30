/* Panel Custom Sticker di homepage: simulasi cepat + pintu masuk ke editor penuh.
 * Editor 28 x 43 cm tetap di halaman Custom Sticker (tidak dimuat di sini).
 */
import { forwardRef, useImperativeHandle, useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
import { GoogleReviews } from "@/components/landing/components/GoogleReviews";
import { useLang } from "@/components/landing/i18n/LangContext";

const SHEET_W = 28;
const SHEET_H = 43;
const GAP = 0.1;

const SHAPES = [
  { v: "square", l: "Kotak 1:1" },
  { v: "circle", l: "Lingkaran" },
  { v: "custom", l: "Custom Size" },
];

const num = (v) => {
  const n = parseFloat(String(v).replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : 0;
};

export const QuoteForm = forwardRef(function QuoteForm(_, ref) {
  const { t } = useLang();
  const [shape, setShape] = useState("square");
  const [size, setSize] = useState(4);
  const [w, setW] = useState(4);
  const [h, setH] = useState(6);

  // API ref lama dipertahankan supaya pemanggil di homepage tidak error.
  useImperativeHandle(ref, () => ({ setPackage: () => {} }));

  const dim = useMemo(() => {
    if (shape === "custom") return { w: num(w), h: num(h) };
    const d = num(size);
    return { w: d, h: d };
  }, [shape, size, w, h]);

  const grid = useMemo(() => {
    if (!dim.w || !dim.h) return { cols: 0, rows: 0, total: 0 };
    const cols = Math.floor((SHEET_W + GAP) / (dim.w + GAP));
    const rows = Math.floor((SHEET_H + GAP) / (dim.h + GAP));
    return { cols: Math.max(0, cols), rows: Math.max(0, rows), total: Math.max(0, cols * rows) };
  }, [dim]);

  const cells = useMemo(() => {
    const max = 240; // batasi jumlah bentuk pada preview mini
    const out = [];
    for (let r = 0; r < grid.rows && out.length < max; r++) {
      for (let c = 0; c < grid.cols && out.length < max; c++) out.push(`${r}-${c}`);
    }
    return out;
  }, [grid]);

  const inputCls =
    "w-full bg-background border-2 border-foreground px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background";
  const labelCls = "block text-[11px] font-bold uppercase tracking-[0.2em] mb-1.5";

  return (
    <section id="quote" data-testid="quote-section" className="border-b-2 border-foreground">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-12 lg:px-10">
        <div className="lg:col-span-5">
          <div className="text-xs font-bold uppercase tracking-[0.3em] text-primary">★ {t("quote_eyebrow")} ★</div>
          <h2 className="font-display mt-3 text-4xl leading-tight tracking-tight sm:text-5xl lg:text-6xl">{t("quote_title")}</h2>
          <p className="mt-4 max-w-md text-base text-muted-foreground sm:text-lg">{t("quote_sub")}</p>

          <div className="mt-8 border-2 border-foreground bg-card p-5 shadow-stamp">
            <div className="font-script text-2xl leading-none text-primary">store hours</div>
            <div className="mt-2 text-sm uppercase tracking-widest">Mon — Sat · 10:00 AM — 7:00 PM</div>
            <div className="mt-3 text-sm">daneswara.made@gmail.com</div>
            <div className="text-sm">+62 858 8810 2930</div>
          </div>

          <GoogleReviews />
        </div>

        {/* Panel Custom Sticker */}
        <div className="border-2 border-foreground bg-card p-6 shadow-stamp-lg sm:p-8 lg:col-span-7" data-testid="sticker-quick-panel">
          <div className="text-[11px] font-bold uppercase tracking-[0.3em] text-primary">Custom Sticker</div>
          <p className="mt-2 text-sm text-muted-foreground">Atur ukuran, lihat estimasi jumlah sticker, lalu upload desainmu.</p>

          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <div className="space-y-5">
              <div>
                <span className={labelCls}>1. Pilih Bentuk</span>
                <div className="grid grid-cols-3 gap-2">
                  {SHAPES.map((s) => (
                    <button
                      type="button"
                      key={s.v}
                      onClick={() => setShape(s.v)}
                      data-testid={`sq-shape-${s.v}`}
                      className={`border-2 border-foreground px-2 py-2.5 text-[11px] font-bold uppercase tracking-wider ${
                        shape === s.v ? "bg-foreground text-background" : "bg-background"
                      }`}
                    >
                      {s.l}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className={labelCls}>2. Atur Ukuran</span>
                {shape === "custom" ? (
                  <div className="grid grid-cols-2 gap-2">
                    <input className={inputCls} value={w} onChange={(e) => setW(e.target.value)} inputMode="decimal" placeholder="Lebar (cm)" data-testid="sq-width" />
                    <input className={inputCls} value={h} onChange={(e) => setH(e.target.value)} inputMode="decimal" placeholder="Tinggi (cm)" data-testid="sq-height" />
                  </div>
                ) : (
                  <input className={inputCls} value={size} onChange={(e) => setSize(e.target.value)} inputMode="decimal" placeholder={shape === "circle" ? "Diameter (cm)" : "Sisi (cm)"} data-testid="sq-size" />
                )}
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  {shape === "circle" ? "Diameter dalam cm" : shape === "custom" ? "Lebar × tinggi dalam cm" : "Sisi dalam cm"} · lembar {SHEET_W} × {SHEET_H} cm
                </p>
              </div>

              <div className="border-2 border-foreground bg-background px-4 py-3">
                <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Estimasi</div>
                <div className="font-display text-2xl" data-testid="sq-estimate">
                  {grid.total} sticker / lembar
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {dim.w ? `${dim.w.toFixed(1)} × ${dim.h.toFixed(1)} cm` : "Masukkan ukuran"} · jarak 0,1 cm
                </div>
              </div>

              <a
                href="/app/custom-sticker"
                data-testid="sq-start"
                className="lift inline-flex items-center gap-2 border-2 border-foreground bg-primary px-6 py-3 text-sm font-bold uppercase tracking-wider text-primary-foreground shadow-stamp"
              >
                Mulai Custom Sticker <ArrowRight size={16} />
              </a>
            </div>

            {/* Preview mini (bukan editor) */}
            <div className="border-2 border-foreground bg-background p-3">
              <div className="mb-2 flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                <span>Simulasi</span>
                <span>{grid.cols} × {grid.rows}</span>
              </div>
              <div
                className="relative mx-auto w-full max-w-[220px] overflow-hidden bg-white"
                style={{ aspectRatio: `${SHEET_W} / ${SHEET_H}` }}
                data-testid="sq-preview"
              >
                {grid.total > 0 ? (
                  <div
                    className="grid h-full w-full content-start gap-[2px] p-[2px]"
                    style={{ gridTemplateColumns: `repeat(${grid.cols}, minmax(0, 1fr))` }}
                  >
                    {cells.map((k) => (
                      <div
                        key={k}
                        className={`border border-blue-600 bg-blue-500/25 ${shape === "circle" ? "rounded-full" : "rounded-[1px]"}`}
                        style={{ aspectRatio: `${dim.w} / ${dim.h}` }}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="flex h-full items-center justify-center px-3 text-center text-[11px] text-zinc-400">Ukuran belum muat di lembar</p>
                )}
              </div>
              <p className="mt-2 text-center text-[10px] text-muted-foreground">Preview cepat · kanvas penuh ada di halaman Custom Sticker</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
});
