/* Custom Sticker — dua alur terpisah dalam satu halaman:
 *
 *  1. Template / Estimasi : hitung perkiraan jumlah sticker yang muat di lembar
 *     28 x 43 cm memakai bentuk kosong berwarna biru (tanpa perlu unggah gambar).
 *  2. Upload Sticker Sendiri : gambar yang diunggah dipakai sebagai objek sticker
 *     (lebar default 4 cm, tinggi ikut rasio asli) lalu ditata otomatis.
 *
 * Semua ukuran & posisi dalam cm. Tata letak memakai shelf packing: jarak antar
 * sticker minimal GAP_CM, tidak pernah bertumpuk, dan selalu di dalam area cetak.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Upload, Trash2, LayoutGrid, RefreshCw, Send, ArrowLeft } from "lucide-react";
import api from "@/lib/api";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { STICKER_MATERIALS, stickerUnitPrice, stickerTotalPrice } from "@/lib/stickerPricing";

const rp = (n) => `Rp ${Number(n || 0).toLocaleString("id-ID")}`;

const SHEET_W = 28; // cm
const SHEET_H = 43; // cm
const GAP_CM = 0.1; // jarak minimal antar sticker

const TEMPLATES = [
  { value: "square", label: "Kotak 1:1" },
  { value: "circle", label: "Bulat" },
  { value: "custom", label: "Ukuran Custom" },
];

/** Shelf packing: isi lembar dengan daftar ukuran (cm) secara berulang. */
function packSheet(sizes, { repeat = true } = {}) {
  const placed = [];
  const rejected = [];
  const fit = [];
  sizes.forEach((s) => {
    if (s.w > 0 && s.h > 0 && s.w <= SHEET_W && s.h <= SHEET_H) fit.push(s);
    else rejected.push(s);
  });
  if (!fit.length) return { placed, rejected };

  let x = 0;
  let y = 0;
  let rowH = 0;
  let i = 0;
  let guard = 0;
  while (guard++ < 8000) {
    if (!repeat && i >= fit.length) break;
    const s = fit[i % fit.length];
    if (x + s.w > SHEET_W + 1e-9) {
      y += rowH + GAP_CM;
      x = 0;
      rowH = 0;
    }
    if (y + s.h > SHEET_H + 1e-9) {
      if (!repeat) rejected.push(...fit.slice(i));
      break;
    }
    placed.push({ key: `${s.id}-${placed.length}`, src: s.src, x, y, w: s.w, h: s.h, id: s.id });
    x += s.w + GAP_CM;
    rowH = Math.max(rowH, s.h);
    i++;
  }
  return { placed, rejected };
}

const toNum = (v) => {
  const n = parseFloat(String(v).replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : 0;
};

export default function CustomSticker({ publicMode = false }) {
  const [mode, setMode] = useState("template"); // 'template' | 'upload'

  // --- Template / Estimasi --------------------------------------------------
  const [template, setTemplate] = useState("square");
  const [sizeCm, setSizeCm] = useState(4); // sisi kotak / diameter bulat
  const [customW, setCustomW] = useState(4);
  const [customH, setCustomH] = useState(4);

  // --- Upload sticker sendiri ----------------------------------------------
  const [images, setImages] = useState([]);
  const [widthCm, setWidthCm] = useState(4);
  const fileRef = useRef(null);

  const [uploadLayout, setUploadLayout] = useState({ placed: [], rejected: [] });

  const tSize = useMemo(() => {
    if (template === "custom") return { w: toNum(customW), h: toNum(customH) };
    const d = toNum(sizeCm);
    return { w: d, h: d };
  }, [template, sizeCm, customW, customH]);

  // Estimasi bentuk kosong (tanpa gambar) — dihitung ulang tiap ukuran berubah.
  const templateLayout = useMemo(
    () => packSheet([{ id: "tpl", w: tSize.w, h: tSize.h }], { repeat: true }),
    [tSize],
  );

  const arrangeUpload = useCallback(() => {
    const w = toNum(widthCm);
    const sizes = images.map((img) => ({
      id: img.id,
      src: img.src,
      w,
      h: +(w * (img.h > 0 ? img.h / img.w : 1)).toFixed(3),
    }));
    setUploadLayout(packSheet(sizes, { repeat: true }));
  }, [images, widthCm]);

  useEffect(() => { arrangeUpload(); }, [arrangeUpload]);

  const onFiles = (e) => {
    const files = Array.from(e.target.files || []);
    files.forEach((f) => {
      if (!f.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onload = () => {
        const src = reader.result;
        const el = new window.Image();
        el.onload = () =>
          setImages((prev) => [
            ...prev,
            { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, name: f.name, src, w: el.width, h: el.height },
          ]);
        el.onerror = () => toast.error(`Gagal membaca ${f.name}`);
        el.src = src;
      };
      reader.readAsDataURL(f);
    });
    e.target.value = "";
  };

  const removeImage = (id) => setImages((prev) => prev.filter((i) => i.id !== id));

  // Jumlah salinan per gambar (satu desain diulang otomatis).
  const copies = useMemo(() => {
    const m = {};
    uploadLayout.placed.forEach((p) => { m[p.id] = (m[p.id] || 0) + 1; });
    return m;
  }, [uploadLayout.placed]);

  // --- Form pesan sticker ---------------------------------------------------
  const [material, setMaterial] = useState("BONTAX");
  const [sheets, setSheets] = useState(1);
  const [custName, setCustName] = useState("");
  const [custPhone, setCustPhone] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [preview, setPreview] = useState(null);
  const [doneOpen, setDoneOpen] = useState(false);

  const sheetQty = Math.max(0, Math.floor(Number(sheets) || 0));
  const unitPrice = stickerUnitPrice(material, sheetQty);
  const totalPrice = stickerTotalPrice(material, sheetQty);

  const isTemplate = mode === "template";
  const layout = isTemplate ? templateLayout : uploadLayout;
  const layoutCount = layout.placed.length;
  const uploadHeight = (img) => +(toNum(widthCm) * (img.h > 0 ? img.h / img.w : 1)).toFixed(2);

  // Render lembar cetak jadi 1 gambar (disimpan bersama pesanan).
  const buildPreview = () => {
    const W = 560;
    const H = Math.round((SHEET_H / SHEET_W) * W);
    const cv = document.createElement("canvas");
    cv.width = W; cv.height = H;
    const ctx = cv.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);
    const sx = W / SHEET_W;
    const sy = H / SHEET_H;
    const drawShapes = () => {
      layout.placed.forEach((p) => {
        const x = p.x * sx, y = p.y * sy, w = p.w * sx, h = p.h * sy;
        ctx.fillStyle = "rgba(59,130,246,0.30)";
        ctx.strokeStyle = "#2563eb";
        if (isTemplate && template === "circle") {
          ctx.beginPath();
          ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
          ctx.fill(); ctx.stroke();
        } else {
          ctx.fillRect(x, y, w, h);
          ctx.strokeRect(x, y, w, h);
        }
      });
    };
    if (isTemplate) {
      drawShapes();
      return Promise.resolve(cv.toDataURL("image/jpeg", 0.8));
    }
    // mode upload: gambar tiap salinan
    const cache = {};
    const loads = images.map(
      (img) =>
        new Promise((res) => {
          const el = new window.Image();
          el.onload = () => { cache[img.id] = el; res(); };
          el.onerror = () => res();
          el.src = img.src;
        }),
    );
    return Promise.all(loads).then(() => {
      layout.placed.forEach((p) => {
        const el = cache[p.id];
        if (el) ctx.drawImage(el, p.x * sx, p.y * sy, p.w * sx, p.h * sy);
      });
      return cv.toDataURL("image/jpeg", 0.8);
    });
  };

  const openSummary = async () => {
    if (!custName.trim() || !custPhone.trim()) return toast.error("Nama & nomor HP wajib diisi");
    if (sheetQty < 1) return toast.error("Jumlah lembar minimal 1");
    if (layoutCount === 0) return toast.error("Belum ada simulasi sticker pada kanvas");
    try {
      setPreview(await buildPreview());
    } catch {
      setPreview(null);
    }
    setSummaryOpen(true);
  };

  const submitOrder = async () => {
    if (!custName.trim() || !custPhone.trim()) return toast.error("Nama & nomor WhatsApp wajib diisi");
    if (sheetQty < 1) return toast.error("Jumlah lembar minimal 1");
    setSaving(true);
    try {
      const { data } = await api.post(publicMode ? "/public/sticker-orders" : "/sticker-orders", {
        customer_name: custName.trim(),
        customer_phone: custPhone.trim(),
        material,
        sheets: sheetQty,
        note: note.trim(),
        preview,
        layout: {
          mode,
          template: isTemplate ? template : "upload",
          width_cm: isTemplate ? tSize.w : toNum(widthCm),
          height_cm: isTemplate ? tSize.h : null,
          per_sheet: layoutCount,
        },
      });
      setSummaryOpen(false);
      setDoneOpen(true);
      toast.success(`Pesanan ${data.order_code} tersimpan`);
      setCustName(""); setCustPhone(""); setNote(""); setSheets(1);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Gagal menyimpan pesanan");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
    <div className="-m-4 space-y-6 bg-zinc-100 p-4 dark:bg-zinc-900 sm:-m-6 sm:p-6" data-testid="custom-sticker-page">
      <div>
        <a
          href={publicMode ? "/" : "/app"}
          data-testid="sticker-back-home"
          className="mb-3 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground transition hover:bg-secondary"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Kembali ke Home
        </a>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Sales Channel · Pesanan Merchandise</p>
        <h1 className="font-display text-3xl font-bold tracking-tight">Custom Sticker</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Lembar cetak {SHEET_W} × {SHEET_H} cm · jarak antar sticker {GAP_CM} cm · tidak bertumpuk & tidak keluar area cetak.
        </p>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[340px_1fr]">
        <div className="space-y-4">
          {/* Pilih alur kerja */}
          <div className="grid grid-cols-2 gap-2 rounded-lg border border-border bg-card p-2">
            <button
              onClick={() => setMode("template")}
              data-testid="sticker-mode-template"
              className={`rounded-md px-2 py-2 text-xs font-semibold transition ${isTemplate ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              Template / Estimasi
            </button>
            <button
              onClick={() => setMode("upload")}
              data-testid="sticker-mode-upload"
              className={`rounded-md px-2 py-2 text-xs font-semibold transition ${!isTemplate ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              Upload Sticker Sendiri
            </button>
          </div>

          {/* SECTION 1: Template / Estimasi */}
          {isTemplate && (
            <div className="space-y-3 rounded-lg border border-border bg-card p-4" data-testid="sticker-template-section">
              <div>
                <h2 className="font-display text-base font-semibold">Input Ukuran Lebar stiker (Tinggi Menyesuaikan)</h2>
                <p className="text-xs text-muted-foreground">Hitung perkiraan jumlah sticker tanpa perlu mengunggah gambar.</p>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {TEMPLATES.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => setTemplate(t.value)}
                    data-testid={`sticker-template-${t.value}`}
                    className={`rounded-md border px-2 py-2 text-xs font-semibold transition ${
                      template === t.value ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {template === "custom" ? (
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
                  <Label className="text-xs text-muted-foreground">{template === "circle" ? "Diameter (cm)" : "Sisi (cm)"}</Label>
                  <Input value={sizeCm} onChange={(e) => setSizeCm(e.target.value)} inputMode="decimal" data-testid="sticker-template-size" />
                </div>
              )}

              <div className="rounded-md bg-secondary p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Ukuran per sticker</span>
                  <span className="font-semibold">{tSize.w.toFixed(2)} × {tSize.h.toFixed(2)} cm</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Estimasi jumlah muat</span>
                  <span className="font-bold" data-testid="sticker-estimate-total">{templateLayout.placed.length}</span>
                </div>
              </div>
              {templateLayout.placed.length === 0 && (
                <p className="text-xs font-semibold text-red-600" data-testid="sticker-estimate-warning">
                  Ukuran tidak muat di area cetak {SHEET_W} × {SHEET_H} cm.
                </p>
              )}
            </div>
          )}

          {/* SECTION 2: Upload sticker sendiri */}
          {!isTemplate && (
            <div className="space-y-3 rounded-lg border border-border bg-card p-4" data-testid="sticker-upload-section">
              <div>
                <h2 className="font-display text-base font-semibold">Upload Sticker Sendiri</h2>
                <p className="text-xs text-muted-foreground">Gambar yang diunggah dipakai sebagai sticker asli. Tinggi mengikuti rasio gambar.</p>
              </div>

              <input ref={fileRef} type="file" accept="image/*" multiple onChange={onFiles} className="hidden" data-testid="sticker-file-input" />
              <Button className="w-full gap-2" onClick={() => fileRef.current?.click()} data-testid="sticker-upload-button">
                <Upload className="h-4 w-4" /> Unggah Gambar
              </Button>

              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Lebar Sticker (cm)</Label>
                <Input value={widthCm} onChange={(e) => setWidthCm(e.target.value)} inputMode="decimal" data-testid="sticker-width-input" />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" className="gap-2" onClick={arrangeUpload} data-testid="sticker-auto-arrange">
                  <LayoutGrid className="h-4 w-4" /> Auto Arrange
                </Button>
                <Button variant="outline" className="gap-2" onClick={() => setImages([])} data-testid="sticker-reset">
                  <RefreshCw className="h-4 w-4" /> Kosongkan
                </Button>
              </div>

              <div className="rounded-md bg-secondary p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sticker muat</span>
                  <span className="font-bold" data-testid="sticker-total-placed">{uploadLayout.placed.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tidak muat</span>
                  <span className="font-semibold" data-testid="sticker-not-placed">{uploadLayout.rejected.length}</span>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Gambar ({images.length})</h3>
                {images.length === 0 && <p className="text-sm text-muted-foreground">Belum ada gambar diunggah.</p>}
                {images.map((img) => {
                  const notFit = uploadLayout.rejected.some((r) => r.id === img.id);
                  return (
                    <div key={img.id} className="flex items-center gap-2 rounded-md border border-border p-2" data-testid={`sticker-item-${img.id}`}>
                      <img src={img.src} alt={img.name} className="h-10 w-10 rounded object-contain" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold">{img.name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {toNum(widthCm).toFixed(2)} × {uploadHeight(img).toFixed(2)} cm ·{" "}
                          {notFit ? <span className="font-semibold text-red-600">Tidak Muat</span> : `${copies[img.id] || 0} pcs`}
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
          )}

          {/* SECTION 3 dipindah ke bawah simulasi (lihat order-3) */}
        </div>

        {/* SECTION 3: Pilih jenis stiker */}
        <div className="order-3 space-y-3 self-start rounded-lg border border-border bg-card p-4" data-testid="sticker-order-form">
            <div>
              <h2 className="font-display text-base font-semibold">Pilih Jenis Stiker</h2>
              <p className="text-xs text-muted-foreground">Harga per lembar {SHEET_W} × {SHEET_H} cm, termasuk print + cut setengah putus. Beli ≥ 6 lembar potong Rp 2.000/lembar.</p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {STICKER_MATERIALS.map((m) => (
                <button
                  key={m.value}
                  onClick={() => setMaterial(m.value)}
                  data-testid={`sticker-material-${m.value}`}
                  className={`rounded-md border px-2 py-2 text-xs font-semibold transition ${
                    material === m.value ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {m.label}
                  <span className="block text-[10px] font-normal">{rp(m.price)}/lembar</span>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Jumlah Lembar</Label>
                <Input value={sheets} onChange={(e) => setSheets(e.target.value)} inputMode="numeric" data-testid="sticker-sheets" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Nama Pelanggan</Label>
                <Input value={custName} onChange={(e) => setCustName(e.target.value)} data-testid="sticker-customer-name" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Nomor WhatsApp</Label>
              <Input value={custPhone} onChange={(e) => setCustPhone(e.target.value)} inputMode="tel" data-testid="sticker-customer-phone" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Catatan (opsional)</Label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} data-testid="sticker-note" />
            </div>

            <div className="rounded-md bg-secondary p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Harga / lembar</span>
                <span className="font-semibold" data-testid="sticker-unit-price">{rp(unitPrice)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total ({sheetQty} lembar)</span>
                <span className="font-bold" data-testid="sticker-total-price">{rp(totalPrice)}</span>
              </div>
            </div>

            <Button className="w-full gap-2" onClick={openSummary} data-testid="sticker-submit-order">
              <Send className="h-4 w-4" /> Pesan Sekarang
            </Button>
        </div>

        {/* Kanvas lembar cetak */}
        <div className="order-2 self-start rounded-lg border border-border bg-card p-4">
          <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>{isTemplate ? "Simulasi estimasi" : "Sticker hasil unggahan"}</span>
            <span>{layout.placed.length} sticker</span>
          </div>
          <div className="mx-auto w-full max-w-[520px]">
            <div
              className="relative w-full overflow-hidden rounded-md bg-white shadow-sm"
              style={{ aspectRatio: `${SHEET_W} / ${SHEET_H}` }}
              data-testid="sticker-sheet"
            >
              {layout.placed.map((p) => {
                const style = {
                  left: `${(p.x / SHEET_W) * 100}%`,
                  top: `${(p.y / SHEET_H) * 100}%`,
                  width: `${(p.w / SHEET_W) * 100}%`,
                  height: `${(p.h / SHEET_H) * 100}%`,
                };
                return isTemplate ? (
                  <div
                    key={p.key}
                    className={`absolute border border-blue-600 bg-blue-500/30 ${template === "circle" ? "rounded-full" : "rounded-[2px]"}`}
                    style={style}
                    data-testid="sticker-estimate-shape"
                  />
                ) : (
                  <img key={p.key} src={p.src} alt="sticker" className="absolute object-contain" style={style} />
                );
              })}
              {layout.placed.length === 0 && (
                <p className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-zinc-400">
                  {isTemplate ? "Masukkan ukuran template untuk melihat estimasi" : "Unggah gambar untuk melihat simulasi"}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>

      {/* Ringkasan pesanan sebelum dikirim */}
      <Dialog open={summaryOpen} onOpenChange={setSummaryOpen}>
        <DialogContent className="max-w-lg" data-testid="sticker-summary-dialog">
          <DialogHeader>
            <DialogTitle>Ringkasan Pesanan</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <Row label="Nama Pelanggan" value={custName} />
            <Row label="No. HP" value={custPhone} />
            <Row label="Bahan Sticker" value={STICKER_MATERIALS.find((m) => m.value === material)?.label} />
            <Row
              label="Ukuran Sticker"
              value={isTemplate ? `${tSize.w.toFixed(2)} × ${tSize.h.toFixed(2)} cm (${template})` : `lebar ${toNum(widthCm).toFixed(2)} cm (rasio asli)`}
            />
            <Row label="Jumlah Sticker" value={`${layoutCount} pcs/lembar · ${sheetQty} lembar`} />
            <Row label="Harga / lembar" value={rp(unitPrice)} />
            <Row label="Total" value={rp(totalPrice)} />
            {note.trim() && <Row label="Catatan" value={note} />}
            <div className="rounded-md border border-border bg-white p-2">
              {preview ? (
                <img src={preview} alt="Preview lembar" className="mx-auto max-h-64 w-auto" data-testid="sticker-summary-preview" />
              ) : (
                <p className="text-center text-xs text-muted-foreground">Preview tidak tersedia</p>
              )}
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setSummaryOpen(false)} data-testid="sticker-summary-cancel">Batal</Button>
            <Button onClick={submitOrder} disabled={saving} data-testid="sticker-summary-order">
              {saving ? "Mengirim..." : "Order"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Konfirmasi pesanan diterima */}
      <Dialog open={doneOpen} onOpenChange={setDoneOpen}>
        <DialogContent className="max-w-md" data-testid="sticker-done-dialog">
          <DialogHeader>
            <DialogTitle>Pesanan Diterima</DialogTitle>
          </DialogHeader>
          <p className="text-sm">
            Pesanan sudah diterima. CS kami akan segera menghubungi Anda untuk proses pembayaran. Pastikan nama dan nomor HP yang tercantum sudah benar.
          </p>
          <DialogFooter>
            <Button onClick={() => setDoneOpen(false)} data-testid="sticker-done-close">Tutup</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-semibold">{value || "-"}</span>
    </div>
  );
}
