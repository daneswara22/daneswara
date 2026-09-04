'use client';
import ProtectedRoute from '@/components/ProtectedRoute';
import Layout from '@/components/Layout';
import { OutletProvider } from '@/lib/react-router-shim';

export default function AppLayoutClient({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <OutletProvider value={children}>
        <Layout />
      </OutletProvider>
    </ProtectedRoute>
  );
}
