/* Custom Sticker — editor sederhana untuk menata sticker di lembar cetak 28 x 43 cm.
 *
 * Semua ukuran & posisi memakai satuan cm. Tata letak memakai algoritma shelf
 * (baris demi baris) sehingga sticker tidak pernah bertumpuk dan selalu berada
 * di dalam area cetak. Jarak antar sticker minimal GAP_CM.
 * Gambar tidak dipotong/didistorsi: rasio asli dipakai pada mode "Gambar Asli",
 * sedangkan mode lain (kotak/bulat/custom) memakai object-contain.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Upload, Trash2, LayoutGrid, RefreshCw } from "lucide-react";

const SHEET_W = 28; // cm
const SHEET_H = 43; // cm
const GAP_CM = 0.1; // jarak minimal antar sticker

const SHAPES = [
  { value: "original", label: "Gambar Asli" },
  { value: "square", label: "Kotak 1:1" },
  { value: "circle", label: "Bulat" },
  { value: "custom", label: "Ukuran Custom" },
];

/** Ukuran satu sticker (cm) sesuai mode bentuk. */
function stickerSize(img, shape, widthCm, customW, customH) {
  if (shape === "custom") return { w: customW, h: customH };
  if (shape === "square" || shape === "circle") return { w: widthCm, h: widthCm };
  const ratio = img.h > 0 ? img.h / img.w : 1; // tinggi ikut rasio asli
  return { w: widthCm, h: +(widthCm * ratio).toFixed(3) };
}

/** Tata sticker baris demi baris; ulangi gambar sampai lembar penuh. */
function arrange(images, shape, widthCm, customW, customH) {
  const placed = [];
  const notPlaced = [];
  if (!images.length) return { placed, notPlaced };

  const sizes = images.map((img) => ({ img, ...stickerSize(img, shape, widthCm, customW, customH) }));
  sizes.forEach((s) => {
    if (s.w <= 0 || s.h <= 0 || s.w > SHEET_W || s.h > SHEET_H) notPlaced.push(s.img);
  });
  const fit = sizes.filter((s) => s.w > 0 && s.h > 0 && s.w <= SHEET_W && s.h <= SHEET_H);
  if (!fit.length) return { placed, notPlaced };

  let x = 0;
  let y = 0;
  let rowH = 0;
  let i = 0;
  let guard = 0;
  while (guard++ < 5000) {
    const s = fit[i % fit.length];
    if (x + s.w > SHEET_W + 1e-9) {
      // pindah baris
      y += rowH + GAP_CM;
      x = 0;
      rowH = 0;
    }
    if (y + s.h > SHEET_H + 1e-9) break; // lembar penuh
    placed.push({ id: `${s.img.id}-${placed.length}`, src: s.img.src, x, y, w: s.w, h: s.h });
    x += s.w + GAP_CM;
    rowH = Math.max(rowH, s.h);
    i++;
  }
  return { placed, notPlaced };
}

export default function CustomSticker() {
  const [images, setImages] = useState([]);
  const [shape, setShape] = useState("original");
  const [widthCm, setWidthCm] = useState(4);
  const [customW, setCustomW] = useState(4);
  const [customH, setCustomH] = useState(4);
  const [layout, setLayout] = useState({ placed: [], notPlaced: [] });
  const fileRef = useRef(null);

  const num = (v, fallback) => {
    const n = parseFloat(String(v).replace(",", "."));
    return Number.isFinite(n) && n > 0 ? n : fallback;
  };

  const w = num(widthCm, 0);
  const cw = num(customW, 0);
  const ch = num(customH, 0);

  const doArrange = useCallback(() => {
    setLayout(arrange(images, shape, w, cw, ch));
  }, [images, shape, w, cw, ch]);

  // Hitung ulang otomatis setiap ukuran/bentuk/gambar berubah.
  useEffect(() => { doArrange(); }, [doArrange]);

  const onFiles = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    files.forEach((f) => {
      if (!f.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onload = () => {
        const src = reader.result;
        const el = new window.Image();
        el.onload = () => {
          setImages((prev) => [
            ...prev,
            { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, name: f.name, src, w: el.width, h: el.height },
          ]);
        };
        el.onerror = () => toast.error(`Gagal membaca ${f.name}`);
        el.src = src;
      };
      reader.readAsDataURL(f);
    });
    e.target.value = "";
  };

  const removeImage = (id) => setImages((prev) => prev.filter((i) => i.id !== id));

  const perImage = useMemo(() => {
    const map = {};
    layout.placed.forEach((p) => {
      const base = p.id.slice(0, p.id.lastIndexOf("-"));
      map[base] = (map[base] || 0) + 1;
    });
    return map;
  }, [layout.placed]);

  const sheetInfo = (img) => {
    const s = stickerSize(img, shape, w, cw, ch);
    return `${s.w.toFixed(2)} × ${s.h.toFixed(2)} cm`;
  };

  return (
    <div className="-m-4 space-y-6 bg-zinc-100 p-4 dark:bg-zinc-900 sm:-m-6 sm:p-6" data-testid="custom-sticker-page">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Sales Channel · Pesanan Merchandise</p>
        <h1 className="font-display text-3xl font-bold tracking-tight">Custom Sticker</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Lembar cetak {SHEET_W} × {SHEET_H} cm. Sticker ditata otomatis, jarak minimal {GAP_CM} cm, tidak bertumpuk dan tidak keluar area cetak.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
        {/* Panel pengaturan */}
        <div className="space-y-4">
          <div className="space-y-3 rounded-lg border border-border bg-card p-4">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-foreground">Template Sticker</Label>
              <div className="grid grid-cols-2 gap-2">
                {SHAPES.map((s) => (
                  <button
                    key={s.value}
                    onClick={() => setShape(s.value)}
                    data-testid={`sticker-shape-${s.value}`}
                    className={`rounded-md border px-2 py-2 text-xs font-semibold transition ${
                      shape === s.value ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {shape === "custom" ? (
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Lebar (cm)</Label>
                  <Input value={customW} onChange={(e) => setCustomW(e.target.value)} inputMode="decimal" data-testid="sticker-custom-width" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Tinggi (cm)</Label>
                  <Input value={customH} onChange={(e) => setCustomH(e.target.value)} inputMode="decimal" data-testid="sticker-custom-height" />
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">
                  {shape === "circle" ? "Diameter Sticker (cm)" : "Lebar Sticker (cm)"}
                </Label>
                <Input value={widthCm} onChange={(e) => setWidthCm(e.target.value)} inputMode="decimal" data-testid="sticker-width-input" />
                {shape === "original" && <p className="text-[11px] text-muted-foreground">Tinggi mengikuti rasio gambar asli.</p>}
              </div>
            )}

            <input ref={fileRef} type="file" accept="image/*" multiple onChange={onFiles} className="hidden" data-testid="sticker-file-input" />
            <Button className="w-full gap-2" onClick={() => fileRef.current?.click()} data-testid="sticker-upload-button">
              <Upload className="h-4 w-4" /> Unggah Gambar
            </Button>

            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" className="gap-2" onClick={doArrange} data-testid="sticker-auto-arrange">
                <LayoutGrid className="h-4 w-4" /> Auto Arrange
              </Button>
              <Button variant="outline" className="gap-2" onClick={() => { setImages([]); setLayout({ placed: [], notPlaced: [] }); }} data-testid="sticker-reset">
                <RefreshCw className="h-4 w-4" /> Kosongkan
              </Button>
            </div>

            <div className="rounded-md bg-secondary p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total sticker muat</span>
                <span className="font-bold" data-testid="sticker-total-placed">{layout.placed.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tidak muat</span>
                <span className="font-semibold" data-testid="sticker-not-placed">{layout.notPlaced.length}</span>
              </div>
            </div>
          </div>

          {/* Daftar gambar */}
          <div className="space-y-2 rounded-lg border border-border bg-card p-4">
            <h2 className="font-display text-base font-semibold">Gambar ({images.length})</h2>
            {images.length === 0 && <p className="text-sm text-muted-foreground">Belum ada gambar diunggah.</p>}
            {images.map((img) => {
              const notFit = layout.notPlaced.some((n) => n.id === img.id);
              return (
                <div key={img.id} className="flex items-center gap-2 rounded-md border border-border p-2" data-testid={`sticker-item-${img.id}`}>
                  <img src={img.src} alt={img.name} className="h-10 w-10 rounded object-contain" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold">{img.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {sheetInfo(img)} · {notFit ? <span className="font-semibold text-red-600">Tidak Muat</span> : `${perImage[img.id] || 0} pcs`}
                    </p>
                  </div>
                  <button onClick={() => removeImage(img.id)} className="text-muted-foreground hover:text-red-600" data-testid={`sticker-remove-${img.id}`}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Simulasi lembar cetak */}
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>Area cetak {SHEET_W} × {SHEET_H} cm</span>
            <span>{layout.placed.length} sticker</span>
          </div>
          <div className="mx-auto w-full max-w-[520px]">
            <div
              className="relative w-full overflow-hidden rounded-md bg-white shadow-sm"
              style={{ aspectRatio: `${SHEET_W} / ${SHEET_H}` }}
              data-testid="sticker-sheet"
            >
              {layout.placed.map((p) => (
                <img
                  key={p.id}
                  src={p.src}
                  alt="sticker"
                  className={`absolute bg-white object-contain ${shape === "circle" ? "rounded-full" : ""}`}
                  style={{
                    left: `${(p.x / SHEET_W) * 100}%`,
                    top: `${(p.y / SHEET_H) * 100}%`,
                    width: `${(p.w / SHEET_W) * 100}%`,
                    height: `${(p.h / SHEET_H) * 100}%`,
                  }}
                />
              ))}
              {layout.placed.length === 0 && (
                <p className="absolute inset-0 flex items-center justify-center text-sm text-zinc-400">
                  Unggah gambar untuk melihat simulasi
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
