'use client';
/** Tab Categories — kategori yang tampil di baris kategori halaman HP. */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, GripVertical, ChevronUp, ChevronDown, Tags } from 'lucide-react';
import api, { formatApiError } from '@/lib/api';
import { moveItem, useDragSort } from '@/lib/mobileCmsClient';
import ImagePicker from '@/components/mobilecms/ImagePicker';

export default function CategoriesPanel({ draft, reload, onMediaAdded }) {
  const cats = draft?.categories || [];
  const media = draft?.media || [];
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ name: '', image: '', is_active: true });
  const [delTarget, setDelTarget] = useState(null);

  const persistOrder = async (ids) => {
    try {
      await api.patch('/mobile-cms/categories', { ids });
      await reload();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || 'Gagal menyimpan urutan');
    }
  };

  const { handlers, dropClass } = useDragSort(
    cats.map((c) => c.id),
    persistOrder,
  );

  const save = async () => {
    if (!form.name.trim()) return toast.error('Nama kategori wajib diisi');
    try {
      if (editId) await api.put(`/mobile-cms/categories/${editId}`, form);
      else await api.post('/mobile-cms/categories', form);
      toast.success('Kategori disimpan');
      setOpen(false);
      await reload();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || 'Gagal menyimpan kategori');
    }
  };

  const confirmDelete = async () => {
    try {
      await api.delete(`/mobile-cms/categories/${delTarget.id}`);
      toast.success('Kategori dihapus (soft delete)');
      setDelTarget(null);
      await reload();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || 'Gagal menghapus kategori');
    }
  };

  return (
    <div className="space-y-4" data-testid="cms-categories-panel">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {cats.length} kategori · tarik untuk mengubah posisi di halaman HP
        </p>
        <Button
          size="sm"
          onClick={() => {
            setEditId(null);
            setForm({ name: '', image: '', is_active: true });
            setOpen(true);
          }}
          data-testid="cms-category-add"
        >
          <Plus className="mr-1 h-4 w-4" /> Tambah Kategori
        </Button>
      </div>

      {cats.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center" data-testid="cms-category-empty">
          <Tags className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">Belum ada kategori untuk storefront HP.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {cats.map((c, i) => (
            <div
              key={c.id}
              {...handlers(i)}
              className={`flex items-center gap-3 rounded-lg border border-border bg-card p-3 ${dropClass(i)}`}
              data-testid={`cms-category-row-${c.id}`}
            >
              <span className="cursor-grab text-muted-foreground">
                <GripVertical className="h-4 w-4" />
              </span>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary">
                {c.image ? (
                  <img src={c.image} alt={c.name} className="h-full w-full object-cover" />
                ) : (
                  <span className="text-sm font-bold text-muted-foreground">
                    {(c.name || '?').slice(0, 1).toUpperCase()}
                  </span>
                )}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{c.name}</div>
                <div className="text-[11px] text-muted-foreground">{c.is_active ? 'Tampil di HP' : 'Disembunyikan'}</div>
              </div>
              <Button
                size="icon"
                variant="ghost"
                disabled={i === 0}
                onClick={() => persistOrder(moveItem(cats.map((x) => x.id), i, i - 1))}
                data-testid={`cms-category-up-${c.id}`}
              >
                <ChevronUp className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                disabled={i === cats.length - 1}
                onClick={() => persistOrder(moveItem(cats.map((x) => x.id), i, i + 1))}
                data-testid={`cms-category-down-${c.id}`}
              >
                <ChevronDown className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => {
                  setEditId(c.id);
                  setForm({ name: c.name, image: c.image, is_active: c.is_active });
                  setOpen(true);
                }}
                data-testid={`cms-category-edit-${c.id}`}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => setDelTarget(c)} data-testid={`cms-category-delete-${c.id}`}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md" data-testid="cms-category-dialog">
          <DialogHeader>
            <DialogTitle>{editId ? 'Edit Kategori' : 'Tambah Kategori'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Nama Kategori *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                data-testid="cms-category-name"
              />
            </div>
            <ImagePicker
              label="Ikon / Gambar Kategori"
              value={form.image}
              onChange={(v) => setForm((f) => ({ ...f, image: v }))}
              media={media}
              onMediaAdded={onMediaAdded}
              kind="category"
              testId="cms-category-image"
            />
            <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
              <Label className="text-xs text-muted-foreground">Tampilkan di HP</Label>
              <Switch
                checked={form.is_active}
                onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))}
                data-testid="cms-category-active"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} data-testid="cms-category-cancel">
              Batal
            </Button>
            <Button onClick={save} data-testid="cms-category-save">
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!delTarget} onOpenChange={(v) => !v && setDelTarget(null)}>
        <DialogContent className="max-w-md" data-testid="cms-category-delete-dialog">
          <DialogHeader>
            <DialogTitle>Hapus kategori ini?</DialogTitle>
            <DialogDescription>
              {delTarget?.name} akan dihapus (soft delete). Produk yang memakainya otomatis menjadi “Tanpa kategori”.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDelTarget(null)} data-testid="cms-category-delete-cancel">
              Batal
            </Button>
            <Button variant="destructive" onClick={confirmDelete} data-testid="cms-category-delete-confirm">
              Ya, Hapus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
