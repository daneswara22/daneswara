'use client';
import ProtectedRoute from '@/components/ProtectedRoute';
import MobilePlatform from '@/src_pages/MobilePlatform';

// Sales Channel › Mobile Platform Management (CMS tampilan & konten versi HP).
export default function Page() {
  return (
    <ProtectedRoute roles={['Owner', 'Manager']}>
      <MobilePlatform />
    </ProtectedRoute>
  );
}
