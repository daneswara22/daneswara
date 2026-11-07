import { createContext, useContext, useState, useMemo, useCallback, useEffect } from "react";
import { translations } from "@/components/landing/i18n/translations";

const LangContext = createContext(null);

/**
 * Bahasa Landing Page (publik) — TERPISAH dari bahasa aplikasi POS.
 *
 * - Default English untuk pengunjung internasional.
 * - Pilihan disimpan di localStorage supaya tidak perlu memilih ulang.
 * - Hanya dipakai di dalam komponen landing; POS tidak memakai context ini.
 */
const STORAGE_KEY = "daneswara.landing.lang";
const DEFAULT_LANG = "en";
const SUPPORTED = ["en", "id"];

function readStoredLang() {
  if (typeof window === "undefined") return DEFAULT_LANG;
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return SUPPORTED.includes(v) ? v : DEFAULT_LANG;
  } catch {
    return DEFAULT_LANG;
  }
}

export const LangProvider = ({ children }) => {
  // Mulai dari default agar SSR dan hidrasi menghasilkan markup yang sama,
  // lalu sinkronkan preferensi tersimpan setelah mount.
  const [lang, setLangState] = useState(DEFAULT_LANG);

  useEffect(() => {
    const stored = readStoredLang();
    if (stored !== DEFAULT_LANG) setLangState(stored);
  }, []);

  const setLang = useCallback((next) => {
    const value = SUPPORTED.includes(next) ? next : DEFAULT_LANG;
    setLangState(value);
    try {
      window.localStorage.setItem(STORAGE_KEY, value);
    } catch {
      /* localStorage penuh / private mode — abaikan */
    }
    if (typeof document !== "undefined") {
      document.documentElement.lang = value;
    }
  }, []);

  const t = useCallback(
    (key) => {
      const dict = translations[lang] || translations.en;
      return dict[key] ?? translations.en[key] ?? key;
    },
    [lang],
  );

  const value = useMemo(
    () => ({ lang, setLang, t, toggle: () => setLang(lang === "en" ? "id" : "en") }),
    [lang, setLang, t],
  );

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
};

export const useLang = () => {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error("useLang must be used inside LangProvider");
  return ctx;
};