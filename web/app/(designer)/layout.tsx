'use client';
// Layout khusus desainer kaos publik (/custom).
// Dipisah dari grup (landing) karena desainer memakai kanvas penuh layar dan
// styling POS (App.css), sementara landing punya tema/tipografi sendiri.
import '@/App.css';
import { Toaster } from '@/components/ui/sonner';
import ChatWidget from '@/components/ChatWidget';

export default function DesignerGroupLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="App">
      {children}
      <ChatWidget />
      <Toaster position="top-right" richColors />
    </div>
  );
}
