'use client';
import ProtectedRoute from '@/components/ProtectedRoute';
import Users from '@/pages/Users';
export default function Page() {
  return <ProtectedRoute roles={['Owner','Manager']}><Users /></ProtectedRoute>;
}
