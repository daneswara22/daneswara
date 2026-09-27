import { Star, ExternalLink } from "lucide-react";
import { useLang } from "@/components/landing/i18n/LangContext";

/**
 * Ulasan Google — data diambil dari profil Google Business "Daneswara Printing"
 * (Jl. Gunung Sanghyang No.156, Padangsambian, Denpasar). Kutipan ulasan ditulis
 * apa adanya sesuai yang tampil di Google.
 */
const GOOGLE_URL = "https://share.google/VQFzuyX1uqjRzWUhW";
const RATING = 5.0;
const TOTAL = 55;

const REVIEWS = [
  {
    name: "Andrea McLean",
    meta: { id: "Local Guide · 9 ulasan", en: "Local Guide · 9 reviews" },
    when: { id: "7 bulan lalu", en: "7 months ago" },
    stars: 5,
    text: {
      en: "Great quality, great price, offer delivery and got them back to me within three days. You won't find a better T-shirt shop in Bali! Thank you again I will be back soon.",
      id: "Kualitas bagus, harga bagus, ada pengiriman, dan selesai dalam tiga hari. Tidak akan ada toko kaos yang lebih baik di Bali! Terima kasih, saya pasti kembali lagi.",
    },
  },
  {
    name: "Nadja Irena Fisic",
    meta: { id: "2 ulasan · 3 foto", en: "2 reviews · 3 photos" },
    when: { id: "6 bulan lalu", en: "6 months ago" },
    stars: 5,
    text: {
      en: "Amazing service!!! I ordered 3 Tshirts and needed them tomorrow. I sent photos for the print and everything was ready even before deadline. Plus super quality printing and very professional with supreme quick chatting on WhatsApp.",
      id: "Pelayanan luar biasa!!! Saya pesan 3 kaos dan butuh besok. Saya kirim foto untuk dicetak dan semuanya siap bahkan sebelum tenggat. Kualitas cetaknya super dan sangat profesional dengan balasan WhatsApp yang cepat.",
    },
  },
  {
    name: "Amine Khobba",
    meta: { id: "7 ulasan · 3 foto", en: "7 reviews · 3 photos" },
    when: { id: "7 bulan lalu", en: "7 months ago" },
    stars: 5,
    text: {
      en: "I had a very nice experience and got a good quality t-shirts. The design I sent them wasn't good quality — they were very nice to adjust and make it good. I like their approach of sharing what could be improved.",
      id: "Pengalaman yang sangat menyenangkan dan kaosnya berkualitas. Desain yang saya kirim kualitasnya kurang bagus — mereka dengan baik hati memperbaikinya. Saya suka cara mereka memberi masukan yang bisa diperbaiki.",
    },
  },
];

function Stars({ count = 5 }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${count} / 5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          size={13}
          className={i < count ? "fill-primary text-primary" : "text-muted-foreground"}
        />
      ))}
    </span>
  );
}

export function GoogleReviews() {
  const { lang } = useLang();
  const isID = lang === "id";
  const pick = (v) => (isID ? v.id : v.en);

  return (
    <div
      className="mt-8 bg-card border-2 border-foreground p-5 shadow-stamp"
      data-testid="google-reviews"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-script text-2xl text-primary leading-none">google reviews</div>
          <div className="mt-2 flex items-center gap-2">
            <span className="font-display text-3xl leading-none">{RATING.toFixed(1)}</span>
            <Stars count={5} />
          </div>
          <div className="mt-1 text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
            {isID ? `${TOTAL} ulasan · Google` : `${TOTAL} reviews · Google`}
          </div>
        </div>
        <a
          href={GOOGLE_URL}
          target="_blank"
          rel="noopener noreferrer"
          data-testid="google-reviews-link"
          className="inline-flex shrink-0 items-center gap-1.5 border-2 border-foreground bg-background px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.15em] lift"
        >
          {isID ? "Lihat" : "View"} <ExternalLink size={12} />
        </a>
      </div>

      <ul className="mt-5 space-y-4">
        {REVIEWS.map((r) => (
          <li key={r.name} className="border-t-2 border-foreground/10 pt-4 first:border-0 first:pt-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-bold uppercase tracking-wider">{r.name}</span>
              <Stars count={r.stars} />
            </div>
            <div className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
              {pick(r.meta)} · {pick(r.when)}
            </div>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">“{pick(r.text)}”</p>
          </li>
        ))}
      </ul>

      <a
        href={GOOGLE_URL}
        target="_blank"
        rel="noopener noreferrer"
        data-testid="google-reviews-all"
        className="mt-5 inline-flex w-full items-center justify-center gap-2 border-2 border-foreground bg-primary px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.2em] text-primary-foreground lift"
      >
        {isID ? `Baca semua ${TOTAL} ulasan` : `Read all ${TOTAL} reviews`}
        <ExternalLink size={13} />
      </a>
    </div>
  );
}

export default GoogleReviews;
