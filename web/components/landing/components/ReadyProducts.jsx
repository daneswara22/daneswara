import { useState } from "react";
import Link from "next/link";
import { useLang } from "@/components/landing/i18n/LangContext";
import { rupiah } from "@/lib/api";
import { useShopCatalog, startingPrice } from "@/lib/shopCatalog";

const PAGE = 10;

const COPY = {
  id: {
    eyebrow: "PRODUK",
    title: "Produk siap jual.",
    sub: "Pilih produk, atur varian, lalu pesan langsung.",
    more: "Lihat lebih banyak",
    from: "Mulai dari",
  },
  en: {
    eyebrow: "PRODUCTS",
    title: "Ready to order.",
    sub: "Pick a product, set the options, then order.",
    more: "View more",
    from: "Starting from",
  },
};

/**
 * Grid produk siap jual untuk desktop/tablet.
 *
 * Sumber data, logika harga, dan tujuan klik SAMA PERSIS dengan section produk
 * di beranda mobile (components/shop/MobileShopHome.jsx):
 *   - data    : useShopCatalog() -> GET /api/public/shop-catalog
 *   - harga   : startingPrice() dari lib/shopCatalog
 *   - klik    : /belanja/[slug] (ProductDetail), atau p.href untuk produk editor
 * Tidak memakai data POS dan tidak membuat sistem detail produk baru.
 */
export const ReadyProducts = () => {
  const { lang } = useLang();
  const t = COPY[lang === "en" ? "en" : "id"];
  const { items, loading, error } = useShopCatalog();
  const [shown, setShown] = useState(PAGE);

  if (!loading && (error || items.length === 0)) return null;

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

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 items-stretch gap-4 sm:gap-6">
          {loading
            ? Array.from({ length: PAGE }).map((_, i) => (
                <div
                  key={i}
                  data-testid={`ready-product-skeleton-${i}`}
                  className="dp-frame flex h-full flex-col overflow-hidden border-2 border-foreground bg-background"
                >
                  <div className="aspect-square w-full animate-pulse bg-muted" />
                  <div className="flex flex-1 flex-col gap-2 border-t-2 border-foreground p-3">
                    <div className="h-3 w-4/5 animate-pulse bg-muted" />
                    <div className="h-3 w-3/5 animate-pulse bg-muted" />
                    <div className="mt-auto h-5 w-1/2 animate-pulse bg-muted" />
                  </div>
                </div>
              ))
            : visible.map((p, i) => (
                <Link
                  key={p.slug}
                  href={p.kind === "link" ? p.href : `/belanja/${p.slug}`}
                  data-testid={`ready-product-${p.slug}`}
                  aria-label={p.name}
                  className="dp-frame group flex h-full flex-col overflow-hidden border-2 border-foreground bg-background lift"
                >
                  <div className="relative aspect-square w-full overflow-hidden bg-muted">
                    <img
                      src={p.thumb}
                      alt={p.name}
                      loading={i < 5 ? "eager" : "lazy"}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  </div>
                  <div className="flex flex-1 flex-col border-t-2 border-foreground p-3 sm:p-4">
                    {/* Tinggi 2 baris dipatok supaya harga semua kartu sejajar */}
                    <h3 className="font-display text-[13px] sm:text-sm uppercase tracking-wide leading-snug line-clamp-2 h-[2.75em] break-words">
                      {p.name}
                    </h3>
                    <div className="mt-auto pt-3">
                      <div className="truncate text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                        {t.from}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-baseline gap-x-1 font-display text-base sm:text-lg leading-tight">
                        <span className="break-all">{rupiah(startingPrice(p))}</span>
                        <span className="whitespace-nowrap text-[11px] font-sans font-normal text-muted-foreground">
                          / {p.unitLabel || "pcs"}
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
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
