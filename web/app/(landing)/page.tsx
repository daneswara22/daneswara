'use client';
import Landing from '@/components/landing/pages/Landing';
import MobileShopHome from '@/components/shop/MobileShopHome';

/**
 * Beranda publik.
 *  - Mobile (< md): katalog marketplace (MobileShopHome).
 *  - Tablet/desktop (>= md): halaman landing lama, TIDAK diubah.
 * Dipisah lewat CSS supaya tidak ada deteksi user-agent / pergeseran hydrasi.
 */
export default function Page() {
  return (
    <>
      <div className="md:hidden">
        <MobileShopHome />
      </div>
      <div className="hidden md:block">
        <Landing />
      </div>
    </>
  );
}
