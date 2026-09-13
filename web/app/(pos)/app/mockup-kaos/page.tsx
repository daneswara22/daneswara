'use client';
import ProtectedRoute from '@/components/ProtectedRoute';
import MockupManager from '@/src_pages/MockupManager';
export default function Page() {
  return (
    <ProtectedRoute roles={['Owner', 'Manager']}>
      <MockupManager />
    </ProtectedRoute>
  );
}
