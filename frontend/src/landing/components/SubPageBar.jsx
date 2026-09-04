import { Link } from "react-router-dom";
import { Home } from "lucide-react";
import { useLang } from "@/landing/i18n/LangContext";

export const SubPageBar = () => {
  const { lang, setLang } = useLang();
  const isID = lang === "id";
  return (
    <div
      data-testid="subpage-bar"
      className="sticky top-0 z-50 border-b-2 border-foreground bg-background"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10 h-12 flex items-center justify-between gap-3">
        <Link
          to="/"
          data-testid="home-link"
          className="inline-flex items-center gap-2 text-xs uppercase tracking-widest font-bold hover:text-primary transition-colors"
        >
          <Home size={14} /> {isID ? "Kembali ke Halaman Awal" : "Back to Home"}
        </Link>
        <div className="flex items-center border-2 border-foreground">
          <button
            data-testid="lang-toggle-en"
            onClick={() => setLang("en")}
            className={`px-2.5 py-1 text-xs font-bold uppercase tracking-widest ${
              lang === "en" ? "bg-foreground text-background" : "bg-background"
            }`}
          >
            EN
          </button>
          <button
            data-testid="lang-toggle-id"
            onClick={() => setLang("id")}
            className={`px-2.5 py-1 text-xs font-bold uppercase tracking-widest border-l-2 border-foreground ${
              lang === "id" ? "bg-foreground text-background" : "bg-background"
            }`}
          >
            ID
          </button>
        </div>
      </div>
    </div>
  );
};
