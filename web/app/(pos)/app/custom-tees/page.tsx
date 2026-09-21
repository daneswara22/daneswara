'use client';
import ProtectedRoute from '@/components/ProtectedRoute';
import CustomTeesOrders from '@/src_pages/CustomTeesOrders';
export default function Page() {
  return (
    <ProtectedRoute roles={['Owner', 'Manager']}>
      <CustomTeesOrders />
    </ProtectedRoute>
  );
}
