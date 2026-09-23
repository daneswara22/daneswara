'use client';
import ProtectedRoute from '@/components/ProtectedRoute';
import ProductTypes from '@/src_pages/ProductTypes';

// Halaman "Jenis Produk": CRUD info produk + varian warna + size chart.
// Menggantikan "Mockup Kaos" yang lama (upload mockup per warna kini menyatu
// sebagai foto tampak depan di tiap varian warna).
export default function Page() {
  return (
    <ProtectedRoute roles={['Owner', 'Manager']}>
      <ProductTypes />
    </ProtectedRoute>
  );
}
