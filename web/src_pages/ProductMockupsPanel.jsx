/**
 * Kelola Mockup — panel per jenis produk (dipakai dari halaman Jenis Produk).
 * ---------------------------------------------------------------------------
 * Mockup disimpan di tabel `custom_mockups` dengan slot
 * (product_key + warna + tampak/view) — struktur yang sama yang dipakai
 * desainer /custom untuk menampilkan gambar produk. Jadi begitu admin
 * mengunggah mockup di sini, desainer langsung memakainya untuk produk itu.
 *
 * Admin bisa: unggah, ganti, ubah nama, atur urutan, hapus, dan menjadikan
 * salah satu mockup sebagai thumbnail utama produk (dipakai sebagai kartu
 * produk di menu Custom).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import api, { formatApiError, uploadImage } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { UploadCloud, Loader2, Trash2, ImageOff, Star, Check } from "lucide-react";

const VIEWS = [
  { id: "front", label: "Depan" },
  { id: "back", label: "Belakang" },
  { id: "left", label: "Kiri" },
  { id: "right", label: "Kanan" },
  { id: "label", label: "Label" },
];

const DEFAULT_COLOR = { name: "Default", hex: "#FFFFFF" };
const slotKey = (hex, view) => `${String(hex || "").toUpperCase()}::${view}`;

export default function ProductMockupsPanel({ product, onClose, onChanged }) {
  const open = !!product;
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState("front");
  const [busy, setBusy] = useState("");          // slot/id yang sedang diproses
  const [names, setNames] = useState({});        // draft nama per mockup id

  const productKey = product?.product_key || "";

  const load = useCallback(async () => {
    if (!productKey) return;
    setLoading(true);
    try {
      const { data } = await api.get(`/mockups?product_key=${encodeURIComponent(productKey)}`);
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    } finally {
      setLoading(false);
    }
  }, [productKey]);

  useEffect(() => { if (open) { setView("front"); setNames({}); load(); } }, [open, load]);

  const colors = useMemo(() => {
    const list = (product?.colors || []).filter((c) => c.hex);
    return list.length ? list : [DEFAULT_COLOR];
  }, [product]);

  const bySlot = useMemo(() => {
    const m = new Map();
    for (const it of items) m.set(slotKey(it.color_hex, it.view), it);
    return m;
  }, [items]);

  const upload = async (color, file) => {
    if (!file) return;
    if (!/^image\/(png|jpe?g|webp)$/i.test(file.type)) {
      return toast.error("Format harus PNG, JPG, JPEG, atau WEBP");
    }
    if (file.size > 15 * 1024 * 1024) return toast.error("Ukuran maksimal 15MB");
    const slot = slotKey(color.hex, view);
    setBusy(slot);
    try {
      const info = await uploadImage(file, "mockup");
      const { data } = await api.post("/mockups", {
        product_key: productKey,
        view,
        color_hex: color.hex.toUpperCase(),
        color_name: color.name || "Default",
        image: info.url,
      });
      setItems((prev) => {
        const rest = prev.filter((x) => slotKey(x.color_hex, x.view) !== slot);
        return [...rest, data];
      });
      onChanged && onChanged();
      toast.success("Mockup tersimpan");
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || "Upload gagal");
    } finally {
      setBusy("");
    }
  };

  const remove = async (row) => {
    if (!window.confirm(`Hapus mockup "${row.color_name} · ${row.view}"?`)) return;
    setBusy(row.id);
    try {
      await api.delete(`/mockups/${row.id}`);
      setItems((prev) => prev.filter((x) => x.id !== row.id));
      onChanged && onChanged();
      toast.success("Mockup dihapus");
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    } finally {
      setBusy("");
    }
  };

  const patch = async (row, payload) => {
    setBusy(row.id);
    try {
      const { data } = await api.patch(`/mockups/${row.id}`, payload);
      setItems((prev) => prev.map((x) => (x.id === row.id ? data : x)));
      toast.success("Mockup diperbarui");
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    } finally {
      setBusy("");
    }
  };

  const setPrimary = async (row) => {
    setBusy(row.id);
    try {
      const { data } = await api.put(`/custom-products/${product.id}`, { thumbnail_url: row.image_url });
      onChanged && onChanged(data);
      toast.success("Dijadikan mockup utama (thumbnail produk)");
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    } finally {
      setBusy("");
    }
  };

  if (!open) return null;

  const perView = VIEWS.map((v) => ({ ...v, count: items.filter((x) => x.view === v.id).length }));

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto" data-testid="mockup-panel">
        <DialogHeader>
          <DialogTitle>Mockup Produk — {product.title}</DialogTitle>
          <DialogDescription>
            Unggah mockup untuk tiap tampak & varian warna. Gambar ini yang dipakai desainer
            <span className="font-semibold"> Custom</span> saat pelanggan memilih produk ini.
            Format PNG (transparan didukung), JPG, JPEG, atau WEBP — maksimal 15MB, dikonversi ke WebP.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" data-testid="mockup-total">{items.length} mockup</Badge>
          {items.length === 0 && (
            <span className="text-xs font-semibold text-amber-600">
              Minimal 1 mockup diperlukan sebelum produk bisa diaktifkan.
            </span>
          )}
        </div>

        <Tabs value={view} onValueChange={setView} className="mt-2">
          <TabsList className="flex w-full flex-wrap">
            {perView.map((v) => (
              <TabsTrigger key={v.id} value={v.id} data-testid={`mockup-view-${v.id}`}>
                {v.label} ({v.count})
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {loading ? (
          <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Memuat mockup…
          </div>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {colors.map((c) => {
              const slot = slotKey(c.hex, view);
              const row = bySlot.get(slot);
              const isBusy = busy === slot || (row && busy === row.id);
              const isPrimary = !!row && product.thumbnail_url && product.thumbnail_url === row.image_url;
              const inputId = `mockup-file-${slot.replace(/[^a-zA-Z0-9]/g, "")}`;
              return (
                <div
                  key={slot}
                  className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3"
                  data-testid={`mockup-slot-${c.hex.replace("#", "")}-${view}`}
                >
                  <div className="flex items-center gap-2">
                    <span className="h-4 w-4 rounded-full border border-border" style={{ backgroundColor: c.hex }} />
                    <span className="truncate text-sm font-semibold">{c.name}</span>
                    {isPrimary && (
                      <Badge className="ml-auto" data-testid="mockup-primary-badge">
                        <Star className="mr-1 h-3 w-3" /> Utama
                      </Badge>
                    )}
                  </div>

                  <div className="flex h-36 items-center justify-center overflow-hidden rounded-lg border border-dashed border-border bg-muted/40">
                    {row?.image_url ? (
                      <img src={row.image_url} alt={row.color_name} className="h-full w-full object-contain" />
                    ) : (
                      <div className="flex flex-col items-center text-xs text-muted-foreground">
                        <ImageOff className="mb-1 h-6 w-6" /> Belum ada mockup
                      </div>
                    )}
                  </div>

                  {row && (
                    <div className="grid grid-cols-[1fr_72px] gap-2">
                      <Input
                        value={names[row.id] ?? row.color_name}
                        onChange={(e) => setNames((n) => ({ ...n, [row.id]: e.target.value }))}
                        onBlur={() => {
                          const v = (names[row.id] ?? row.color_name).trim();
                          if (v && v !== row.color_name) patch(row, { color_name: v });
                        }}
                        placeholder="Nama mockup"
                        data-testid={`mockup-name-${row.id}`}
                      />
                      <Input
                        type="number"
                        min={0}
                        defaultValue={row.sort_order || 0}
                        onBlur={(e) => {
                          const v = Number(e.target.value) || 0;
                          if (v !== (row.sort_order || 0)) patch(row, { sort_order: v });
                        }}
                        title="Urutan"
                        data-testid={`mockup-sort-${row.id}`}
                      />
                    </div>
                  )}

                  <div className="flex flex-wrap gap-1.5">
                    <input
                      id={inputId}
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/webp"
                      className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; upload(c, f); }}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isBusy}
                      onClick={() => document.getElementById(inputId)?.click()}
                      data-testid={`mockup-upload-${c.hex.replace("#", "")}-${view}`}
                    >
                      {isBusy ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <UploadCloud className="mr-1 h-3.5 w-3.5" />}
                      {row ? "Ganti" : "Unggah"}
                    </Button>
                    {row && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isBusy || isPrimary}
                          onClick={() => setPrimary(row)}
                          data-testid={`mockup-primary-${row.id}`}
                        >
                          {isPrimary ? <Check className="mr-1 h-3.5 w-3.5" /> : <Star className="mr-1 h-3.5 w-3.5" />}
                          Utama
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive"
                          disabled={isBusy}
                          onClick={() => remove(row)}
                          data-testid={`mockup-delete-${row.id}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} data-testid="mockup-panel-close">Tutup</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
