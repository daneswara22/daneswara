'use client';
import { LangProvider } from '@/components/landing/i18n/LangContext';
import { Toaster } from 'sonner';
import ChatWidget from '@/components/ChatWidget';
import '@/components/landing/landing.css';

export default function LandingLayout({ children }: { children: React.ReactNode }) {
  return (
    <LangProvider>
      <div className="dp-landing" data-testid="landing-shell">
        {children}
      </div>
      {/* Bubble chat pelanggan: di luar .dp-landing supaya tidak kena reset CSS landing */}
      <ChatWidget />
      <Toaster
        position="top-right"
        className="dp-toaster"
        toastOptions={{
          style: {
            border: '1.5px solid #e6e6e6',
            borderRadius: '0.9rem',
            background: '#ffffff',
            color: '#171717',
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            boxShadow: '0 16px 40px rgba(17,17,17,0.12)',
          },
        }}
      />
    </LangProvider>
  );
}
