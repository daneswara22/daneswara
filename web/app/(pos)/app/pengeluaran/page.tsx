'use client';
import ProtectedRoute from '@/components/ProtectedRoute';
import Expenses from '@/pages/Expenses';
export default function Page() {
  return <ProtectedRoute roles={['Owner','Manager']}><Expenses /></ProtectedRoute>;
}
