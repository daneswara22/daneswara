'use client';
/** Tab Pesanan: riwayat kode pesanan yang dibuat dari perangkat ini. */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ReceiptText } from 'lucide-react';
import { rupiah } from '@/lib/api';
import { getOrders } from '@/lib/shopCart';
import MobileTopBar from '@/components/shop/MobileTopBar';
import MobileBottomNav from '@/components/shop/MobileBottomNav';

export default function OrdersView() {
  const [rows, setRows] = useState([]);
  const [ready, setReady] = useState(false);

  useEffect(() => { setRows(getOrders()); setReady(true); }, []);

  return (
    <div className="min-h-screen bg-slate-50 pb-24" data-testid="orders-view">
      <MobileTopBar title="Pesanan Saya" back={false} />

      {ready && rows.length === 0 && (
        <div className="flex flex-col items-center gap-3 px-6 py-20 text-center" data-testid="orders-empty">
          <ReceiptText size={44} className="text-slate-300" />
          <p className="text-[13px] text-slate-500">Belum ada pesanan dari perangkat ini.</p>
          <Link href="/belanja" className="rounded-xl bg-blue-700 px-5 py-2.5 text-[13px] font-semibold text-white">
            Mulai Belanja
          </Link>
        </div>
      )}

      <div className="space-y-2 px-3 pt-2">
        {rows.map((r) => (
          <div key={r.code} className="rounded-xl border border-slate-200 bg-white p-3" data-testid={`order-row-${r.code}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-[13px] font-medium text-slate-900">{r.name}</div>
                <div className="mt-0.5 text-[11px] text-slate-500">{r.code}</div>
                <div className="text-[11px] text-slate-400">{String(r.at || '').slice(0, 10)}</div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-[14px] font-bold text-blue-700">{rupiah(r.total)}</div>
                <span className="mt-1 inline-block rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                  Menunggu Konfirmasi
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {rows.length > 0 && (
        <p className="px-4 pt-4 text-center text-[11px] leading-relaxed text-slate-400">
          Status terbaru dikonfirmasi CS melalui WhatsApp.
        </p>
      )}

      <MobileBottomNav />
    </div>
  );
}
