import { useLang } from "@/components/landing/i18n/LangContext";
import { PenTool, MonitorSmartphone, Printer, Truck } from "lucide-react";

export const Process = () => {
  const { t } = useLang();
  const steps = [
    { Icon: PenTool, t: t("process_1_t"), d: t("process_1_d") },
    { Icon: MonitorSmartphone, t: t("process_2_t"), d: t("process_2_d") },
    { Icon: Printer, t: t("process_3_t"), d: t("process_3_d") },
    { Icon: Truck, t: t("process_4_t"), d: t("process_4_d") },
  ];

  return (
    <section
      id="process"
      data-testid="process-section"
      className="border-b-2 border-foreground bg-card"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10 py-16 sm:py-24">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6 mb-12">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-primary font-bold">
              ★ {t("process_eyebrow")} ★
            </div>
            <h2 className="font-display mt-3 text-4xl sm:text-5xl lg:text-6xl uppercase tracking-wider leading-none">
              {t("process_title")}
            </h2>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map(({ Icon, t: title, d }, i) => (
            <div
              key={i}
              data-testid={`process-step-${i}`}
              className="bg-background border-2 border-foreground p-6 lift relative"
            >
              <div className="absolute -top-3 -left-3 w-9 h-9 bg-primary border-2 border-foreground grid place-items-center font-display text-sm text-primary-foreground">
                0{i + 1}
              </div>
              <Icon size={32} strokeWidth={1.5} />
              <h3 className="font-display mt-4 text-xl uppercase tracking-wider">{title}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
