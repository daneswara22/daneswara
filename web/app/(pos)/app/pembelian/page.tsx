'use client';
import ProtectedRoute from '@/components/ProtectedRoute';
import Purchases from '@/pages/Purchases';
export default function Page() {
  return <ProtectedRoute roles={['Owner','Manager','Gudang']}><Purchases /></ProtectedRoute>;
}
