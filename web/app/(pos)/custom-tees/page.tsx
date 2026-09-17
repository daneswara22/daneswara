'use client';
import CustomTees from '@/src_pages/CustomTees';
import ProtectedRoute from '@/components/ProtectedRoute';

// TAHAP 1: layout saja, akses dibatasi untuk admin (Owner/Manager) selama dev.
export default function Page() {
  return (
    <ProtectedRoute roles={['Owner', 'Manager']}>
      <CustomTees />
    </ProtectedRoute>
  );
}
