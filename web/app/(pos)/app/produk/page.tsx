'use client';
import ProtectedRoute from '@/components/ProtectedRoute';
import Products from '@/src_pages/Products';
export default function Page() {
  return <ProtectedRoute roles={['Owner','Manager','Gudang']}><Products /></ProtectedRoute>;
}
