'use client';
import ProtectedRoute from '@/components/ProtectedRoute';
import Suppliers from '@/src_pages/Suppliers';
export default function Page() {
  return <ProtectedRoute roles={['Owner','Manager','Gudang']}><Suppliers /></ProtectedRoute>;
}
