'use client';
import ProtectedRoute from '@/components/ProtectedRoute';
import OtherIncome from '@/pages/OtherIncome';
export default function Page() {
  return <ProtectedRoute roles={['Owner','Manager']}><OtherIncome /></ProtectedRoute>;
}
