'use client';
// Layout khusus desainer kaos publik (/custom).
// Dipisah dari grup (landing) karena desainer memakai kanvas penuh layar dan
// styling POS (App.css), sementara landing punya tema/tipografi sendiri.
import '@/App.css';
import { Toaster } from '@/components/ui/sonner';

export default function DesignerGroupLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="App">
      {children}
      <Toaster position="top-right" richColors />
    </div>
  );
}
