import { Outlet } from "react-router-dom";
import { Toaster } from "sonner";
import { LangProvider } from "@/landing/i18n/LangContext";
import "@/landing/landing.css";

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
            border: "2px solid #1A1A1A",
            borderRadius: 0,
            background: "#F9F7F2",
            color: "#1A1A1A",
            fontFamily: "'Work Sans', sans-serif",
            boxShadow: "4px 4px 0 0 #1A1A1A",
          },
        }}
      />
    </LangProvider>
  );
}
