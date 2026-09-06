'use client';
import ProtectedRoute from '@/components/ProtectedRoute';
import Expenses from '@/src_pages/Expenses';
export default function Page() {
  return <ProtectedRoute roles={['Owner','Manager']}><Expenses /></ProtectedRoute>;
}
