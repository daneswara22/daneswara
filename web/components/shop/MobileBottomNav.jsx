'use client';
/** Navigasi bawah khas aplikasi mobile. Hanya dipakai di tampilan mobile. */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, LayoutGrid, ShoppingCart, ReceiptText } from 'lucide-react';
import { cartCount, CART_EVENT } from '@/lib/shopCart';

const TABS = [
  { href: '/', label: 'Beranda', icon: Home },
  { href: '/belanja', label: 'Produk', icon: LayoutGrid },
  { href: '/keranjang', label: 'Keranjang', icon: ShoppingCart, badge: true },
  { href: '/pesanan-saya', label: 'Pesanan', icon: ReceiptText },
];

export default function MobileBottomNav() {
  const pathname = usePathname();
  const [count, setCount] = useState(0);

  useEffect(() => {
    const sync = () => setCount(cartCount());
    sync();
    window.addEventListener(CART_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(CART_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white md:left-1/2 md:right-auto md:w-full md:max-w-2xl md:-translate-x-1/2"
      data-testid="mobile-bottom-nav"
    >
      <div className="mx-auto grid max-w-md grid-cols-4">
        {TABS.map((t) => {
          const active = t.href === '/' ? pathname === '/' : pathname.startsWith(t.href);
          const Icon = t.icon;
          return (
            <Link
              key={t.href}
              href={t.href}
              data-testid={`nav-${t.label.toLowerCase()}`}
              className={`flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium ${
                active ? 'text-blue-700' : 'text-slate-500'
              }`}
            >
              <span className="relative">
                <Icon size={21} strokeWidth={active ? 2.4 : 1.9} />
                {t.badge && count > 0 && (
                  <span
                    className="absolute -right-2.5 -top-1.5 min-w-[17px] rounded-full bg-blue-700 px-1 text-center text-[10px] font-bold leading-[17px] text-white"
                    data-testid="cart-badge"
                  >
                    {count > 99 ? '99+' : count}
                  </span>
                )}
              </span>
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
