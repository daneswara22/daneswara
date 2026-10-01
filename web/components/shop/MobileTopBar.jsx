'use client';
/** Header mobile sederhana: judul + tombol kembali + pintasan keranjang. */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ShoppingCart } from 'lucide-react';
import { cartCount, CART_EVENT } from '@/lib/shopCart';

export default function MobileTopBar({ title, back = true, cart = true }) {
  const router = useRouter();
  const [count, setCount] = useState(0);

  useEffect(() => {
    const sync = () => setCount(cartCount());
    sync();
    window.addEventListener(CART_EVENT, sync);
    return () => window.removeEventListener(CART_EVENT, sync);
  }, []);

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
      {cart && (
        <Link href="/keranjang" aria-label="Keranjang" data-testid="topbar-cart" className="relative p-1.5 text-slate-700">
          <ShoppingCart size={21} />
          {count > 0 && (
            <span className="absolute -right-0.5 -top-0.5 min-w-[17px] rounded-full bg-blue-700 px-1 text-center text-[10px] font-bold leading-[17px] text-white">
              {count > 99 ? '99+' : count}
            </span>
          )}
        </Link>
      )}
    </header>
  );
}
