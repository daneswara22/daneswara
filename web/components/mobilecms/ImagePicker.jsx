'use client';
/**
 * Pemilih satu gambar: unggah baru, pilih dari Media, atau kosongkan.
 * Unggahan tetap memakai endpoint existing POST /api/upload (sharp -> WebP -> R2).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Upload, X, Images, Loader2, Search, Check } from 'lucide-react';
import api, { formatApiError, uploadImage } from '@/lib/api';

export default function ImagePicker({
  label,
  value,
  onChange,
  media = [],
  onMediaAdded,
  kind = 'product',
  hint,
  testId = 'image-picker',
  aspect = 'aspect-square',
}) {
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [pickOpen, setPickOpen] = useState(false);

  // Katalog gabungan: semua gambar yang tersimpan di database, bukan cuma tab Media.
  const [all, setAll] = useState(null);
  const [sources, setSources] = useState([]);
  const [loadingAll, setLoadingAll] = useState(false);
  const [source, setSource] = useState('all');
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!pickOpen) return;
    let alive = true;
    setLoadingAll(true);
    api
      .get('/mobile-cms/media/all')
      .then(({ data }) => {
        if (!alive) return;
        setAll(data.items || []);
        setSources(data.sources || []);
      })
      .catch(() => {
        if (!alive) return;
        // Gagal memuat katalog gabungan: pakai daftar tab Media yang sudah ada.
        setAll(null);
        setSources([]);
        toast.error('Gagal memuat katalog gambar, menampilkan daftar Media saja');
      })
      .finally(() => alive && setLoadingAll(false));
    return () => {
      alive = false;
    };
  }, [pickOpen]);

  const fallback = useMemo(
    () => media.map((m) => ({ ...m, source: 'media', source_label: 'Media' })),
    [media],
  );
  const catalog = all ?? fallback;

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return catalog.filter(
      (m) =>
        (source === 'all' || m.source === source) &&
        (!q || `${m.label || ''} ${m.source_label || ''}`.toLowerCase().includes(q)),
    );
  }, [catalog, source, query]);

  const resetFilters = () => {
    setSource('all');
    setQuery('');
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) return toast.error('File harus berupa gambar');
    setBusy(true);
    try {
      const info = await uploadImage(file, kind);
      onChange(info.url);
      // Gambar baru langsung ikut tampil di katalog tanpa perlu buka ulang dialog.
      setAll((prev) =>
        prev
          ? [
              {
                id: `media:new:${info.url}`,
                url: info.url,
                label: file.name,
                source: 'media',
                source_label: 'Media',
              },
              ...prev,
            ]
          : prev,
      );
      // Simpan juga ke katalog Media supaya bisa dipakai ulang di produk lain.
      try {
        const { data } = await api.post('/mobile-cms/media', {
          items: [{ url: info.url, label: file.name, width: info.width, height: info.height }],
        });
        onMediaAdded?.(data.items || []);
      } catch {
        /* gambar sudah terpasang; gagal mencatat ke Media tidak fatal */
      }
      toast.success('Gambar diunggah (WebP)');
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail) || 'Upload gambar gagal');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-1.5">
      {!!label && <Label className="text-xs text-muted-foreground">{label}</Label>}
      <div className="flex items-start gap-3">
        <div
          className={`${aspect} h-20 w-20 shrink-0 overflow-hidden rounded-md border border-border bg-secondary`}
        >
          {value ? (
            <img src={value} alt={label || 'Gambar'} className="h-full w-full object-contain" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
              Kosong
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={handleFile}
            className="hidden"
            data-testid={`${testId}-file`}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
            data-testid={`${testId}-upload`}
          >
            {busy ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-1 h-3.5 w-3.5" />}
            Upload
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setPickOpen(true)}
            data-testid={`${testId}-pick`}
          >
            <Images className="mr-1 h-3.5 w-3.5" /> Media
          </Button>
          {!!value && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => onChange('')}
              data-testid={`${testId}-clear`}
            >
              <X className="mr-1 h-3.5 w-3.5" /> Hapus
            </Button>
          )}
          {!!hint && <p className="w-full text-[11px] text-muted-foreground">{hint}</p>}
        </div>
      </div>

      <Dialog
        open={pickOpen}
        onOpenChange={(o) => {
          setPickOpen(o);
          if (!o) resetFilters();
        }}
      >
        <DialogContent
          className="flex max-h-[88vh] max-w-3xl flex-col gap-0 overflow-hidden p-0"
          data-testid={`${testId}-dialog`}
        >
          <DialogHeader className="space-y-1 border-b border-border px-5 py-4 text-left">
            <DialogTitle>Pilih dari Media</DialogTitle>
            <DialogDescription>
              Semua gambar yang tersimpan di database, dari Media, produk, kategori, galeri, jenis
              produk, sampai mockup custom.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 border-b border-border bg-muted/40 px-5 py-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cari nama gambar..."
                className="h-9 bg-background pl-9"
                data-testid={`${testId}-search`}
              />
            </div>
            {sources.length > 1 && (
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setSource('all')}
                  data-testid={`${testId}-source-all`}
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                    source === 'all'
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-background text-muted-foreground hover:border-primary/60 hover:text-foreground'
                  }`}
                >
                  Semua ({catalog.length})
                </button>
                {sources.map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => setSource(s.key)}
                    data-testid={`${testId}-source-${s.key}`}
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                      source === s.key
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-background text-muted-foreground hover:border-primary/60 hover:text-foreground'
                    }`}
                  >
                    {s.label} ({s.count})
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            {loadingAll ? (
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div key={i} className="space-y-1.5">
                    <div className="aspect-square animate-pulse rounded-lg bg-secondary" />
                    <div className="h-2.5 w-3/4 animate-pulse rounded bg-secondary" />
                  </div>
                ))}
              </div>
            ) : visible.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                <Images className="h-8 w-8 text-muted-foreground/60" />
                <p className="text-sm font-medium text-foreground">
                  {catalog.length === 0 ? 'Belum ada gambar di database' : 'Tidak ada yang cocok'}
                </p>
                <p className="max-w-xs text-xs text-muted-foreground">
                  {catalog.length === 0
                    ? 'Unggah gambar lewat tombol Upload di atas, lalu gambarnya langsung muncul di sini.'
                    : 'Coba kata kunci lain atau pilih kelompok Semua.'}
                </p>
                {catalog.length > 0 && (
                  <Button type="button" size="sm" variant="outline" onClick={resetFilters}>
                    Tampilkan semua
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
                {visible.map((m) => {
                  const active = value === m.url;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      title={`${m.label || 'Tanpa nama'}${m.source_label ? ` - ${m.source_label}` : ''}`}
                      onClick={() => {
                        onChange(m.url);
                        setPickOpen(false);
                        resetFilters();
                      }}
                      data-testid={`${testId}-option-${m.id}`}
                      className="group text-left"
                    >
                      <div
                        className={`relative aspect-square overflow-hidden rounded-lg border bg-secondary transition ${
                          active
                            ? 'border-primary ring-2 ring-primary/30'
                            : 'border-border group-hover:border-primary/70'
                        }`}
                      >
                        <img
                          src={m.url}
                          alt={m.label || 'Media'}
                          loading="lazy"
                          className="h-full w-full object-contain"
                        />
                        {active && (
                          <span className="absolute right-1 top-1 rounded-full bg-primary p-0.5 text-primary-foreground">
                            <Check className="h-3 w-3" />
                          </span>
                        )}
                      </div>
                      <p className="mt-1.5 truncate text-[11px] font-medium text-foreground">
                        {m.label || 'Tanpa nama'}
                      </p>
                      {!!m.source_label && (
                        <p className="truncate text-[10px] text-muted-foreground">{m.source_label}</p>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-border bg-muted/40 px-5 py-3">
            <p className="text-[11px] text-muted-foreground">
              {loadingAll ? 'Memuat...' : `${visible.length} dari ${catalog.length} gambar`}
            </p>
            <Button type="button" size="sm" variant="outline" onClick={() => setPickOpen(false)}>
              Tutup
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
