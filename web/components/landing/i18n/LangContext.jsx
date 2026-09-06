import { createContext, useContext, useState, useMemo, useCallback } from "react";
import { translations } from "@/components/landing/i18n/translations";

const LangContext = createContext(null);

export const LangProvider = ({ children }) => {
  const [lang, setLang] = useState("id");

  const t = useCallback(
    (key) => {
      const dict = translations[lang] || translations.en;
      return dict[key] ?? translations.en[key] ?? key;
    },
    [lang],
  );

  const value = useMemo(
    () => ({ lang, setLang, t, toggle: () => setLang((p) => (p === "en" ? "id" : "en")) }),
    [lang, t],
  );

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
};

export const useLang = () => {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error("useLang must be used inside LangProvider");
  return ctx;
};
