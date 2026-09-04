'use client';
import ProtectedRoute from '@/components/ProtectedRoute';
import Inventory from '@/pages/Inventory';
export default function Page() {
  return <ProtectedRoute roles={['Owner','Manager','Gudang']}><Inventory /></ProtectedRoute>;
}
