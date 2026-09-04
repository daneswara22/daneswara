'use client';
import ProtectedRoute from '@/components/ProtectedRoute';
import Suppliers from '@/pages/Suppliers';
export default function Page() {
  return <ProtectedRoute roles={['Owner','Manager','Gudang']}><Suppliers /></ProtectedRoute>;
}
