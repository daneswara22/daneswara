'use client';
import ProtectedRoute from '@/components/ProtectedRoute';
import Reports from '@/pages/Reports';
export default function Page() {
  return <ProtectedRoute roles={['Owner','Manager']}><Reports /></ProtectedRoute>;
}
