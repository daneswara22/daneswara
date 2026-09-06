import { MapPin, Mail, Phone, Clock, Instagram, ExternalLink } from "lucide-react";
import { useLang } from "@/landing/i18n/LangContext";

const MAP_LINK = "https://maps.app.goo.gl/81eCVGTbwG1C2GmA6";
const MAP_EMBED =
  "https://www.google.com/maps?q=Jl.+Gunung+Shangyang+156+Denpasar+Bali&output=embed";

export const Contact = () => {
  const { lang } = useLang();
  const isID = lang === "id";

  const items = [
    {
      Icon: MapPin,
      label: isID ? "Store" : "Store",
      value: "Jl. Gunung Shangyang 156, Denpasar — Bali",
      href: MAP_LINK,
      external: true,
      testid: "contact-address",
    },
    {
      Icon: Mail,
      label: "Email",
      value: "daneswara.made@gmail.com",
      href: "mailto:daneswara.made@gmail.com",
      testid: "contact-email",
    },
    {
      Icon: Phone,
      label: isID ? "Telepon / WA" : "Phone / WA",
      value: "+62 858 8810 2930",
      href: "https://wa.me/6285888102930",
      external: true,
      testid: "contact-phone",
    },
    {
      Icon: Clock,
      label: isID ? "Jam Kerja" : "Store Hours",
      value: isID
        ? "Senin — Sabtu · 10:00 — 19:00"
        : "Mon — Sat · 10:00 AM — 7:00 PM",
      testid: "contact-hours",
    },
    {
      Icon: Instagram,
      label: "Instagram",
      value: "@daneswaraprint",
      href: "https://instagram.com/daneswaraprint",
      external: true,
      testid: "contact-instagram",
    },
  ];

  return (
    <section
      id="contact"
      data-testid="contact-section"
      className="border-b-2 border-foreground bg-card"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10 py-16 sm:py-24">
        <div className="max-w-3xl">
          <div className="text-xs uppercase tracking-[0.3em] text-primary font-bold">
            ★ {isID ? "Kontak" : "Contact Us"} ★
          </div>
          <h2 className="font-display mt-3 text-4xl sm:text-5xl lg:text-6xl uppercase tracking-wider leading-none">
            {isID ? "Mampir ke store." : "Drop by the store."}
          </h2>
          <p className="mt-4 text-base sm:text-lg text-muted-foreground">
            {isID
              ? "Kami buka setiap hari kerja. Datang langsung untuk lihat sampel, ngobrolin desain, atau ambil pesanan."
              : "We're open every working day. Stop by to see samples, talk through your design, or pick up your order."}
          </p>
        </div>

        <div className="mt-12 grid lg:grid-cols-12 gap-6 lg:gap-8">
          {/* Map */}
          <div className="lg:col-span-7 relative">
            <div className="absolute -top-3 -left-3 w-full h-full bg-primary border-2 border-foreground" />
            <div className="relative border-2 border-foreground bg-background overflow-hidden shadow-stamp-lg">
              <iframe
                data-testid="contact-map"
                title="Daneswara Print studio map"
                src={MAP_EMBED}
                width="100%"
                height="460"
                style={{ border: 0, display: "block", filter: "grayscale(0.2) contrast(1.05)" }}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                allowFullScreen
              />
              <a
                href={MAP_LINK}
                target="_blank"
                rel="noreferrer"
                data-testid="contact-map-link"
                className="absolute bottom-4 right-4 inline-flex items-center gap-2 bg-background text-foreground px-3 py-2 border-2 border-foreground shadow-stamp font-bold uppercase tracking-wider text-[11px] lift"
              >
                {isID ? "Buka di Maps" : "Open in Maps"} <ExternalLink size={12} />
              </a>
            </div>
          </div>

          {/* Details */}
          <div className="lg:col-span-5">
            <div className="bg-background border-2 border-foreground shadow-stamp">
              <ul className="divide-y-2 divide-foreground/15">
                {items.map(({ Icon, label, value, href, external, testid }, i) => {
                  const content = (
                    <div className="flex items-start gap-4 p-5">
                      <div className="w-10 h-10 shrink-0 border-2 border-foreground grid place-items-center bg-card">
                        <Icon size={18} strokeWidth={2} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground font-bold">
                          {label}
                        </div>
                        <div className="mt-1 font-medium break-words">{value}</div>
                      </div>
                    </div>
                  );
                  return (
                    <li key={i} data-testid={testid}>
                      {href ? (
                        <a data-testid="contact-a-1"
                          href={href}
                          target={external ? "_blank" : undefined}
                          rel={external ? "noreferrer" : undefined}
                          className="block hover:bg-muted/40 transition-colors"
                        >
                          {content}
                        </a>
                      ) : (
                        content
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>

            <a
              href={MAP_LINK}
              target="_blank"
              rel="noreferrer"
              data-testid="contact-directions"
              className="mt-5 inline-flex items-center justify-center gap-2 w-full bg-primary text-primary-foreground px-4 py-3 border-2 border-foreground shadow-stamp font-bold uppercase tracking-wider text-xs lift"
            >
              {isID ? "Petunjuk Arah" : "Get Directions"} <ExternalLink size={14} />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};
