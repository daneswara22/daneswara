import { useState, useEffect } from "react";
import { Menu, X } from "lucide-react";
import { useLang } from "@/components/landing/i18n/LangContext";

export const Header = ({ onCtaClick }) => {
  const { lang, setLang, t } = useLang();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const nav = [
    { href: "#gallery", label: t("nav_gallery"), id: "nav-gallery" },
    { href: "#pricing", label: t("nav_pricing"), id: "nav-pricing" },
    { href: "#process", label: t("nav_process"), id: "nav-process" },
    { href: "#quote", label: t("nav_contact"), id: "nav-quote" },
    { href: "#contact", label: t("nav_contact_us"), id: "nav-contact" },
  ];

  return (
    <header
      data-testid="site-header"
      className={`sticky top-0 z-50 bg-background border-b-2 border-foreground transition-shadow ${
        scrolled ? "shadow-stamp" : ""
      }`}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10 h-16 sm:h-20 flex items-center justify-between gap-4">
        <a href="#top" data-testid="brand-logo" className="flex items-center gap-3 group">
          <img
            src="/assets/daneswara-logo.webp"
            alt="Daneswara Print"
            className="h-10 sm:h-12 w-auto object-contain group-hover:translate-x-[-1px] group-hover:translate-y-[-1px] transition-transform"
          />
          <div className="leading-tight hidden sm:block">
            <div className="font-display text-lg sm:text-xl uppercase tracking-wider">
              Daneswara Print
            </div>
            <div className="text-[10px] sm:text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Denpasar — Est. 2016
            </div>
          </div>
        </a>

        <nav className="hidden md:flex items-center gap-7">
          {nav.map((n) => (
            <a
              key={n.href}
              href={n.href}
              data-testid={n.id}
              className="text-sm uppercase tracking-[0.18em] font-medium hover:text-primary transition-colors"
            >
              {n.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex items-center border-2 border-foreground">
            <button
              data-testid="lang-toggle-en"
              onClick={() => setLang("en")}
              className={`px-2 sm:px-2.5 py-1 text-[11px] sm:text-xs font-bold uppercase tracking-widest ${
                lang === "en" ? "bg-foreground text-background" : "bg-background"
              }`}
            >
              EN
            </button>
            <button
              data-testid="lang-toggle-id"
              onClick={() => setLang("id")}
              className={`px-2 sm:px-2.5 py-1 text-[11px] sm:text-xs font-bold uppercase tracking-widest border-l-2 border-foreground ${
                lang === "id" ? "bg-foreground text-background" : "bg-background"
              }`}
            >
              ID
            </button>
          </div>

          <button
            data-testid="header-cta-quote"
            onClick={onCtaClick}
            className="hidden sm:inline-flex items-center bg-primary text-primary-foreground px-4 py-2 border-2 border-foreground shadow-stamp font-bold uppercase tracking-wider text-xs lift"
          >
            {t("cta_quote")}
          </button>

          <button
            data-testid="mobile-menu-toggle"
            className="md:hidden border-2 border-foreground p-2"
            onClick={() => setOpen((o) => !o)}
            aria-label="Toggle menu"
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {open && (
        <div data-testid="mobile-menu" className="md:hidden border-t-2 border-foreground bg-card">
          <div className="px-4 py-4 flex flex-col gap-3">
            {nav.map((n) => (
              <a data-testid="header-a-1"
                key={n.href}
                href={n.href}
                onClick={() => setOpen(false)}
                className="text-sm uppercase tracking-[0.18em] font-medium py-2 border-b border-foreground/20"
              >
                {n.label}
              </a>
            ))}
            <button
              data-testid="header-cta-quote-mobile"
              onClick={() => {
                setOpen(false);
                onCtaClick?.();
              }}
              className="mt-2 bg-primary text-primary-foreground px-4 py-2.5 border-2 border-foreground shadow-stamp font-bold uppercase tracking-wider text-xs"
            >
              {t("cta_quote")}
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
