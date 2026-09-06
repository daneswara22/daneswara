import { useLang } from "@/components/landing/i18n/LangContext";

export const Marquee = () => {
  const { t } = useLang();
  const text = t("marquee");
  const items = Array.from({ length: 8 });

  return (
    <div
      data-testid="marquee"
      className="bg-foreground text-background border-y-2 border-foreground overflow-hidden"
    >
      <div className="flex whitespace-nowrap animate-marquee py-4">
        {items.map((_, i) => (
          <span
            key={i}
            className="font-display uppercase tracking-[0.3em] text-lg sm:text-xl px-8 shrink-0"
          >
            {text}
          </span>
        ))}
      </div>
    </div>
  );
};
