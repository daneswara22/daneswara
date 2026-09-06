'use client';
import ProtectedRoute from '@/components/ProtectedRoute';
import GalleryManager from '@/src_pages/GalleryManager';
export default function Page() {
  return <ProtectedRoute roles={['Owner','Manager']}><GalleryManager /></ProtectedRoute>;
}
