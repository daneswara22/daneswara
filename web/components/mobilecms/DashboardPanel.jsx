'use client';
/** Tab Dashboard: ringkasan produk, status, dan keuntungan storefront HP. */
import { Package, Tags, Images, LayoutList, TrendingUp, Percent } from 'lucide-react';
import { rp, statusLabel, statusTone } from '@/lib/mobileCmsClient';

function Stat({ icon: Icon, label, value, sub }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className="mt-1.5 font-display text-2xl font-bold tracking-tight">{value}</div>
      {!!sub && <div className="mt-0.5 text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

export default function DashboardPanel({ draft }) {
  const s = draft?.stats || {};
  const byStatus = s.by_status || {};
  const top = [...(draft?.products || [])]
    .map((p) => ({ ...p }))
    .sort((a, b) => b.profit - a.profit)
    .slice(0, 5);

  return (
    <div className="space-y-4" data-testid="cms-dashboard-panel">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Stat icon={Package} label="Total Produk" value={s.products || 0} sub={`${s.featured || 0} produk pilihan`} />
        <Stat icon={Tags} label="Kategori" value={s.categories || 0} />
        <Stat icon={Images} label="Media" value={s.media || 0} />
        <Stat icon={LayoutList} label="Section Aktif" value={s.sections_enabled || 0} sub="dari urutan Mobile Layout" />
        <Stat icon={TrendingUp} label="Total Profit" value={rp(s.total_profit || 0)} sub="akumulasi profit per unit" />
        <Stat icon={Percent} label="Rata-rata Margin" value={`${s.avg_margin || 0}%`} />
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="text-sm font-semibold">Status Produk</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {['active', 'draft', 'hidden', 'out_of_stock'].map((k) => (
            <span key={k} className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusTone(k)}`}>
              {statusLabel(k)}: {byStatus[k] || 0}
            </span>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="text-sm font-semibold">Profit Tertinggi</h3>
        {top.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Belum ada produk. Mulai dari tab Products.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {top.map((p) => (
              <div key={p.id} className="flex items-center gap-3 rounded-md bg-secondary p-2.5">
                <img
                  src={p.thumbnail_image || p.main_image || '/assets/mockups/logo-a4.webp'}
                  alt={p.name}
                  className="h-9 w-9 shrink-0 rounded object-contain"
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium">{p.name}</div>
                  <div className="text-[11px] text-muted-foreground">
                    Pokok {rp(p.cost)} · Jual {rp(p.price)}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-[13px] font-semibold text-emerald-600">{rp(p.profit)}</div>
                  <div className="text-[11px] text-muted-foreground">{p.margin}%</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
