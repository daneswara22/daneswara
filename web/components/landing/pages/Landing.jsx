import { useRef, useCallback } from "react";
import { Header } from "@/components/landing/components/Header";
import { Hero } from "@/components/landing/components/Hero";
import { Marquee } from "@/components/landing/components/Marquee";
import { Process } from "@/components/landing/components/Process";
import { Pricing } from "@/components/landing/components/Pricing";
import { Gallery } from "@/components/landing/components/Gallery";
import { QuoteForm } from "@/components/landing/components/QuoteForm";
import { Contact } from "@/components/landing/components/Contact";
import { Footer } from "@/components/landing/components/Footer";

export default function Landing() {
  const formRef = useRef(null);

  const scrollTo = useCallback((id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const onQuote = () => scrollTo("quote");
  const onGallery = () => scrollTo("gallery");
  const onSelectPackage = (pkg) => {
    formRef.current?.setPackage(pkg);
    scrollTo("quote");
  };

  return (
    <div className="min-h-screen bg-background">
      <Header onCtaClick={onQuote} />
      <main>
        <Hero onQuoteClick={onQuote} onGalleryClick={onGallery} />
        <Marquee />
        <Process />
        <Pricing onSelectPackage={onSelectPackage} />
        <Gallery />
        <QuoteForm ref={formRef} />
        <Contact />
      </main>
      <Footer />
    </div>
  );
}
