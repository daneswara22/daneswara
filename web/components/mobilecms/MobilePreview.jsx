'use client';
/** Live Mobile Preview: frame HP yang menampilkan draft CMS secara realtime. */
import { Smartphone, RefreshCw, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import CmsStorefront from '@/components/shop/CmsStorefront';

export default function MobilePreview({ draft, onRefresh, publishedAt }) {
  const visible = (draft?.products || []).filter((p) => ['active', 'out_of_stock'].includes(p.status));
  const data = {
    settings: draft?.settings || {},
    sections: draft?.sections || [],
    categories: (draft?.categories || []).filter((c) => c.is_active),
    products: visible.map((p) => ({
      ...p,
      category_name: (draft?.categories || []).find((c) => c.id === p.category_id)?.name || '',
    })),
  };

  return (
    <div className="space-y-3" data-testid="mobile-preview-panel">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Smartphone className="h-4 w-4" /> Live Mobile Preview
        </div>
        <Button size="sm" variant="outline" onClick={onRefresh} data-testid="mobile-preview-refresh">
          <RefreshCw className="mr-1 h-3.5 w-3.5" /> Segarkan
        </Button>
      </div>

      <div className="mx-auto w-full max-w-[330px]">
        <div className="rounded-[2.2rem] border-[10px] border-zinc-800 bg-zinc-800 shadow-xl">
          <div className="relative overflow-hidden rounded-[1.6rem] bg-white">
            <div className="absolute left-1/2 top-1.5 z-10 h-4 w-20 -translate-x-1/2 rounded-full bg-zinc-800" />
            <div className="h-[600px] overflow-y-auto" data-testid="mobile-preview-viewport">
              <CmsStorefront data={data} preview />
              <div className="h-4" />
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-md border border-border bg-secondary p-2.5 text-[11px] leading-relaxed text-muted-foreground">
        <p className="flex items-start gap-1.5">
          <Eye className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Preview memakai data <b>draft</b>. Produk berstatus Draft/Hidden tidak ikut tampil.
            {draft?.settings?.storefront_enabled
              ? ' Storefront CMS aktif di HP pelanggan.'
              : ' Storefront CMS masih MATI — pelanggan tetap melihat tampilan lama sampai diaktifkan di tab Settings.'}
          </span>
        </p>
        <p className="mt-1.5">
          Publikasi terakhir:{' '}
          <b>{publishedAt ? new Date(publishedAt).toLocaleString('id-ID') : 'belum pernah'}</b>
        </p>
      </div>
    </div>
  );
}
