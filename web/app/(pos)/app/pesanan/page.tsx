'use client';
import ProtectedRoute from '@/components/ProtectedRoute';
import Orders from '@/src_pages/Orders';
export default function Page() {
  return <ProtectedRoute roles={['Owner','Manager','Kasir']}><Orders /></ProtectedRoute>;
}
