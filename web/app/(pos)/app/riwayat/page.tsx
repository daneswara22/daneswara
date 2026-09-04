'use client';
import ProtectedRoute from '@/components/ProtectedRoute';
import RiwayatTransaksi from '@/pages/RiwayatTransaksi';
export default function Page() {
  return <ProtectedRoute roles={['Owner','Manager','Kasir']}><RiwayatTransaksi /></ProtectedRoute>;
}
