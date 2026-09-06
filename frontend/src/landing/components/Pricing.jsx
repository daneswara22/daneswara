import { Check } from "lucide-react";
import { useLang } from "@/landing/i18n/LangContext";

export const Pricing = ({ onSelectPackage }) => {
  const { t } = useLang();

  const packages = [
    {
      id: "dtg",
      title: t("pkg_dtg_t"),
      price: t("pkg_dtg_p"),
      desc: t("pkg_dtg_d"),
      bullets: [
        t("pkg_dtg_b1"),
        t("pkg_dtg_b2"),
        t("pkg_dtg_b3"),
        t("pkg_dtg_b4"),
      ],
      popular: true,
      link: "/price-list",
    },
    {
      id: "screen",
      title: t("pkg_screen_t"),
      price: t("pkg_screen_p"),
      desc: t("pkg_screen_d"),
      bullets: [
        t("pkg_screen_b1"),
        t("pkg_screen_b2"),
        t("pkg_screen_b3"),
        t("pkg_screen_b4"),
      ],
      popular: false,
      link: null,
    },
    {
      id: "bulk",
      title: t("pkg_bulk_t"),
      price: t("pkg_bulk_p"),
      desc: t("pkg_bulk_d"),
      bullets: [
        t("pkg_bulk_b1"),
        t("pkg_bulk_b2"),
        t("pkg_bulk_b3"),
        t("pkg_bulk_b4"),
      ],
      popular: false,
      link: "/price-list-print-only",
    },
  ];

  return (
    <section
      id="pricing"
      data-testid="pricing-section"
      className="border-b-2 border-foreground"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10 py-16 sm:py-24">
        <div className="max-w-3xl">
          <div className="text-xs uppercase tracking-[0.3em] text-primary font-bold">
            ★ {t("pricing_eyebrow")} ★
          </div>
          <h2 className="font-display mt-3 text-4xl sm:text-5xl lg:text-6xl uppercase tracking-wider leading-none">
            {t("pricing_title")}
          </h2>
          <p className="mt-4 text-base sm:text-lg text-muted-foreground">{t("pricing_sub")}</p>
        </div>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          {packages.map((p) => (
            <div
              key={p.id}
              data-testid={`pricing-card-${p.id}`}
              className={`relative bg-card border-2 border-foreground p-6 sm:p-8 lift ${
                p.popular ? "shadow-stamp-red md:-translate-y-2" : "shadow-stamp"
              }`}
            >
              {p.popular && (
                <div className="absolute -top-3 left-6 bg-foreground text-background px-3 py-1 text-[10px] uppercase tracking-[0.25em] font-bold border-2 border-foreground">
                  ★ {t("pricing_popular")}
                </div>
              )}
              <div className="font-display text-2xl sm:text-3xl uppercase tracking-wider">
                {p.title}
              </div>
              <div className="font-display text-3xl sm:text-4xl text-primary mt-2 leading-none">
                {p.price}
              </div>
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{p.desc}</p>
              <ul className="mt-5 space-y-2.5">
                {(p.bullets || []).map((b, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <Check size={16} className="text-primary shrink-0 mt-0.5" strokeWidth={3} />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
              <button
                data-testid={`pricing-cta-${p.id}`}
                onClick={() => {
                  if (p.link) {
                    window.location.href = p.link;
                  } else {
                    onSelectPackage?.(p.id);
                  }
                }}
                className={`mt-6 w-full px-4 py-3 border-2 border-foreground font-bold uppercase tracking-wider text-xs lift ${
                  p.popular
                    ? "bg-primary text-primary-foreground shadow-stamp"
                    : "bg-background shadow-stamp"
                }`}
              >
                {t("pkg_cta")}
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
