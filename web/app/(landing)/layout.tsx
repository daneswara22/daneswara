'use client';
import { LangProvider } from '@/landing/i18n/LangContext';
import { Toaster } from 'sonner';
import '@/landing/landing.css';

export default function LandingLayout({ children }: { children: React.ReactNode }) {
  return (
    <LangProvider>
      <div className="dp-landing" data-testid="landing-shell">
        {children}
      </div>
      <Toaster
        position="top-right"
        className="dp-toaster"
        toastOptions={{
          style: {
            border: '2px solid #1A1A1A',
            borderRadius: 0,
            background: '#F9F7F2',
            color: '#1A1A1A',
            fontFamily: "'Work Sans', sans-serif",
            boxShadow: '4px 4px 0 0 #1A1A1A',
          },
        }}
      />
    </LangProvider>
  );
}
