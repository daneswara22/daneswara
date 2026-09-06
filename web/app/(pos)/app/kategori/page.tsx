'use client';
import ProtectedRoute from '@/components/ProtectedRoute';
import Categories from '@/src_pages/Categories';
export default function Page() {
  return <ProtectedRoute roles={['Owner','Manager','Gudang']}><Categories /></ProtectedRoute>;
}
