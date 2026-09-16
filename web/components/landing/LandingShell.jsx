import { Outlet } from "react-router-dom";
import { Toaster } from "sonner";
import { LangProvider } from "@/components/landing/i18n/LangContext";
import "@/components/landing/landing.css";

/**
 * Wraps every public landing route: applies the scoped vintage theme (.dp-landing),
 * the ID/EN language provider and the landing-styled toaster.
 */
export default function LandingShell() {
  return (
    <LangProvider>
      <div className="dp-landing" data-testid="landing-shell">
        <Outlet />
      </div>
      <Toaster
        position="top-right"
        className="dp-toaster"
        toastOptions={{
          style: {
            border: "1.5px solid #e6e6e6",
            borderRadius: "0.9rem",
            background: "#ffffff",
            color: "#171717",
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            boxShadow: "0 16px 40px rgba(17,17,17,0.12)",
          },
        }}
      />
    </LangProvider>
  );
}
