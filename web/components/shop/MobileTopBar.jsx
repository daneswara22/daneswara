'use client';
/** Header mobile sederhana: tombol kembali + judul + Live Chat & Keranjang. */
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import MobileHeaderActions from '@/components/shop/MobileHeaderActions';

export default function MobileTopBar({ title, back = true, cart = true }) {
  const router = useRouter();

  return (
    <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-slate-200 bg-white px-3 py-3" data-testid="mobile-topbar">
      {back && (
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Kembali"
          data-testid="topbar-back"
          className="-ml-1 rounded-full p-1.5 text-slate-700 active:bg-slate-100"
        >
          <ArrowLeft size={21} />
        </button>
      )}
      <h1 className="flex-1 truncate text-[15px] font-semibold text-slate-900">{title}</h1>
      <MobileHeaderActions tone="dark" showCart={cart} />
    </header>
  );
}
