import { ArrowRight, Play } from "lucide-react";
import { useLang } from "@/components/landing/i18n/LangContext";

/**
 * Hero halaman awal.
 * Tata letak dua kolom: teks + CTA di kiri, ilustrasi editor kaos di kanan.
 * Ilustrasi kanan bisa diklik dan membawa pengunjung ke desainer publik `/custom`.
 */
export const Hero = ({ onQuoteClick, onGalleryClick }) => {
  const { t } = useLang();
  const stats = {
    shirts_printed: 12480,
    happy_clients: 320,
    years_in_print: 9,
  };

  return (
    <section
      id="top"
      data-testid="hero-section"
      className="relative overflow-hidden border-b border-foreground/15 bg-background"
    >
      <div className="absolute inset-0 bg-noise opacity-25 pointer-events-none" />

      <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 pb-16 pt-12 sm:px-6 sm:pb-20 sm:pt-16 lg:grid-cols-12 lg:gap-14 lg:px-10 lg:pb-24">
        {/* ---------- Kiri: judul, deskripsi, CTA, angka ---------- */}
        <div className="lg:col-span-6">
          <div className="inline-flex items-center gap-2.5 rounded-full border border-foreground/25 bg-card px-4 py-2 text-[10px] font-bold uppercase tracking-[0.26em] sm:text-[11px]">
            <span className="inline-block h-1.5 w-1.5 bg-foreground" />
            {t("hero_eyebrow")}
          </div>

          <h1
            data-testid="hero-title"
            className="font-display mt-7 text-[2.75rem] font-extrabold leading-[0.95] tracking-[-0.03em] text-foreground sm:text-6xl lg:text-7xl"
          >
            {t("hero_title_a")}{" "}
            <span className="relative inline-block">
              <span className="relative z-10">{t("hero_title_b")}</span>
              <span className="absolute bottom-1.5 left-0 -z-0 h-3 w-full bg-foreground/12 sm:h-4" />
            </span>{" "}
            {t("hero_title_c")}
          </h1>

          <p className="mt-6 max-w-md text-[15px] leading-relaxed text-muted-foreground sm:text-base">
            {t("hero_sub")}
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-3 lg:flex-nowrap">
            {/* CTA utama: membuka desainer kaos publik */}
            <a
              data-testid="hero-cta-design"
              href="/custom"
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-foreground px-6 py-3.5 text-[11px] font-bold uppercase tracking-[0.12em] text-background transition hover:opacity-90"
            >
              {t("cta_design")} <ArrowRight size={14} />
            </a>
            <button
              data-testid="hero-cta-quote"
              onClick={onQuoteClick}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full border-2 border-foreground/85 bg-background px-5 py-3 text-[11px] font-bold uppercase tracking-[0.12em] text-foreground transition hover:bg-card"
            >
              {t("cta_quote")} <ArrowRight size={14} />
            </button>
            <button
              data-testid="hero-cta-gallery"
              onClick={onGalleryClick}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full border-2 border-foreground/85 bg-background px-5 py-3 text-[11px] font-bold uppercase tracking-[0.12em] text-foreground transition hover:bg-card"
            >
              <Play size={12} /> {t("cta_view")}
            </button>
          </div>

          <div className="mt-12 grid max-w-md grid-cols-3 gap-5 sm:gap-8">
            {[
              { v: stats.shirts_printed?.toLocaleString?.("en-US") ?? "12,480", l: t("hero_stat_shirts") },
              { v: `${stats.happy_clients}+`, l: t("hero_stat_clients") },
              { v: stats.years_in_print, l: t("hero_stat_years") },
            ].map((s, i) => (
              <div key={i} data-testid={`hero-stat-${i}`}>
                <div className="font-display text-3xl font-extrabold leading-none tracking-[-0.02em] text-foreground sm:text-[2.1rem]">
                  {s.v}
                </div>
                <div className="mt-2 text-[10px] uppercase leading-snug tracking-[0.18em] text-muted-foreground">
                  {s.l}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ---------- Kanan: ilustrasi editor, klik -> /custom ---------- */}
        <div className="lg:col-span-6">
          <a
            href="/custom"
            data-testid="hero-designer-link"
            aria-label={t("hero_designer_cta")}
            className="group relative block focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-4"
          >
            <img
              data-testid="hero-image"
              src="/assets/daneswara-custom-editor.webp"
              alt={t("hero_designer_alt")}
              width={1180}
              height={1333}
              loading="eager"
              className="mx-auto w-full max-w-[560px] select-none transition-transform duration-300 ease-out group-hover:-translate-y-1.5 group-hover:scale-[1.015]"
            />

            {/* Penanda bahwa ilustrasi ini bisa diklik */}
            <span className="pointer-events-none absolute inset-x-0 bottom-2 mx-auto flex w-fit items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-[11px] font-bold uppercase tracking-[0.14em] text-background opacity-0 shadow-lg transition-all duration-300 group-hover:opacity-100 group-focus-visible:opacity-100 sm:bottom-4">
              {t("hero_designer_cta")} <ArrowRight size={14} />
            </span>
          </a>
        </div>
      </div>
    </section>
  );
};
