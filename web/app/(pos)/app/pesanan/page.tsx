'use client';
import ProtectedRoute from '@/components/ProtectedRoute';
import Orders from '@/pages/Orders';
export default function Page() {
  return <ProtectedRoute roles={['Owner','Manager','Kasir']}><Orders /></ProtectedRoute>;
}
