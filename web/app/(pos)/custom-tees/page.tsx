'use client';
import CustomTees from '@/src_pages/CustomTees';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/context/AuthContext';

// Desainer kaos sisi admin. Kasir ikut punya akses (melihat desain + pesanan
// pelanggan), tapi pengelolaan font tetap milik Owner/Manager.
function CustomTeesScreen() {
  const { user } = useAuth();
  const canManageFonts = ['Owner', 'Manager'].includes(user?.role);
  return <CustomTees canManageFonts={canManageFonts} />;
}

export default function Page() {
  return (
    <ProtectedRoute roles={['Owner', 'Manager', 'Kasir']}>
      <CustomTeesScreen />
    </ProtectedRoute>
  );
}
