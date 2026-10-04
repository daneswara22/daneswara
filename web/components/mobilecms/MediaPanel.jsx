'use client';
/**
 * Tab Media — katalog gambar yang bisa dipakai ulang di produk, banner, dan
 * kategori. Unggahan memakai endpoint existing /api/upload (WebP → R2), jadi
 * ukuran gambar sudah dioptimalkan untuk HP tanpa crop paksa (object-contain).
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Upload, Trash2, GripVertical, Loader2, Copy, Images } from 'lucide-react';
import api, { formatApiError, uploadImage } from '@/lib/api';
import { useDragSort } from '@/lib/mobileCmsClient';

export default function MediaPanel({ draft, reload }) {
  const media = draft?.media || [];
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [delTarget, setDelTarget] = useState(null);

  const persistOrder = async (ids) => {
    try {
      await api.patch('/mobile-cms/media', { ids });
      await reload();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || 'Gagal menyimpan urutan');
    }
  };

  const { handlers, dropClass } = useDragSort(
    media.map((m) => m.id),
    persistOrder,
  );

  const uploadMany = async (files) => {
    const list = Array.from(files || []).filter((f) => f.type.startsWith('image/'));
    if (!list.length) return toast.error('Pilih berkas gambar');
    setBusy(true);
    const items = [];
    for (const file of list) {
      try {
        const info = await uploadImage(file, 'product');
        items.push({ url: info.url, label: file.name, width: info.width, height: info.height });
      } catch (err) {
        toast.error(`${file.name}: ${formatApiError(err.response?.data?.detail) || 'gagal diunggah'}`);
      }
    }
    if (items.length) {
      try {
        await api.post('/mobile-cms/media', { items });
        toast.success(`${items.length} gambar masuk ke Media`);
        await reload();
      } catch (e) {
        toast.error(formatApiError(e.response?.data?.detail) || 'Gagal menyimpan media');
      }
    }
    setBusy(false);
  };

  const confirmDelete = async () => {
    try {
      await api.delete(`/mobile-cms/media/${delTarget.id}`);
      toast.success('Gambar dihapus dari katalog Media');
      setDelTarget(null);
      await reload();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || 'Gagal menghapus media');
    }
  };

  const rename = async (m, label) => {
    try {
      await api.put(`/mobile-cms/media/${m.id}`, { label });
      await reload();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || 'Gagal mengganti nama');
    }
  };

  return (
    <div className="space-y-4" data-testid="cms-media-panel">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer?.files?.length) uploadMany(e.dataTransfer.files);
        }}
        className={`rounded-lg border-2 border-dashed p-6 text-center transition ${
          dragOver ? 'border-primary bg-primary/5' : 'border-border bg-card'
        }`}
        data-testid="cms-media-dropzone"
      >
        <Images className="mx-auto h-7 w-7 text-muted-foreground" />
        <p className="mt-2 text-sm font-medium">Tarik & lepas gambar ke sini</p>
        <p className="text-[11px] text-muted-foreground">
          Gambar otomatis diubah ke WebP dan diskalakan untuk tampilan HP (tanpa crop paksa).
        </p>
        <input
          id="cms-media-input"
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            const files = e.target.files;
            e.target.value = '';
            uploadMany(files);
          }}
          data-testid="cms-media-input"
        />
        <Button
          size="sm"
          className="mt-3"
          disabled={busy}
          onClick={() => document.getElementById('cms-media-input')?.click()}
          data-testid="cms-media-browse"
        >
          {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Upload className="mr-1 h-4 w-4" />}
          Upload Gambar
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">{media.length} gambar · tarik kartu untuk mengubah urutan</p>

      {media.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {media.map((m, i) => (
            <div
              key={m.id}
              {...handlers(i)}
              className={`overflow-hidden rounded-lg border border-border bg-card ${dropClass(i)}`}
              data-testid={`cms-media-item-${m.id}`}
            >
              <div className="relative bg-secondary">
                <img src={m.url} alt={m.label || 'Media'} className="aspect-square w-full object-contain" />
                <span className="absolute left-1.5 top-1.5 cursor-grab rounded bg-black/55 p-1 text-white">
                  <GripVertical className="h-3 w-3" />
                </span>
              </div>
              <div className="space-y-2 p-2">
                <Input
                  defaultValue={m.label}
                  placeholder="Nama gambar"
                  className="h-8 text-xs"
                  onBlur={(e) => e.target.value !== m.label && rename(m, e.target.value)}
                  data-testid={`cms-media-label-${m.id}`}
                />
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">
                    {m.width && m.height ? `${m.width}×${m.height}` : 'WebP'}
                  </span>
                  <div className="flex gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      title="Salin URL"
                      onClick={() => {
                        navigator.clipboard?.writeText(m.url);
                        toast.success('URL gambar disalin');
                      }}
                      data-testid={`cms-media-copy-${m.id}`}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => setDelTarget(m)}
                      data-testid={`cms-media-delete-${m.id}`}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!delTarget} onOpenChange={(v) => !v && setDelTarget(null)}>
        <DialogContent className="max-w-md" data-testid="cms-media-delete-dialog">
          <DialogHeader>
            <DialogTitle>Hapus gambar ini dari Media?</DialogTitle>
            <DialogDescription>
              Gambar hanya dilepas dari katalog Media. Produk yang sudah memakai URL-nya tidak berubah.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDelTarget(null)} data-testid="cms-media-delete-cancel">
              Batal
            </Button>
            <Button variant="destructive" onClick={confirmDelete} data-testid="cms-media-delete-confirm">
              Ya, Hapus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
