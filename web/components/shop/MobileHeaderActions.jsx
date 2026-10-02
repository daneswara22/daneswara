'use client';
/**
 * Tombol aksi header mobile: Live Chat lalu Keranjang.
 *
 * Tombol chat memanggil widget chat yang SUDAH ADA (components/ChatWidget.jsx)
 * dengan menekan tombol apungnya, jadi tidak ada logika chat baru. Bubble apung
 * itu sendiri disembunyikan di mobile selama header ini terpasang (lihat
 * `body.dp-has-mobile-bar` di landing.css).
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { MessageCircle, ShoppingCart } from 'lucide-react';
import { cartCount, CART_EVENT } from '@/lib/shopCart';

const BODY_CLASS = 'dp-has-mobile-bar';

export default function MobileHeaderActions({ tone = 'dark', showCart = true }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const sync = () => setCount(cartCount());
    sync();
    window.addEventListener(CART_EVENT, sync);
    document.body.classList.add(BODY_CLASS);
    return () => {
      window.removeEventListener(CART_EVENT, sync);
      document.body.classList.remove(BODY_CLASS);
    };
  }, []);

  const openChat = () => {
    document.querySelector('[data-testid="chat-widget-button"]')?.click();
  };

  const color = tone === 'light' ? 'text-white' : 'text-slate-700';
  const badge = tone === 'light' ? 'bg-white text-blue-700' : 'bg-blue-700 text-white';

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={openChat}
        aria-label="Live chat"
        data-testid="header-chat"
        className={`p-1.5 ${color}`}
      >
        <MessageCircle size={21} />
      </button>
      {showCart && (
        <Link href="/keranjang" aria-label="Keranjang" data-testid="header-cart" className={`relative p-1.5 ${color}`}>
          <ShoppingCart size={21} />
          {count > 0 && (
            <span className={`absolute -right-0.5 -top-0.5 min-w-[17px] rounded-full px-1 text-center text-[10px] font-bold leading-[17px] ${badge}`}>
              {count > 99 ? '99+' : count}
            </span>
          )}
        </Link>
      )}
    </div>
  );
}
