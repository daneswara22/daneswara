'use client';
import '@/App.css';
import { AuthProvider } from '@/context/AuthContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { Toaster } from '@/components/ui/sonner';

export default function PosGroupLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <div className="App">
          {children}
          <Toaster position="top-right" richColors />
        </div>
      </AuthProvider>
    </ThemeProvider>
  );
}
