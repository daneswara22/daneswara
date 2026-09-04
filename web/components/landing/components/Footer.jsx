import { Instagram, Mail, MapPin, Phone } from "lucide-react";
import { useLang } from "@/landing/i18n/LangContext";

export const Footer = () => {
  const { t } = useLang();
  const year = new Date().getFullYear();
  return (
    <footer data-testid="site-footer" className="bg-foreground text-background">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10 py-12">
        <div className="grid md:grid-cols-3 gap-8">
          <div>
            <img
              src="/assets/daneswara-logo.webp"
              alt="Daneswara Print"
              className="h-20 w-auto object-contain"
              style={{ filter: "brightness(0) invert(1)" }}
            />
            <div className="font-display text-3xl uppercase tracking-wider mt-3 sr-only">Daneswara Print</div>
            <p className="mt-3 text-sm text-background/70 max-w-xs">{t("footer_tag")}</p>
          </div>
          <div className="space-y-2 text-sm">
            <div className="font-display uppercase tracking-widest text-primary">Store</div>
            <a
              href="https://maps.app.goo.gl/81eCVGTbwG1C2GmA6"
              target="_blank"
              rel="noreferrer"
              data-testid="footer-map-link"
              className="flex items-start gap-2 hover:text-primary"
            >
              <MapPin size={14} className="mt-0.5 shrink-0" />
              <span>Jl. Gunung Shangyang 156, Denpasar — Bali</span>
            </a>
            <a href="mailto:daneswara.made@gmail.com" className="flex items-center gap-2 hover:text-primary">
              <Mail size={14} /> daneswara.made@gmail.com
            </a>
            <a href="https://wa.me/6285888102930" target="_blank" rel="noreferrer" className="flex items-center gap-2 hover:text-primary">
              <Phone size={14} /> +62 858 8810 2930
            </a>
            <div className="flex items-center gap-2"><Instagram size={14} /> @daneswaraprint</div>
          </div>
          <div className="space-y-2 text-sm">
            <div className="font-display uppercase tracking-widest text-primary">Quick links</div>
            <a href="#gallery" className="block hover:text-primary">Gallery</a>
            <a href="#pricing" className="block hover:text-primary">Pricing</a>
            <a href="#quote" className="block hover:text-primary">Quote</a>
            <a href="#contact" className="block hover:text-primary">Contact</a>
            <a href="/login" data-testid="admin-link" className="block hover:text-primary">Admin</a>
          </div>
        </div>
        <div className="mt-10 pt-6 border-t border-background/20 flex flex-col sm:flex-row justify-between gap-2 text-xs uppercase tracking-widest text-background/60">
          <span>© {year} Daneswara Print — {t("footer_rights")}</span>
          <span className="font-script text-base text-primary normal-case tracking-normal">printed with stubborn love.</span>
        </div>
      </div>
    </footer>
  );
};
