'use client';
import ProtectedRoute from '@/components/ProtectedRoute';
import CustomSticker from '@/src_pages/CustomSticker';
export default function Page() {
  return <ProtectedRoute roles={['Owner','Manager','Kasir']}><CustomSticker /></ProtectedRoute>;
}
