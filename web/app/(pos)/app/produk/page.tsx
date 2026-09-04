'use client';
import ProtectedRoute from '@/components/ProtectedRoute';
import Products from '@/pages/Products';
export default function Page() {
  return <ProtectedRoute roles={['Owner','Manager','Gudang']}><Products /></ProtectedRoute>;
}
