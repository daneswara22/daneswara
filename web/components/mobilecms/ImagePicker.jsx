'use client';
/**
 * Pemilih satu gambar: unggah baru, pilih dari Media, atau kosongkan.
 * Unggahan tetap memakai endpoint existing POST /api/upload (sharp -> WebP -> R2).
 */
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Upload, X, Images, Loader2 } from 'lucide-react';
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

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) return toast.error('File harus berupa gambar');
    setBusy(true);
    try {
      const info = await uploadImage(file, kind);
      onChange(info.url);
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

      <Dialog open={pickOpen} onOpenChange={setPickOpen}>
        <DialogContent className="max-w-2xl" data-testid={`${testId}-dialog`}>
          <DialogHeader>
            <DialogTitle>Pilih dari Media</DialogTitle>
          </DialogHeader>
          {media.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Belum ada gambar di Media. Unggah dulu lewat tab Media atau tombol Upload di atas.
            </p>
          ) : (
            <div className="grid max-h-[60vh] grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-5">
              {media.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    onChange(m.url);
                    setPickOpen(false);
                  }}
                  data-testid={`${testId}-option-${m.id}`}
                  className="overflow-hidden rounded-md border border-border bg-secondary transition hover:border-primary"
                >
                  <img src={m.url} alt={m.label || 'Media'} className="aspect-square w-full object-contain" />
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
