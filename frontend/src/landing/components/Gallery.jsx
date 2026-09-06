import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useLang } from "@/landing/i18n/LangContext";
import { useGallery } from "@/landing/hooks/useGallery";

const HOME_LIMIT = 6;

export const Gallery = () => {
  const { t } = useLang();
  const all = useGallery();
  const items = all.slice(0, HOME_LIMIT);

  return (
    <section
      id="gallery"
      data-testid="gallery-section"
      className="border-b-2 border-foreground bg-muted"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10 py-16 sm:py-24">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-12">
          <div className="max-w-2xl">
            <div className="text-xs uppercase tracking-[0.3em] text-primary font-bold">
              ★ {t("gallery_eyebrow")} ★
            </div>
            <h2 className="font-display mt-3 text-4xl sm:text-5xl lg:text-6xl uppercase tracking-wider leading-none">
              {t("gallery_title")}
            </h2>
            <p className="mt-4 text-base sm:text-lg text-muted-foreground">{t("gallery_sub")}</p>
          </div>
          <div className="font-script text-3xl text-primary hidden md:block">est. 2016</div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 auto-rows-[180px] sm:auto-rows-[220px]">
          {(items || []).map((img, i) => (
            <figure
              key={img.id || i}
              data-testid={`gallery-item-${i}`}
              className={`group relative overflow-hidden border-2 border-foreground bg-background lift ${img.span || ""}`}
            >
              <img
                src={img.src}
                alt={img.label}
                loading="lazy"
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <figcaption className="absolute bottom-0 inset-x-0 bg-background/95 border-t-2 border-foreground px-3 py-2 flex items-center justify-between">
                <span className="font-display uppercase text-sm tracking-wider truncate">
                  {img.label}
                </span>
                <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-primary shrink-0 ml-2">
                  {img.tag}
                </span>
              </figcaption>
            </figure>
          ))}
        </div>

        <div className="mt-10 flex justify-center">
          <Link
            to="/galeri"
            data-testid="gallery-see-more"
            className="inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground px-7 py-3.5 border-2 border-foreground shadow-stamp font-bold uppercase tracking-wider text-sm lift"
          >
            {t("gallery_more")} <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </section>
  );
};
