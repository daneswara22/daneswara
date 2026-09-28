'use client';
import ProtectedRoute from '@/components/ProtectedRoute';
import SalesChannels from '@/src_pages/SalesChannels';
export default function Page() {
  return (
    <ProtectedRoute roles={['Owner', 'Manager']}>
      <SalesChannels />
    </ProtectedRoute>
  );
}
