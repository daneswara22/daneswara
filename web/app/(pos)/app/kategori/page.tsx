'use client';
import ProtectedRoute from '@/components/ProtectedRoute';
import Categories from '@/pages/Categories';
export default function Page() {
  return <ProtectedRoute roles={['Owner','Manager','Gudang']}><Categories /></ProtectedRoute>;
}
