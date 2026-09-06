'use client';
import ProtectedRoute from '@/components/ProtectedRoute';
import Settings from '@/src_pages/Settings';
export default function Page() {
  return <ProtectedRoute roles={['Owner','Manager','Kasir']}><Settings /></ProtectedRoute>;
}
