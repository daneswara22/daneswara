'use client';
import POS from '@/pages/POS';
import ProtectedRoute from '@/components/ProtectedRoute';
export default function Page() {
  return <ProtectedRoute><POS /></ProtectedRoute>;
}
