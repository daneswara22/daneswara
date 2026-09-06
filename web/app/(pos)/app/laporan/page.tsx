'use client';
import ProtectedRoute from '@/components/ProtectedRoute';
import Reports from '@/src_pages/Reports';
export default function Page() {
  return <ProtectedRoute roles={['Owner','Manager']}><Reports /></ProtectedRoute>;
}
