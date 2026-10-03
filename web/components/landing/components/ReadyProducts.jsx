import { useState } from "react";
import { Package } from "lucide-react";
import { useLang } from "@/components/landing/i18n/LangContext";
import { rupiah } from "@/lib/api";
import { useReadyProducts } from "@/components/landing/hooks/useReadyProducts";

const PAGE = 10;

const COPY = {
  id: {
    eyebrow: "PRODUK",
    title: "Produk siap jual.",
    sub: "Stok siap kirim dari workshop kami di Denpasar.",
    more: "Lihat lebih banyak",
  },
  en: {
    eyebrow: "PRODUCTS",
    title: "Ready to ship.",
    sub: "In-stock items from our Denpasar workshop.",
    more: "Show more",
  },
};

/**
 * Grid produk siap jual. Data diambil dari menu Produk di dashboard, tidak ada
 * produk contoh. Tombol "Lihat lebih banyak" hanya muncul kalau masih ada sisa.
 */
export const ReadyProducts = () => {
  const { lang } = useLang();
  const t = COPY[lang === "en" ? "en" : "id"];
  const { items, loading } = useReadyProducts();
  const [shown, setShown] = useState(PAGE);

  if (!loading && items.length === 0) return null;

  const visible = items.slice(0, shown);
  const hasMore = items.length > shown;

  return (
    <section
      id="produk"
      data-testid="ready-products-section"
      className="border-b-2 border-foreground bg-background"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10 py-16 sm:py-24">
        <div className="max-w-2xl mb-12">
          <div className="text-xs uppercase tracking-[0.3em] text-primary font-bold">
            ★ {t.eyebrow} ★
          </div>
          <h2 className="font-display mt-3 text-4xl sm:text-5xl lg:text-6xl tracking-tight leading-tight">
            {t.title}
          </h2>
          <p className="mt-4 text-base sm:text-lg text-muted-foreground">{t.sub}</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 sm:gap-6">
          {loading
            ? Array.from({ length: PAGE }).map((_, i) => (
                <div
                  key={i}
                  data-testid={`ready-product-skeleton-${i}`}
                  className="border-2 border-foreground bg-background"
                >
                  <div className="aspect-square w-full animate-pulse bg-muted" />
                  <div className="border-t-2 border-foreground p-3 space-y-2">
                    <div className="h-3 w-4/5 animate-pulse bg-muted" />
                    <div className="h-4 w-1/2 animate-pulse bg-muted" />
                  </div>
                </div>
              ))
            : visible.map((p, i) => (
                <article
                  key={p.id}
                  data-testid={`ready-product-${i}`}
                  className="group flex flex-col border-2 border-foreground bg-background lift"
                >
                  <div className="relative aspect-square w-full overflow-hidden bg-muted">
                    {p.image ? (
                      <img
                        src={p.image}
                        alt={p.name}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <Package className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col gap-1 border-t-2 border-foreground p-3">
                    <h3 className="font-display text-sm uppercase tracking-wider leading-snug line-clamp-2">
                      {p.name}
                    </h3>
                    <div className="mt-auto pt-2 font-display text-lg">
                      {rupiah(p.price)}
                      <span className="ml-1 text-[11px] font-sans text-muted-foreground">/ {p.unit}</span>
                    </div>
                  </div>
                </article>
              ))}
        </div>

        {hasMore && (
          <div className="mt-10 flex justify-center">
            <button
              type="button"
              onClick={() => setShown((n) => n + PAGE)}
              data-testid="ready-products-more"
              className="border-2 border-foreground bg-background px-8 py-3 font-display text-sm uppercase tracking-[0.2em] lift hover:bg-foreground hover:text-background transition-colors"
            >
              {t.more}
            </button>
          </div>
        )}
      </div>
    </section>
  );
};
