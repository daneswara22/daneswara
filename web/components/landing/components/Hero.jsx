import { ArrowRight, Play } from "lucide-react";
import { useLang } from "@/landing/i18n/LangContext";

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
      className="relative border-b-2 border-foreground"
    >
      <div className="absolute inset-0 bg-noise opacity-60 pointer-events-none" />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-10 pt-12 pb-16 sm:pt-20 sm:pb-24 grid lg:grid-cols-12 gap-10 lg:gap-16 items-center">
        <div className="lg:col-span-7">
          <div className="inline-flex items-center gap-2 border-2 border-foreground px-3 py-1.5 bg-card text-[10px] sm:text-xs uppercase tracking-[0.25em] font-bold">
            <span className="w-1.5 h-1.5 bg-primary inline-block" />
            {t("hero_eyebrow")}
          </div>

          <h1
            data-testid="hero-title"
            className="font-display mt-6 text-5xl sm:text-7xl lg:text-[7.5rem] uppercase leading-[0.92] tracking-wide"
          >
            {t("hero_title_a")}{" "}
            <span className="relative inline-block">
              <span className="relative z-10 text-primary">{t("hero_title_b")}</span>
              <span className="absolute left-0 bottom-1 w-full h-3 bg-foreground/10 -z-0" />
            </span>
            <br />
            {t("hero_title_c")}
          </h1>

          <p className="mt-6 max-w-xl text-base sm:text-lg leading-relaxed text-muted-foreground">
            {t("hero_sub")}
          </p>

          <div className="mt-8 flex flex-col sm:flex-row gap-4">
            <button
              data-testid="hero-cta-quote"
              onClick={onQuoteClick}
              className="inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground px-6 py-3.5 border-2 border-foreground shadow-stamp font-bold uppercase tracking-wider text-sm lift"
            >
              {t("cta_design")} <ArrowRight size={16} />
            </button>
            <button
              data-testid="hero-cta-gallery"
              onClick={onGalleryClick}
              className="inline-flex items-center justify-center gap-2 bg-background text-foreground px-6 py-3.5 border-2 border-foreground shadow-stamp font-bold uppercase tracking-wider text-sm lift"
            >
              <Play size={14} /> {t("cta_view")}
            </button>
          </div>

          <div className="mt-12 grid grid-cols-3 gap-4 sm:gap-8 max-w-lg">
            {[
              { v: stats.shirts_printed?.toLocaleString?.() ?? "12,480", l: t("hero_stat_shirts") },
              { v: `${stats.happy_clients}+`, l: t("hero_stat_clients") },
              { v: stats.years_in_print, l: t("hero_stat_years") },
            ].map((s, i) => (
              <div
                key={i}
                data-testid={`hero-stat-${i}`}
                className="border-l-2 border-foreground pl-3"
              >
                <div className="font-display text-3xl sm:text-4xl text-foreground leading-none">
                  {s.v}
                </div>
                <div className="mt-2 text-[10px] sm:text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  {s.l}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-5">
          <div className="relative">
            <div className="absolute -top-4 -left-4 w-full h-full bg-primary border-2 border-foreground" />
            <div
              data-testid="hero-image"
              className="relative w-full h-[420px] sm:h-[520px] grid place-items-center bg-card border-2 border-foreground p-10"
            >
              <img
                src="/assets/daneswara-logo.webp"
                alt="Daneswara Print logo"
                className="max-w-[80%] max-h-[80%] object-contain"
              />
            </div>
            <div className="absolute -bottom-6 -right-3 sm:-right-6 bg-card border-2 border-foreground shadow-stamp px-4 py-3 max-w-[220px]">
              <div className="font-script text-2xl text-primary leading-none">since 2016</div>
              <div className="text-[10px] tracking-wide mt-1 normal-case leading-snug">
                We may not be the best, but we do our best on every project.
              </div>
            </div>
            <div className="absolute -top-6 right-6 hidden sm:flex w-20 h-20 rounded-full border-2 border-foreground bg-background items-center justify-center font-display text-xs uppercase tracking-widest rotate-12">
              <span className="text-center leading-tight">
                Small
                <br />
                Batch
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
