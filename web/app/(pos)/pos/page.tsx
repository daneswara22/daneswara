'use client';
import POS from '@/src_pages/POS';
import ProtectedRoute from '@/components/ProtectedRoute';
export default function Page() {
  return <ProtectedRoute><POS /></ProtectedRoute>;
}
