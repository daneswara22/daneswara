'use client';
/**
 * Tab Mobile Layout — urutan section halaman HP.
 * Perubahan langsung tercermin di Live Mobile Preview (state draft dibagi).
 */
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { GripVertical, ChevronUp, ChevronDown, Lock, RotateCcw } from 'lucide-react';
import { moveItem, useDragSort } from '@/lib/mobileCmsClient';

const HINTS = {
  header: 'Logo, nama toko, dan kolom pencarian.',
  hero: 'Banner utama paling atas (isi di tab Settings).',
  category: 'Baris kategori dari tab Categories.',
  featured: 'Produk yang ditandai “Produk Pilihan”.',
  promo: 'Kartu promo (gambar + teks dari tab Settings).',
  products: 'Seluruh produk berstatus Active / Out of Stock.',
  custom_tees: 'Pintasan ke halaman desain kaos.',
  banner: 'Banner tambahan di bagian bawah.',
  footer: 'Tombol CS dan catatan penutup.',
};

export default function LayoutPanel({ sections, setSections }) {
  const { handlers, dropClass } = useDragSort(sections, (next) => setSections(next));

  const enableAll = () => setSections(sections.map((s) => ({ ...s, enabled: true })));

  return (
    <div className="space-y-4" data-testid="cms-layout-panel">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Tarik kartu untuk mengubah urutan section di halaman HP. Header &amp; Footer selalu aktif.
        </p>
        <Button size="sm" variant="outline" onClick={enableAll} data-testid="cms-layout-enable-all">
          <RotateCcw className="mr-1 h-3.5 w-3.5" /> Aktifkan Semua
        </Button>
      </div>

      <div className="space-y-2">
        {sections.map((s, i) => (
          <div
            key={s.key}
            {...handlers(i)}
            className={`flex items-center gap-3 rounded-lg border border-border bg-card p-3 ${dropClass(i)} ${
              s.enabled === false ? 'opacity-60' : ''
            }`}
            data-testid={`cms-layout-row-${s.key}`}
          >
            <span className="cursor-grab text-muted-foreground">
              <GripVertical className="h-4 w-4" />
            </span>
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-bold">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-sm font-semibold">
                {s.label}
                {s.locked && <Lock className="h-3 w-3 text-muted-foreground" />}
              </div>
              <div className="text-[11px] text-muted-foreground">{HINTS[s.key] || ''}</div>
            </div>
            <Button
              size="icon"
              variant="ghost"
              disabled={i === 0}
              onClick={() => setSections(moveItem(sections, i, i - 1))}
              data-testid={`cms-layout-up-${s.key}`}
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              disabled={i === sections.length - 1}
              onClick={() => setSections(moveItem(sections, i, i + 1))}
              data-testid={`cms-layout-down-${s.key}`}
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
            <Switch
              checked={s.enabled !== false}
              disabled={!!s.locked}
              onCheckedChange={(v) =>
                setSections(sections.map((x, idx) => (idx === i ? { ...x, enabled: v } : x)))
              }
              data-testid={`cms-layout-toggle-${s.key}`}
            />
          </div>
        ))}
      </div>

      <p className="rounded-md border border-border bg-secondary p-3 text-[11px] text-muted-foreground">
        Urutan ini baru tersimpan setelah menekan <b>Save Draft</b>, dan baru terlihat pelanggan setelah{' '}
        <b>Publish Changes</b>.
      </p>
    </div>
  );
}
