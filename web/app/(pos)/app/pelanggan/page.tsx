'use client';
import ProtectedRoute from '@/components/ProtectedRoute';
import Customers from '@/src_pages/Customers';
export default function Page() {
  return <ProtectedRoute roles={['Owner','Manager','Kasir']}><Customers /></ProtectedRoute>;
}
