'use client';
import ProtectedRoute from '@/components/ProtectedRoute';
import StickerOrders from '@/src_pages/StickerOrders';

export default function Page() {
  return <ProtectedRoute roles={['Owner','Manager','Kasir']}><StickerOrders /></ProtectedRoute>;
}
