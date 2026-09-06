import { useLang } from "@/components/landing/i18n/LangContext";
import { useGallery } from "@/components/landing/hooks/useGallery";
import { SubPageBar } from "@/components/landing/components/SubPageBar";

export default function GalleryPage() {
  const { t, lang } = useLang();
  const isID = lang === "id";
  const items = useGallery();

  return (
    <div className="min-h-screen bg-background">
      <SubPageBar />
      <header className="border-b-2 border-foreground bg-card">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10 py-8">
          <div className="text-xs uppercase tracking-[0.3em] text-primary font-bold">
            ★ {t("gallery_eyebrow")} ★
          </div>
          <h1 className="font-display mt-2 text-4xl sm:text-5xl lg:text-6xl uppercase tracking-wider leading-none">
            {isID ? "Galeri Produk" : "Product Gallery"}
          </h1>
          <p className="mt-3 max-w-2xl text-base sm:text-lg text-muted-foreground">
            {t("gallery_sub")}
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10 py-10 sm:py-14">
        <div
          data-testid="gallery-page-grid"
          className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 auto-rows-[180px] sm:auto-rows-[220px]"
        >
          {(items || []).map((img, i) => (
            <figure
              key={img.id || i}
              data-testid={`gallery-page-item-${i}`}
              className={`group relative overflow-hidden border-2 border-foreground bg-card lift ${img.span || ""}`}
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
      </main>
    </div>
  );
}
