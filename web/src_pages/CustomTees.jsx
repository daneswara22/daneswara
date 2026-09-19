/**
 * Custom Tees — Desainer Kaos
 * ---------------------------------------------------
 * Tahap 1 = layout statis. Tahap 2 (ini) mengaktifkan tool "Gambar Saya":
 *   - Customer bisa upload gambar sendiri (PNG / JPG).
 *   - Gambar bisa digeser (drag), diperbesar/diperkecil (resize), dan diputar (rotary).
 * Objek disimpan per-tampilan (Depan/Belakang/Lengan) sehingga desain tiap sisi terpisah.
 *
 * Skala warna dibuat eksplisit (light theme) supaya persis seperti rancangan,
 * tidak terpengaruh mode gelap admin.
 */
import { useState, useRef, useEffect, useCallback, useLayoutEffect, useId } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import api, { formatApiError } from "@/lib/api";
import {
  Shirt, Upload, Type, Shapes, ImageIcon, LayoutTemplate, Layers,
  Undo2, Redo2, Save, HelpCircle, ChevronRight, ChevronDown, Check,
  Minus, Plus, RotateCcw, RotateCw, ArrowRight, LifeBuoy, Trash2, X, Move,
  Bold, Italic, AlignLeft, AlignCenter, AlignRight, Search, Loader2,
  ArrowUp, ArrowDown, ChevronsUp, ChevronsDown,
} from "lucide-react";

/* ---------- gambar mockup kaos (WebP ringan) per tampilan ---------- */
const MOCKUPS = {
  "Depan": "/mockups/depan.webp",
  "Belakang": "/mockups/belakang.webp",
  "Lengan Kiri": "/mockups/lengan-kiri.webp",
  "Lengan Kanan": "/mockups/lengan-kanan.webp",
};

/**
 * Mask alpha per tampilan (area kaos putih saja) untuk pewarnaan real-time.
 */
const MOCKUP_MASKS = {
  "Depan": "/mockups/depan-mask.webp",
  "Belakang": "/mockups/belakang-mask.webp",
  "Lengan Kiri": "/mockups/lengan-kiri-mask.webp",
  "Lengan Kanan": "/mockups/lengan-kanan-mask.webp",
};

const SIZES = ["S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL"];
const COLOR_TABS = ["Populer", "Netral", "Merah", "Biru", "Hijau", "Lainnya"];
const SWATCHES = [
  { name: "Putih",        hex: "#ffffff" },
  { name: "Hitam",        hex: "#111111" },
  { name: "Abu Muda",     hex: "#cbd0d6" },
  { name: "Navy",         hex: "#2b3a67" },
  { name: "Maroon",       hex: "#5b1f1f" },
  { name: "Merah",        hex: "#c0392b" },
  { name: "Hijau Tua",    hex: "#2e7d32" },
  { name: "Kuning",       hex: "#f1c40f" },
  { name: "Hijau Daun",   hex: "#27ae60" },
  { name: "Oranye",       hex: "#e67e22" },
  { name: "Olive Tua",    hex: "#3b3b2f" },
  { name: "Olive",        hex: "#7a7a2e" },
  { name: "Baby Blue",    hex: "#8ec7f0" },
  { name: "Baby Pink",    hex: "#f4b8cf" },
  { name: "Krem",         hex: "#d8c3a5" },
  { name: "Ungu",         hex: "#7d3cc9" },
  { name: "Biru Royal",   hex: "#1f3fae" },
  { name: "Tosca",        hex: "#2ea67a" },
];
const VIEWS = ["Depan", "Belakang", "Lengan Kiri", "Lengan Kanan"];

/* ---------- tool rail ---------- */
const TOOLS = [
  { icon: Shirt, label: "Produk", sub: "Warna & Ukuran" },
  { icon: Type, label: "Teks", sub: "Tambah Tulisan" },
  { icon: Shapes, label: "Clipart", sub: "Gambar & Bentuk" },
  { icon: ImageIcon, label: "Gambar Saya", sub: "File yang diupload" },
  { icon: Layers, label: "Layer", sub: "Atur Urutan Objek" },
];

const STEPS = ["Produk", "Desain", "Preview", "Pesanan"];

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const emptyDesign = () => ({ "Depan": [], "Belakang": [], "Lengan Kiri": [], "Lengan Kanan": [] });

/* ---------- teks: pilihan font & warna ---------- */
const FONTS = [
  { label: "Sans (Default)", value: '"Inter", "Helvetica Neue", Arial, sans-serif' },
  { label: "Serif", value: 'Georgia, "Times New Roman", serif' },
  { label: "Mono", value: '"Courier New", ui-monospace, monospace' },
  { label: "Impact", value: 'Impact, "Arial Black", sans-serif' },
  { label: "Arial Black", value: '"Arial Black", Gadget, sans-serif' },
  { label: "Script", value: '"Brush Script MT", "Segoe Script", cursive' },
  { label: "Comic", value: '"Comic Sans MS", "Comic Neue", cursive' },
  { label: "Trebuchet", value: '"Trebuchet MS", Verdana, sans-serif' },
];
const TEXT_COLORS = [
  "#111111", "#ffffff", "#c0392b", "#e67e22", "#f1c40f",
  "#27ae60", "#1f3fae", "#7d3cc9", "#2ea67a", "#f4b8cf",
];
// canvas tinggi = 62vh; fontSize teks = (wPct/100) * 62vh agar skala relatif terhadap kaos
const CANVAS_VH = 62;
const textFontVh = (wPct) => (wPct / 100) * CANVAS_VH;
const isTextLayer = (l) => l && l.type === "text";

export default function CustomTees() {
  const navigate = useNavigate();
  const [view, setView] = useState("Depan");
  const [color, setColor] = useState(SWATCHES[0]); // Putih (default)
  const isWhite = color.hex.toLowerCase() === "#ffffff";

  const [activeTool, setActiveTool] = useState("Produk");
  // Desain objek per-tampilan: { [view]: [ {id, src, cx, cy, wPct, rot} ] }
  const [design, setDesign] = useState(emptyDesign);
  const [selectedId, setSelectedId] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const gesture = useRef(null); // { mode, id, view, ... }

  const layers = design[view] || [];
  const selectedLayer = layers.find((l) => l.id === selectedId) || null;

  /* ---------- update satu objek pada tampilan tertentu ---------- */
  const applyPatch = useCallback((viewName, id, patch) => {
    setDesign((d) => ({
      ...d,
      [viewName]: (d[viewName] || []).map((l) => (l.id === id ? { ...l, ...patch } : l)),
    }));
  }, []);

  /* ---------- pointer gestures (drag / resize / rotate) ---------- */
  useEffect(() => {
    const onMove = (e) => {
      const g = gesture.current;
      if (!g) return;
      if (g.mode === "move") {
        const dx = ((e.clientX - g.startX) / g.rectW) * 100;
        const dy = ((e.clientY - g.startY) / g.rectH) * 100;
        applyPatch(g.view, g.id, { cx: clamp(g.startCx + dx, 0, 100), cy: clamp(g.startCy + dy, 0, 100) });
      } else if (g.mode === "resize") {
        const dist = Math.hypot(e.clientX - g.centerX, e.clientY - g.centerY);
        const scale = g.startDist > 0 ? dist / g.startDist : 1;
        applyPatch(g.view, g.id, { wPct: clamp(g.startW * scale, 5, 130) });
      } else if (g.mode === "rotate") {
        const ang = (Math.atan2(e.clientY - g.centerY, e.clientX - g.centerX) * 180) / Math.PI;
        applyPatch(g.view, g.id, { rot: Math.round(ang + 90) });
      }
    };
    const onUp = () => { gesture.current = null; };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [applyPatch]);

  const centerOf = (l, rect) => ({
    x: rect.left + (l.cx / 100) * rect.width,
    y: rect.top + (l.cy / 100) * rect.height,
  });

  const startMove = (e, id) => {
    e.stopPropagation();
    setSelectedId(id);
    const rect = canvasRef.current?.getBoundingClientRect();
    const l = layers.find((x) => x.id === id);
    if (!rect || !l) return;
    gesture.current = {
      mode: "move", id, view,
      startX: e.clientX, startY: e.clientY,
      startCx: l.cx, startCy: l.cy, rectW: rect.width, rectH: rect.height,
    };
  };

  const startResize = (e, id) => {
    e.stopPropagation();
    setSelectedId(id);
    const rect = canvasRef.current?.getBoundingClientRect();
    const l = layers.find((x) => x.id === id);
    if (!rect || !l) return;
    const c = centerOf(l, rect);
    gesture.current = {
      mode: "resize", id, view,
      centerX: c.x, centerY: c.y,
      startDist: Math.hypot(e.clientX - c.x, e.clientY - c.y),
      startW: l.wPct,
    };
  };

  const startRotate = (e, id) => {
    e.stopPropagation();
    setSelectedId(id);
    const rect = canvasRef.current?.getBoundingClientRect();
    const l = layers.find((x) => x.id === id);
    if (!rect || !l) return;
    const c = centerOf(l, rect);
    gesture.current = { mode: "rotate", id, view, centerX: c.x, centerY: c.y };
  };

  /* ---------- upload gambar ---------- */
  const handleFiles = (files) => {
    const file = files && files[0];
    if (!file) return;
    if (!/^image\/(png|jpe?g)$/i.test(file.type)) {
      toast.error("Format tidak didukung. Gunakan file PNG atau JPG.");
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      toast.error("Ukuran file terlalu besar (maksimal 15MB).");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const id = "img_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      const layer = { id, type: "image", src: reader.result, name: file.name, cx: 50, cy: 42, wPct: 42, rot: 0 };
      setDesign((d) => ({ ...d, [view]: [...(d[view] || []), layer] }));
      setSelectedId(id);
      setActiveTool("Gambar Saya");
      toast.success("Gambar ditambahkan. Geser, ubah ukuran, atau putar sesukamu.");
    };
    reader.onerror = () => toast.error("Gagal membaca file gambar.");
    reader.readAsDataURL(file);
  };

  const onInputChange = (e) => { handleFiles(e.target.files); e.target.value = ""; };
  const triggerUpload = () => fileInputRef.current?.click();

  /* ---------- teks: tambah & ubah objek teks ---------- */
  const addText = useCallback((preset = {}) => {
    const id = "txt_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const layer = {
      id, type: "text",
      text: preset.text || "Teks kamu",
      color: preset.color || "#111111",
      font: preset.font || FONTS[0].value,
      bold: preset.bold ?? true,
      italic: preset.italic ?? false,
      align: preset.align || "center",
      curve: preset.curve ?? 0,
      cx: 50, cy: 42, wPct: preset.wPct || 12, rot: 0,
    };
    setDesign((d) => ({ ...d, [view]: [...(d[view] || []), layer] }));
    setSelectedId(id);
    setActiveTool("Teks");
    toast.success("Teks ditambahkan. Ketik isinya, lalu geser / ubah ukuran / putar.");
  }, [view]);

  const updateSelectedText = useCallback((patch) => {
    if (!selectedId) return;
    applyPatch(view, selectedId, patch);
  }, [selectedId, view, applyPatch]);

  /* ---------- clip art: tambah aset ke desain ---------- */
  const addClipart = useCallback((asset) => {
    if (!asset || !asset.url) return;
    const id = "clip_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const layer = { id, type: "image", src: asset.url, name: asset.name || "Clipart", cx: 50, cy: 42, wPct: 38, rot: 0 };
    setDesign((d) => ({ ...d, [view]: [...(d[view] || []), layer] }));
    setSelectedId(id);
    toast.success(`"${asset.name || "Clipart"}" ditambahkan ke desain.`);
  }, [view]);

  /* ---------- kontrol objek terpilih ---------- */
  const resizeSelected = (delta) => {
    if (!selectedLayer) return;
    applyPatch(view, selectedLayer.id, { wPct: clamp(selectedLayer.wPct + delta, 5, 130) });
  };
  const rotateSelected = (delta) => {
    if (!selectedLayer) return;
    applyPatch(view, selectedLayer.id, { rot: (selectedLayer.rot + delta) % 360 });
  };
  const resetRotation = () => { if (selectedLayer) applyPatch(view, selectedLayer.id, { rot: 0 }); };
  const centerSelected = () => { if (selectedLayer) applyPatch(view, selectedLayer.id, { cx: 50, cy: 42 }); };
  const deleteLayer = (id) => {
    setDesign((d) => ({ ...d, [view]: (d[view] || []).filter((l) => l.id !== id) }));
    setSelectedId((s) => (s === id ? null : s));
  };

  /* ---------- urutan layer (z-order): akhir array = paling depan ---------- */
  const moveLayer = useCallback((id, dir) => {
    setDesign((d) => {
      const arr = [...(d[view] || [])];
      const i = arr.findIndex((l) => l.id === id);
      if (i < 0) return d;
      const [item] = arr.splice(i, 1);
      let j;
      if (dir === "up") j = Math.min(arr.length, i + 1);        // maju (ke depan)
      else if (dir === "down") j = Math.max(0, i - 1);          // mundur (ke belakang)
      else if (dir === "front") j = arr.length;                 // paling depan
      else j = 0;                                               // paling belakang
      arr.splice(j, 0, item);
      return { ...d, [view]: arr };
    });
    setSelectedId(id);
  }, [view]);
  const resetView = () => {
    if ((design[view] || []).length === 0) return toast.info("Tampilan ini masih kosong");
    setDesign((d) => ({ ...d, [view]: [] }));
    setSelectedId(null);
    toast.success(`Desain tampilan ${view} direset`);
  };

  const totalObjects = VIEWS.reduce((a, v) => a + (design[v] || []).length, 0);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-zinc-100 text-zinc-900">
      {/* input file tersembunyi untuk upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg"
        className="hidden"
        onChange={onInputChange}
        data-testid="custom-file-input"
      />

      {/* Mobile fallback: desainer butuh layar lebih besar */}
      <div className="flex flex-1 flex-col items-center justify-center gap-5 p-8 text-center md:hidden">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-neutral-900 p-3">
          <img src="/logo.png" alt="Daneswara" className="h-full w-full object-contain" />
        </div>
        <div>
          <h1 className="text-lg font-bold">Custom Tees</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Desainer kaos paling nyaman dibuka di layar tablet atau komputer. Silakan buka lewat perangkat yang lebih besar.
          </p>
        </div>
        <button onClick={() => navigate("/app")} className="rounded-lg bg-zinc-900 px-5 py-2 text-sm font-semibold text-white">
          Kembali ke Admin
        </button>
      </div>

      {/* Desktop designer */}
      <div className="hidden h-full w-full flex-col md:flex">
      {/* ============================ TOP BAR ============================ */}
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-4">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-neutral-900 p-1.5">
            <img src="/logo.png" alt="Daneswara" className="h-full w-full object-contain" />
          </div>
          <div className="leading-tight">
            <div className="text-[15px] font-bold tracking-tight">Custom Tees</div>
            <div className="text-[11px] text-zinc-500">Desain Sesukamu, Pakai Gayamu</div>
          </div>
        </div>

        {/* Stepper */}
        <div className="hidden items-center gap-2 md:flex">
          {STEPS.map((s, i) => {
            const active = i === 0;
            return (
              <div key={s} className="flex items-center gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${
                      active ? "bg-zinc-900 text-white" : "border border-zinc-300 bg-white text-zinc-400"
                    }`}
                  >
                    {i + 1}
                  </span>
                  <span className={`text-sm ${active ? "font-semibold text-zinc-900" : "text-zinc-400"}`}>{s}</span>
                </div>
                {i < STEPS.length - 1 && <span className="h-px w-10 bg-zinc-200" />}
              </div>
            );
          })}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          <ToolbarIcon icon={Undo2} label="Undo" />
          <ToolbarIcon icon={Redo2} label="Redo" />
          <ToolbarIcon icon={Save} label="Simpan" />
          <button className="ml-2 flex items-center gap-1.5 rounded-full border border-zinc-300 px-3.5 py-1.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50">
            <HelpCircle className="h-4 w-4" /> Bantuan
          </button>
        </div>
      </header>

      {/* ============================ BODY ============================ */}
      <div className="flex min-h-0 flex-1">
        {/* -------- Tool rail -------- */}
        <nav className="hidden w-[92px] shrink-0 flex-col items-center gap-1 border-r border-zinc-200 bg-white py-3 md:flex">
          {TOOLS.map((t) => {
            const active = activeTool === t.label;
            return (
              <button
                key={t.label}
                onClick={() => setActiveTool(t.label)}
                data-testid={`tool-${t.label.toLowerCase().replace(/\s+/g, "-")}`}
                className={`flex w-[80px] flex-col items-center gap-1 rounded-xl px-1 py-2 text-center transition ${
                  active ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-100"
                }`}
              >
                <t.icon className="h-5 w-5" />
                <span className="text-[11px] font-semibold leading-none">{t.label}</span>
                <span className={`text-[9px] leading-tight ${active ? "text-zinc-300" : "text-zinc-400"}`}>{t.sub}</span>
              </button>
            );
          })}
          <div className="mt-auto w-[80px] rounded-xl bg-rose-50 px-2 py-3 text-center">
            <LifeBuoy className="mx-auto h-5 w-5 text-rose-500" />
            <div className="mt-1 text-[10px] font-semibold text-rose-600">Butuh bantuan?</div>
            <div className="text-[9px] leading-tight text-rose-400">Lihat panduan atau hubungi kami</div>
            <div className="mt-1 text-[10px] font-bold text-rose-600">Pusat Bantuan</div>
          </div>
        </nav>

        {/* -------- Left panel (konten sesuai tool aktif) -------- */}
        <aside className="hidden w-[300px] shrink-0 flex-col overflow-y-auto border-r border-zinc-200 bg-white p-4 lg:flex">
          {activeTool === "Gambar Saya" ? (
            <ImagePanel
              layers={layers.filter((l) => !isTextLayer(l))}
              view={view}
              selectedLayer={selectedLayer}
              setSelectedId={setSelectedId}
              triggerUpload={triggerUpload}
              handleFiles={handleFiles}
              resizeSelected={resizeSelected}
              rotateSelected={rotateSelected}
              resetRotation={resetRotation}
              centerSelected={centerSelected}
              deleteLayer={deleteLayer}
            />
          ) : activeTool === "Teks" ? (
            <TextPanel
              layers={layers.filter(isTextLayer)}
              view={view}
              selectedLayer={isTextLayer(selectedLayer) ? selectedLayer : null}
              setSelectedId={setSelectedId}
              addText={addText}
              updateSelectedText={updateSelectedText}
              resizeSelected={resizeSelected}
              rotateSelected={rotateSelected}
              resetRotation={resetRotation}
              centerSelected={centerSelected}
              deleteLayer={deleteLayer}
            />
          ) : activeTool === "Clipart" ? (
            <ClipartPanel addClipart={addClipart} />
          ) : activeTool === "Layer" ? (
            <LayerPanel
              layers={layers}
              selectedId={selectedId}
              setSelectedId={setSelectedId}
              moveLayer={moveLayer}
              deleteLayer={deleteLayer}
            />
          ) : activeTool === "Produk" ? (
            <ProductPanel color={color} setColor={setColor} />
          ) : (
            <ComingSoon tool={activeTool} onUpload={triggerUpload} setActiveTool={setActiveTool} />
          )}
        </aside>

        {/* -------- Canvas -------- */}
        <main className="relative flex min-w-0 flex-1 flex-col items-center justify-center bg-zinc-100">
          <div className="flex w-full max-w-[560px] flex-col items-center px-6">
            {/* Label tampilan aktif */}
            <div
              className="mb-3 inline-flex items-center gap-2 rounded-full bg-zinc-900 px-4 py-1.5 text-sm font-bold uppercase tracking-wide text-white shadow-sm"
              data-testid="active-view-label"
            >
              <Shirt className="h-4 w-4" />
              {view}
            </div>
            <div
              ref={canvasRef}
              className="relative h-[62vh] w-auto"
              data-testid="tee-canvas"
              onPointerDown={(e) => { if (e.target === e.currentTarget || e.target.tagName === "IMG") setSelectedId(null); }}
            >
              <img
                src={MOCKUPS[view]}
                alt={`Kaos tampak ${view}`}
                className="pointer-events-none h-full w-auto max-w-full object-contain drop-shadow-sm"
                data-testid="tee-mockup-image"
                draggable={false}
              />
              {!isWhite && (
                <div
                  aria-hidden="true"
                  data-testid="tee-color-overlay"
                  className="pointer-events-none absolute inset-0 transition-[background-color] duration-200"
                  style={{
                    backgroundColor: color.hex,
                    mixBlendMode: "multiply",
                    WebkitMaskImage: `url(${MOCKUP_MASKS[view]})`,
                    maskImage: `url(${MOCKUP_MASKS[view]})`,
                    WebkitMaskSize: "contain",
                    maskSize: "contain",
                    WebkitMaskPosition: "center",
                    maskPosition: "center",
                    WebkitMaskRepeat: "no-repeat",
                    maskRepeat: "no-repeat",
                  }}
                />
              )}

              {/* ---------- Objek desain (gambar upload) ---------- */}
              {layers.map((l, idx) => {
                const selected = l.id === selectedId;
                const isTxt = isTextLayer(l);
                return (
                  <div
                    key={l.id}
                    onPointerDown={(e) => startMove(e, l.id)}
                    data-testid={`design-layer-${l.id}`}
                    className="absolute cursor-move"
                    style={{
                      left: `${l.cx}%`,
                      top: `${l.cy}%`,
                      width: isTxt ? "auto" : `${l.wPct}%`,
                      transform: `translate(-50%, -50%) rotate(${l.rot}deg)`,
                      touchAction: "none",
                      zIndex: idx + 1,
                    }}
                  >
                    {isTxt ? (
                      l.curve ? (
                        <CurvedText
                          testId={`design-text-${l.id}`}
                          text={l.text}
                          curve={l.curve}
                          color={l.color}
                          font={l.font}
                          bold={l.bold}
                          italic={l.italic}
                          wPct={l.wPct}
                        />
                      ) : (
                        <span
                          className="pointer-events-none block select-none leading-tight"
                          data-testid={`design-text-${l.id}`}
                          style={{
                            color: l.color,
                            fontFamily: l.font,
                            fontWeight: l.bold ? 800 : 500,
                            fontStyle: l.italic ? "italic" : "normal",
                            textAlign: l.align,
                            whiteSpace: "pre",
                            fontSize: `${textFontVh(l.wPct)}vh`,
                            textShadow: l.color.toLowerCase() === "#ffffff" ? "0 0 1px rgba(0,0,0,0.25)" : "none",
                          }}
                        >
                          {l.text || " "}
                        </span>
                      )
                    ) : (
                      <img
                        src={l.src}
                        alt={l.name || "Gambar desain"}
                        draggable={false}
                        className="pointer-events-none block h-auto w-full select-none"
                      />
                    )}
                    {!selected && (
                      <>
                        {/* garis putus-putus menandai area gambar yang bisa diklik */}
                        <div className="pointer-events-none absolute inset-0 border border-dashed border-zinc-400/70" />
                        {/* label petunjuk di sekitar area gambar */}
                        <div
                          className="pointer-events-none absolute left-1/2 top-full mt-2 whitespace-nowrap rounded-full bg-zinc-900/85 px-2.5 py-1 text-[11px] font-semibold text-white shadow-md"
                          style={{ transform: `translateX(-50%) rotate(${-l.rot}deg)` }}
                          data-testid={`design-hint-${l.id}`}
                        >
                          {isTxt ? "Klik teks untuk mengubah" : "Klik gambar untuk melakukan perubahan"}
                        </div>
                      </>
                    )}
                    {selected && (
                      <>
                        <div className="pointer-events-none absolute inset-0 border-2 border-blue-500" />
                        {/* garis ke handle rotate */}
                        <div className="pointer-events-none absolute -top-6 left-1/2 h-6 w-px -translate-x-1/2 bg-blue-500" />
                        {/* handle rotate */}
                        <div
                          onPointerDown={(e) => startRotate(e, l.id)}
                          title="Putar"
                          data-testid={`design-rotate-${l.id}`}
                          className="absolute -top-9 left-1/2 flex h-6 w-6 -translate-x-1/2 cursor-grab items-center justify-center rounded-full border-2 border-blue-500 bg-white text-blue-600 shadow active:cursor-grabbing"
                          style={{ touchAction: "none" }}
                        >
                          <RotateCw className="h-3.5 w-3.5" />
                        </div>
                        {/* handle resize (pojok kanan bawah) */}
                        <div
                          onPointerDown={(e) => startResize(e, l.id)}
                          title="Ubah ukuran"
                          data-testid={`design-resize-${l.id}`}
                          className="absolute -bottom-2 -right-2 h-5 w-5 cursor-nwse-resize rounded-sm border-2 border-blue-500 bg-white shadow"
                          style={{ touchAction: "none" }}
                        />
                        {/* tombol hapus (pojok kanan atas) */}
                        <button
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => { e.stopPropagation(); deleteLayer(l.id); }}
                          title="Hapus gambar"
                          data-testid={`design-delete-${l.id}`}
                          className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-rose-500 text-white shadow"
                          style={{ touchAction: "none" }}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="mt-6 w-full max-w-[430px] border-t border-dashed border-zinc-300 pt-2 text-center text-[11px] font-semibold tracking-[0.2em] text-zinc-400">
              AREA CETAK AMAN
            </div>
          </div>
        </main>

        {/* -------- Right view panel -------- */}
        <aside className="hidden w-[248px] shrink-0 flex-col gap-6 overflow-y-auto border-l border-zinc-200 bg-white p-4 xl:flex">
          <div>
            <h3 className="mb-3 text-sm font-bold">Tampilan Kaos</h3>
            <div className="flex flex-col gap-2">
              {VIEWS.map((v) => {
                const count = (design[v] || []).length;
                return (
                  <button
                    key={v}
                    onClick={() => { setView(v); setSelectedId(null); }}
                    className={`flex items-center gap-3 rounded-xl border p-2.5 text-sm transition ${
                      view === v ? "border-zinc-900 bg-zinc-50 font-semibold" : "border-zinc-200 hover:border-zinc-400"
                    }`}
                  >
                    <TintedThumb src={MOCKUPS[v]} mask={MOCKUP_MASKS[v]} color={color.hex} alt={v} />
                    <span className="flex-1 text-left">{v}</span>
                    {count > 0 && (
                      <span className="rounded-full bg-zinc-900 px-1.5 text-[10px] font-bold text-white">{count}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-bold">Status Desain</h3>
            <div className="flex flex-col gap-2.5">
              {VIEWS.map((v) => {
                const count = (design[v] || []).length;
                return (
                  <div key={v} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-zinc-700">
                      <Check className={`h-4 w-4 ${count > 0 ? "text-emerald-500" : "text-zinc-300"}`} /> {v}
                    </span>
                    <span className={`text-xs font-semibold ${count > 0 ? "text-emerald-600" : "text-zinc-400"}`}>
                      {count > 0 ? `${count} objek` : "Kosong"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </aside>
      </div>

      {/* ============================ BOTTOM BAR ============================ */}
      <footer className="flex h-16 shrink-0 items-center justify-between border-t border-zinc-200 bg-white px-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => resizeSelected(-5)}
            disabled={!selectedLayer}
            data-testid="size-minus-button"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-300 text-zinc-600 hover:bg-zinc-50 disabled:opacity-40"
          >
            <Minus className="h-4 w-4" />
          </button>
          <span className="w-16 text-center text-sm font-semibold">
            {selectedLayer ? `${Math.round(selectedLayer.wPct)}%` : "—"}
          </span>
          <button
            onClick={() => resizeSelected(5)}
            disabled={!selectedLayer}
            data-testid="size-plus-button"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-300 text-zinc-600 hover:bg-zinc-50 disabled:opacity-40"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setPreviewOpen(true)}
            data-testid="save-design-button"
            className="flex items-center gap-2 rounded-lg border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
          >
            <Save className="h-4 w-4" /> Simpan Desain
          </button>
          <button
            onClick={resetView}
            data-testid="reset-design-button"
            className="flex items-center gap-2 rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50"
          >
            <RotateCcw className="h-4 w-4" /> Reset Desain
          </button>
          <button className="flex items-center gap-2 rounded-lg bg-zinc-900 px-5 py-2 text-sm font-semibold text-white hover:bg-zinc-800">
            Lanjutkan <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </footer>
      </div>
      {/* /Desktop designer */}

      {/* Preview gabungan semua sisi */}
      <PreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        design={design}
        color={color}
      />
    </div>
  );
}

/* =========================================================================
   PREVIEW gabungan: render read-only tiap sisi (mockup + tint + objek desain).
   Ukuran teks/curved memakai vh (sama seperti kanvas), lalu di-scale via CSS
   transform agar pas dalam tile — hasil identik dengan kanvas.
   ========================================================================= */
function PreviewStage({ view, color, layers, onReady }) {
  const white = (color?.hex || "#ffffff").toLowerCase() === "#ffffff";
  return (
    <div className="relative h-[62vh] w-auto">
      <img
        src={MOCKUPS[view]}
        alt={`Kaos ${view}`}
        onLoad={onReady}
        draggable={false}
        className="pointer-events-none h-full w-auto max-w-full object-contain"
      />
      {!white && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundColor: color.hex,
            mixBlendMode: "multiply",
            WebkitMaskImage: `url(${MOCKUP_MASKS[view]})`,
            maskImage: `url(${MOCKUP_MASKS[view]})`,
            WebkitMaskSize: "contain", maskSize: "contain",
            WebkitMaskPosition: "center", maskPosition: "center",
            WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat",
          }}
        />
      )}
      {layers.map((l, idx) => {
        const isTxt = isTextLayer(l);
        return (
          <div
            key={l.id}
            className="absolute"
            style={{
              left: `${l.cx}%`, top: `${l.cy}%`,
              width: isTxt ? "auto" : `${l.wPct}%`,
              transform: `translate(-50%, -50%) rotate(${l.rot}deg)`,
              zIndex: idx + 1,
            }}
          >
            {isTxt ? (
              l.curve ? (
                <CurvedText text={l.text} curve={l.curve} color={l.color} font={l.font} bold={l.bold} italic={l.italic} wPct={l.wPct} />
              ) : (
                <span
                  className="block select-none leading-tight"
                  style={{
                    color: l.color, fontFamily: l.font,
                    fontWeight: l.bold ? 800 : 500,
                    fontStyle: l.italic ? "italic" : "normal",
                    textAlign: l.align, whiteSpace: "pre",
                    fontSize: `${textFontVh(l.wPct)}vh`,
                    textShadow: l.color.toLowerCase() === "#ffffff" ? "0 0 1px rgba(0,0,0,0.25)" : "none",
                  }}
                >
                  {l.text || " "}
                </span>
              )
            ) : (
              <img src={l.src} alt={l.name || "desain"} draggable={false} className="block h-auto w-full select-none" />
            )}
          </div>
        );
      })}
    </div>
  );
}

// Scales the read-only stage (mockup + tint + desain customer) to FIT inside its
// parent cell using object-fit:contain semantics — whole shirt + sleeves visible,
// never cropped. The stage is laid out at its NATURAL size (so the mockup image is
// not clamped by max-width) and then transform-scaled into a clip box, keeping the
// vh-based text/positions identical to the canvas.
function PreviewFitTile({ view, color, layers }) {
  const wrapRef = useRef(null);   // available cell area
  const stageRef = useRef(null);  // wraps PreviewStage (accurate layout height)
  const [s, setS] = useState({ scale: 0, w: 0, h: 0, nw: 0, nh: 0 });

  const measure = useCallback(() => {
    const wrap = wrapRef.current, st = stageRef.current;
    if (!wrap || !st) return;
    const availW = wrap.clientWidth, availH = wrap.clientHeight;
    const realH = st.offsetHeight;             // h-[62vh], not width-clamped
    const img = st.querySelector("img");
    const nW = img && img.naturalWidth ? img.naturalWidth : 0;
    const nH = img && img.naturalHeight ? img.naturalHeight : 0;
    if (availW > 0 && availH > 0 && realH > 0 && nW > 0 && nH > 0) {
      const stageW = realH * (nW / nH);        // true natural width for this height
      const scale = Math.min(availW / stageW, availH / realH); // contain
      setS({ scale, w: stageW * scale, h: realH * scale, nw: stageW, nh: realH });
    }
  }, []);

  useLayoutEffect(() => { measure(); }, [measure, view, layers]);
  useEffect(() => {
    measure();
    const id = window.setTimeout(measure, 120);
    window.addEventListener("resize", measure);
    return () => { window.clearTimeout(id); window.removeEventListener("resize", measure); };
  }, [measure]);

  return (
    <div ref={wrapRef} className="relative min-h-0 min-w-0 w-full flex-1 overflow-hidden">
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative overflow-hidden" style={{ width: s.w || 1, height: s.h || 1 }}>
          <div
            style={{
              width: s.nw || 1, height: s.nh || 1,
              position: "absolute", top: 0, left: 0,
              transformOrigin: "top left",
              transform: `scale(${s.scale || 0.01})`,
              opacity: s.scale ? 1 : 0,
            }}
          >
            <div ref={stageRef} className="inline-block">
              <PreviewStage view={view} color={color} layers={layers} onReady={measure} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const PREVIEW_VIEWS = ["Depan", "Belakang", "Lengan Kiri", "Lengan Kanan"];

function PreviewModal({ open, onClose, design, color }) {
  const bodyRef = useRef(null);
  const [side, setSide] = useState(0);

  useEffect(() => {
    if (!open) return;
    const h = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  // Largest square that fits the available body area -> keeps 2x2 preview 1:1.
  const measureSide = useCallback(() => {
    const el = bodyRef.current;
    if (!el) return;
    const s = Math.min(el.clientWidth, el.clientHeight);
    if (s > 0) setSide(s);
  }, []);
  useLayoutEffect(() => { if (open) measureSide(); }, [open, measureSide]);
  useEffect(() => {
    if (!open) return;
    measureSide();
    const id = window.setTimeout(measureSide, 80);
    window.addEventListener("resize", measureSide);
    return () => { window.clearTimeout(id); window.removeEventListener("resize", measureSide); };
  }, [open, measureSide]);

  if (!open) return null;

  const total = PREVIEW_VIEWS.reduce((n, v) => n + ((design[v] || []).length), 0);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-2 sm:p-4"
      data-testid="preview-modal"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        style={{ height: "96vh", maxHeight: "100vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-zinc-100 px-4 py-3 sm:px-5 sm:py-4">
          <div>
            <h2 className="text-base font-bold text-zinc-900 sm:text-lg">Preview Desain — Semua Sisi</h2>
            <p className="text-[12px] text-zinc-500">
              {total} objek desain · warna kaos {color?.label || "Putih"}
            </p>
          </div>
          <button
            onClick={onClose}
            data-testid="preview-close"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-zinc-300 text-zinc-500 hover:bg-zinc-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body: centered largest 1:1 square holding a symmetric 2x2 grid */}
        <div ref={bodyRef} className="flex min-h-0 flex-1 items-center justify-center p-2 sm:p-3">
          <div
            className="grid gap-2 sm:gap-3"
            style={{
              width: side ? `${side}px` : "100%",
              height: side ? `${side}px` : "100%",
              gridTemplateColumns: "1fr 1fr",
              gridTemplateRows: "1fr 1fr",
            }}
          >
            {PREVIEW_VIEWS.map((v) => {
              const n = (design[v] || []).length;
              return (
                <div
                  key={v}
                  className="relative flex min-h-0 min-w-0 flex-col rounded-xl border border-zinc-200 bg-zinc-50 p-1.5 sm:p-2"
                  data-testid={`preview-cell-${v.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  <div className="z-10 mx-auto mb-1 inline-flex shrink-0 items-center gap-1.5 rounded-full bg-zinc-900 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-white sm:text-[11px]">
                    <Shirt className="h-3.5 w-3.5" /> {v}
                  </div>
                  <PreviewFitTile view={v} color={color} layers={design[v] || []} />
                  <span className="pointer-events-none absolute bottom-1.5 right-2 text-[10px] font-medium text-zinc-400">
                    {n === 0 ? "Kosong" : `${n} objek`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="flex shrink-0 justify-end border-t border-zinc-100 px-4 py-3 sm:px-5">
          <button
            onClick={onClose}
            className="rounded-lg bg-zinc-900 px-5 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   PANEL: Produk (warna & ukuran)
   ========================================================================= */
function ProductPanel({ color, setColor }) {
  return (
    <>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-bold">Produk</h2>
        <button className="flex items-center text-xs font-semibold text-zinc-500 hover:text-zinc-900">
          Ganti Produk <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex items-center gap-3 rounded-xl border border-zinc-200 p-3">
        <TintedThumb src={MOCKUPS["Depan"]} mask={MOCKUP_MASKS["Depan"]} color={color.hex} alt="Kaos" size={48} inner={36} />
        <div className="leading-tight">
          <div className="text-[13px] font-semibold">24 COTTON LOCAL SIZE (BUILDUP TEES)</div>
          <div className="text-[11px] text-zinc-500">Kaos 24s Dengan ukuran local</div>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between">
        <h3 className="text-sm font-bold">Ukuran</h3>
        <button className="text-xs font-semibold text-zinc-500 underline-offset-2 hover:text-zinc-900 hover:underline">Panduan Ukuran</button>
      </div>
      <div className="mt-2 grid grid-cols-4 gap-2">
        {SIZES.map((s) => (
          <button
            key={s}
            className={`h-9 rounded-lg border text-sm font-semibold transition ${
              s === "L" ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-200 text-zinc-700 hover:border-zinc-400"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="mt-5 flex items-center justify-between">
        <h3 className="text-sm font-bold">Warna Kaos</h3>
        <button className="text-xs font-semibold text-zinc-500 underline-offset-2 hover:text-zinc-900 hover:underline">Lihat Semua Warna</button>
      </div>
      <div className="mt-2 flex items-center gap-3 rounded-xl border border-zinc-200 p-2.5">
        <span
          className="h-8 w-8 rounded-full border border-zinc-300 shadow-inner transition-colors"
          style={{ backgroundColor: color.hex }}
          data-testid="active-color-swatch"
        />
        <div className="leading-tight">
          <div className="text-sm font-semibold" data-testid="active-color-name">{color.name}</div>
          <div className="text-[11px] uppercase text-zinc-400" data-testid="active-color-hex">{color.hex}</div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {COLOR_TABS.map((c, i) => (
          <button
            key={c}
            className={`pb-0.5 ${i === 0 ? "border-b-2 border-zinc-900 font-bold text-zinc-900" : "text-zinc-400 hover:text-zinc-700"}`}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-7 gap-2">
        {SWATCHES.map((c) => {
          const active = c.hex === color.hex;
          const isLight = c.hex.toLowerCase() === "#ffffff";
          return (
            <button
              key={c.hex}
              onClick={() => setColor(c)}
              title={`${c.name} (${c.hex})`}
              aria-label={`Pilih warna ${c.name}`}
              data-testid={`swatch-${c.name.toLowerCase().replace(/\s+/g, "-")}`}
              className={`relative aspect-square rounded-full border transition ${
                active ? "ring-2 ring-zinc-900 ring-offset-1" : "border-zinc-200 hover:scale-110"
              } ${isLight ? "border-zinc-300" : ""}`}
              style={{ backgroundColor: c.hex }}
            >
              {active && (
                <Check className="absolute inset-0 m-auto h-3.5 w-3.5" style={{ color: isLight ? "#111" : "#fff" }} />
              )}
            </button>
          );
        })}
      </div>

      <button className="mt-5 flex items-center justify-between rounded-xl border border-zinc-200 px-3.5 py-3 text-sm font-semibold text-zinc-700 hover:bg-zinc-50">
        Detail Produk
        <ChevronDown className="h-4 w-4 text-zinc-400" />
      </button>
    </>
  );
}

/* =========================================================================
   PANEL: Gambar Saya (upload + transform)
   ========================================================================= */
function ImagePanel({
  layers, view, selectedLayer, setSelectedId, triggerUpload, handleFiles,
  resizeSelected, rotateSelected, resetRotation, centerSelected, deleteLayer,
}) {
  const [dragOver, setDragOver] = useState(false);
  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer?.files);
  };

  return (
    <>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-bold">Gambar Saya</h2>
        <span className="text-[11px] text-zinc-400">Tampilan {view}</span>
      </div>

      {/* Dropzone / tombol upload */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={triggerUpload}
        data-testid="custom-upload-dropzone"
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-center transition ${
          dragOver ? "border-zinc-900 bg-zinc-50" : "border-zinc-300 hover:border-zinc-500 hover:bg-zinc-50"
        }`}
      >
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-zinc-900 text-white">
          <Upload className="h-5 w-5" />
        </div>
        <div className="text-sm font-semibold text-zinc-800">Upload Gambar</div>
        <div className="text-[11px] leading-tight text-zinc-500">
          Tarik &amp; letakkan atau klik untuk memilih file.<br />Format <b>PNG</b> atau <b>JPG</b> (maks 15MB).
        </div>
      </div>
      <button
        onClick={triggerUpload}
        data-testid="custom-upload-button"
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800"
      >
        <Upload className="h-4 w-4" /> Pilih File Gambar
      </button>

      {/* Daftar gambar pada tampilan ini */}
      <div className="mt-5">
        <h3 className="mb-2 text-sm font-bold">Gambar di tampilan ini</h3>
        {layers.length === 0 ? (
          <p className="rounded-lg bg-zinc-50 px-3 py-3 text-center text-[12px] text-zinc-500">
            Belum ada gambar. Upload gambarmu untuk mulai mendesain.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {layers.map((l) => {
              const active = selectedLayer && selectedLayer.id === l.id;
              return (
                <div
                  key={l.id}
                  onClick={() => setSelectedId(l.id)}
                  data-testid={`layer-row-${l.id}`}
                  className={`flex cursor-pointer items-center gap-2.5 rounded-lg border p-2 transition ${
                    active ? "border-zinc-900 bg-zinc-50" : "border-zinc-200 hover:border-zinc-400"
                  }`}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md border border-zinc-200 bg-white">
                    <img src={l.src} alt={l.name || "gambar"} className="h-full w-full object-contain" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-zinc-700">{l.name || "Gambar"}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteLayer(l.id); }}
                    title="Hapus"
                    className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 hover:bg-rose-50 hover:text-rose-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Kontrol transform objek terpilih */}
      {selectedLayer && (
        <div className="mt-5 rounded-xl border border-zinc-200 p-3">
          <h3 className="mb-3 text-sm font-bold">Atur Gambar</h3>

          {/* Ukuran */}
          <div className="mb-3">
            <div className="mb-1 flex items-center justify-between text-[12px] font-semibold text-zinc-600">
              <span>Ukuran</span>
              <span>{Math.round(selectedLayer.wPct)}%</span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => resizeSelected(-5)} className="flex h-8 w-8 items-center justify-center rounded-md border border-zinc-300 hover:bg-zinc-50" data-testid="panel-size-minus"><Minus className="h-4 w-4" /></button>
              <input
                type="range" min={5} max={130} value={Math.round(selectedLayer.wPct)}
                onChange={(e) => resizeSelected(Number(e.target.value) - selectedLayer.wPct)}
                className="h-1.5 flex-1 cursor-pointer accent-zinc-900"
                data-testid="panel-size-range"
              />
              <button onClick={() => resizeSelected(5)} className="flex h-8 w-8 items-center justify-center rounded-md border border-zinc-300 hover:bg-zinc-50" data-testid="panel-size-plus"><Plus className="h-4 w-4" /></button>
            </div>
          </div>

          {/* Putar */}
          <div className="mb-3">
            <div className="mb-1 flex items-center justify-between text-[12px] font-semibold text-zinc-600">
              <span>Putar</span>
              <span>{((selectedLayer.rot % 360) + 360) % 360}°</span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => rotateSelected(-15)} className="flex h-8 w-8 items-center justify-center rounded-md border border-zinc-300 hover:bg-zinc-50" data-testid="panel-rotate-left"><RotateCcw className="h-4 w-4" /></button>
              <input
                type="range" min={0} max={360} value={((selectedLayer.rot % 360) + 360) % 360}
                onChange={(e) => rotateSelected(Number(e.target.value) - (((selectedLayer.rot % 360) + 360) % 360))}
                className="h-1.5 flex-1 cursor-pointer accent-zinc-900"
                data-testid="panel-rotate-range"
              />
              <button onClick={() => rotateSelected(15)} className="flex h-8 w-8 items-center justify-center rounded-md border border-zinc-300 hover:bg-zinc-50" data-testid="panel-rotate-right"><RotateCw className="h-4 w-4" /></button>
            </div>
          </div>

          {/* Aksi cepat */}
          <div className="flex items-center gap-2">
            <button onClick={centerSelected} className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-zinc-300 py-2 text-[12px] font-semibold text-zinc-700 hover:bg-zinc-50" data-testid="panel-center">
              <Move className="h-3.5 w-3.5" /> Tengah
            </button>
            <button onClick={resetRotation} className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-zinc-300 py-2 text-[12px] font-semibold text-zinc-700 hover:bg-zinc-50" data-testid="panel-reset-rotate">
              <RotateCcw className="h-3.5 w-3.5" /> 0°
            </button>
            <button onClick={() => deleteLayer(selectedLayer.id)} className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-rose-200 py-2 text-[12px] font-semibold text-rose-600 hover:bg-rose-50" data-testid="panel-delete">
              <Trash2 className="h-3.5 w-3.5" /> Hapus
            </button>
          </div>

          <p className="mt-3 text-[11px] leading-tight text-zinc-400">
            Tip: geser gambar untuk memindahkan, tarik kotak biru di pojok untuk mengubah ukuran, dan tarik lingkaran di atas untuk memutar.
          </p>
        </div>
      )}
    </>
  );
}

/* =========================================================================
   Teks melengkung (arch) — dirender via SVG <textPath> mengikuti busur lingkaran.
   curve > 0 : melengkung ke atas (∩, seperti pelangi / teks atas logo)
   curve < 0 : melengkung ke bawah (∪, seperti teks bawah logo)
   Ukuran mengikuti wPct (skala relatif kaos) sama seperti teks lurus.
   ========================================================================= */
function CurvedText({ testId, text, curve, color, font, bold, italic, wPct }) {
  const measureRef = useRef(null);
  const [len, setLen] = useState(0);
  const rawId = useId();
  const pathId = `arc-${rawId.replace(/[^a-zA-Z0-9]/g, "")}`;

  const clean = (text || " ").replace(/\s*\n+\s*/g, " ");
  const FS = 100;
  const fw = bold ? 800 : 500;
  const fst = italic ? "italic" : "normal";
  const scale = textFontVh(wPct) / FS; // vh per satuan SVG

  useLayoutEffect(() => {
    if (!measureRef.current) return;
    try { setLen(measureRef.current.getComputedTextLength() || 0); } catch { setLen(0); }
  }, [clean, font, bold, italic]);

  // SVG pengukur (tersembunyi) untuk mengetahui panjang teks pada FS tetap
  const measurer = (
    <svg width="0" height="0" style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }} aria-hidden="true">
      <text ref={measureRef} x="0" y="0" fontFamily={font} fontSize={FS} fontWeight={fw} fontStyle={fst}>{clean}</text>
    </svg>
  );

  const theta = Math.abs(curve) * Math.PI / 180;
  if (!len || theta < 0.02) {
    // fallback: teks lurus (belum terukur / lengkung ~0)
    return (
      <>
        {measurer}
        <span
          className="pointer-events-none block select-none leading-tight"
          data-testid={testId}
          style={{
            color, fontFamily: font, fontWeight: fw, fontStyle: fst,
            whiteSpace: "pre", fontSize: `${textFontVh(wPct)}vh`,
            textShadow: color.toLowerCase() === "#ffffff" ? "0 0 1px rgba(0,0,0,0.25)" : "none",
          }}
        >
          {clean}
        </span>
      </>
    );
  }

  const R = len / theta;            // radius agar panjang busur == panjang teks
  const half = theta / 2;
  const ex = R * Math.sin(half);    // setengah lebar (x endpoint)
  const cosH = Math.cos(half);
  const large = theta > Math.PI ? 1 : 0;
  const up = curve > 0;

  let d, yEnd;
  if (up) {
    yEnd = R * (1 - cosH);          // endpoint di bawah titik puncak (y=0)
    d = `M ${-ex} ${yEnd} A ${R} ${R} 0 ${large} 1 ${ex} ${yEnd}`;
  } else {
    yEnd = R * (cosH - 1);          // endpoint di atas titik terendah (y=0)
    d = `M ${-ex} ${yEnd} A ${R} ${R} 0 ${large} 0 ${ex} ${yEnd}`;
  }

  // viewBox: padding FS di atas & bawah agar glyph tidak terpotong
  const padX = FS * 0.7;
  const yMin = Math.min(0, yEnd) - FS;
  const yMax = Math.max(0, yEnd) + FS;
  const vbX = -(ex + padX);
  const vbW = 2 * (ex + padX);
  const vbY = yMin;
  const vbH = yMax - yMin;

  return (
    <>
      {measurer}
      <svg
        data-testid={testId}
        viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
        width={`${vbW * scale}vh`}
        height={`${vbH * scale}vh`}
        className="pointer-events-none block select-none overflow-visible"
        style={{ display: "block" }}
      >
        <defs>
          <path id={pathId} d={d} fill="none" />
        </defs>
        <text
          fontFamily={font}
          fontSize={FS}
          fontWeight={fw}
          fontStyle={fst}
          fill={color}
          textAnchor="middle"
          stroke={color.toLowerCase() === "#ffffff" ? "rgba(0,0,0,0.18)" : "none"}
          strokeWidth={color.toLowerCase() === "#ffffff" ? 1 : 0}
          paintOrder="stroke"
        >
          <textPath href={`#${pathId}`} xlinkHref={`#${pathId}`} startOffset="50%">
            {clean}
          </textPath>
        </text>
      </svg>
    </>
  );
}

/* =========================================================================
   PANEL: Teks (tambah tulisan + atur font, ukuran, warna, gaya)
   ========================================================================= */
function TextPanel({
  layers, view, selectedLayer, setSelectedId, addText, updateSelectedText,
  resizeSelected, rotateSelected, resetRotation, centerSelected, deleteLayer,
}) {
  const rot = selectedLayer ? (((selectedLayer.rot % 360) + 360) % 360) : 0;
  return (
    <>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-bold">Teks</h2>
        <span className="text-[11px] text-zinc-400">Tampilan {view}</span>
      </div>

      {/* Tambah teks */}
      <button
        onClick={() => addText()}
        data-testid="custom-add-text-button"
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800"
      >
        <Type className="h-4 w-4" /> Tambah Teks
      </button>
      <p className="mt-2 text-[11px] leading-tight text-zinc-500">
        Klik <b>Tambah Teks</b>, lalu ketik isinya di bawah. Geser di kanvas untuk memindahkan, tarik pojok untuk ubah ukuran, dan tarik lingkaran atas untuk memutar.
      </p>

      {/* Daftar teks pada tampilan ini */}
      <div className="mt-5">
        <h3 className="mb-2 text-sm font-bold">Teks di tampilan ini</h3>
        {layers.length === 0 ? (
          <p className="rounded-lg bg-zinc-50 px-3 py-3 text-center text-[12px] text-zinc-500">
            Belum ada teks. Tekan tombol di atas untuk menambah.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {layers.map((l) => {
              const active = selectedLayer && selectedLayer.id === l.id;
              return (
                <div
                  key={l.id}
                  onClick={() => setSelectedId(l.id)}
                  data-testid={`text-row-${l.id}`}
                  className={`flex cursor-pointer items-center gap-2.5 rounded-lg border p-2 transition ${
                    active ? "border-zinc-900 bg-zinc-50" : "border-zinc-200 hover:border-zinc-400"
                  }`}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-500">
                    <Type className="h-4 w-4" />
                  </span>
                  <span
                    className="min-w-0 flex-1 truncate text-[13px] font-semibold text-zinc-700"
                    style={{ fontFamily: l.font, fontStyle: l.italic ? "italic" : "normal" }}
                  >
                    {l.text || "(kosong)"}
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteLayer(l.id); }}
                    title="Hapus"
                    className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 hover:bg-rose-50 hover:text-rose-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Editor teks terpilih */}
      {selectedLayer && (
        <div className="mt-5 rounded-xl border border-zinc-200 p-3">
          <h3 className="mb-3 text-sm font-bold">Atur Teks</h3>

          {/* Isi teks */}
          <label className="mb-1 block text-[12px] font-semibold text-zinc-600">Isi teks</label>
          <textarea
            value={selectedLayer.text}
            onChange={(e) => updateSelectedText({ text: e.target.value })}
            rows={2}
            placeholder="Ketik teksmu di sini"
            data-testid="text-content-input"
            className="w-full resize-none rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-900"
          />

          {/* Font */}
          <label className="mb-1 mt-3 block text-[12px] font-semibold text-zinc-600">Jenis Font</label>
          <select
            value={selectedLayer.font}
            onChange={(e) => updateSelectedText({ font: e.target.value })}
            data-testid="text-font-select"
            className="w-full rounded-lg border border-zinc-300 px-2 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-900"
            style={{ fontFamily: selectedLayer.font }}
          >
            {FONTS.map((f) => (
              <option key={f.label} value={f.value} style={{ fontFamily: f.value }}>{f.label}</option>
            ))}
          </select>

          {/* Gaya & perataan */}
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={() => updateSelectedText({ bold: !selectedLayer.bold })}
              data-testid="text-bold-toggle"
              title="Tebal"
              className={`flex h-8 w-8 items-center justify-center rounded-md border ${selectedLayer.bold ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300 text-zinc-600 hover:bg-zinc-50"}`}
            ><Bold className="h-4 w-4" /></button>
            <button
              onClick={() => updateSelectedText({ italic: !selectedLayer.italic })}
              data-testid="text-italic-toggle"
              title="Miring"
              className={`flex h-8 w-8 items-center justify-center rounded-md border ${selectedLayer.italic ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300 text-zinc-600 hover:bg-zinc-50"}`}
            ><Italic className="h-4 w-4" /></button>
            <span className="mx-1 h-6 w-px bg-zinc-200" />
            {[
              { v: "left", Icon: AlignLeft },
              { v: "center", Icon: AlignCenter },
              { v: "right", Icon: AlignRight },
            ].map(({ v, Icon }) => (
              <button
                key={v}
                onClick={() => updateSelectedText({ align: v })}
                data-testid={`text-align-${v}`}
                title={`Rata ${v}`}
                className={`flex h-8 w-8 items-center justify-center rounded-md border ${selectedLayer.align === v ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300 text-zinc-600 hover:bg-zinc-50"}`}
              ><Icon className="h-4 w-4" /></button>
            ))}
          </div>

          {/* Warna */}
          <label className="mb-1 mt-3 block text-[12px] font-semibold text-zinc-600">Warna Teks</label>
          <div className="flex flex-wrap items-center gap-2">
            {TEXT_COLORS.map((hex) => {
              const active = selectedLayer.color.toLowerCase() === hex.toLowerCase();
              return (
                <button
                  key={hex}
                  onClick={() => updateSelectedText({ color: hex })}
                  data-testid={`text-color-${hex.replace('#','')}`}
                  title={hex}
                  className={`relative h-7 w-7 rounded-full border transition ${active ? "ring-2 ring-zinc-900 ring-offset-1" : "border-zinc-300 hover:scale-110"}`}
                  style={{ backgroundColor: hex }}
                >
                  {active && <Check className="absolute inset-0 m-auto h-3.5 w-3.5" style={{ color: hex.toLowerCase() === "#ffffff" ? "#111" : "#fff" }} />}
                </button>
              );
            })}
            <label className="flex h-7 w-7 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-zinc-300" title="Warna khusus">
              <input
                type="color"
                value={/^#([0-9a-f]{6})$/i.test(selectedLayer.color) ? selectedLayer.color : "#111111"}
                onChange={(e) => updateSelectedText({ color: e.target.value })}
                data-testid="text-color-custom"
                className="h-10 w-10 cursor-pointer border-0 bg-transparent p-0"
                style={{ transform: "translate(-4px,-4px)" }}
              />
            </label>
          </div>

          {/* Ukuran */}
          <div className="mb-3 mt-4">
            <div className="mb-1 flex items-center justify-between text-[12px] font-semibold text-zinc-600">
              <span>Ukuran</span>
              <span>{Math.round(selectedLayer.wPct)}%</span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => resizeSelected(-2)} className="flex h-8 w-8 items-center justify-center rounded-md border border-zinc-300 hover:bg-zinc-50" data-testid="text-size-minus"><Minus className="h-4 w-4" /></button>
              <input
                type="range" min={5} max={60} value={Math.round(selectedLayer.wPct)}
                onChange={(e) => resizeSelected(Number(e.target.value) - selectedLayer.wPct)}
                className="h-1.5 flex-1 cursor-pointer accent-zinc-900"
                data-testid="text-size-range"
              />
              <button onClick={() => resizeSelected(2)} className="flex h-8 w-8 items-center justify-center rounded-md border border-zinc-300 hover:bg-zinc-50" data-testid="text-size-plus"><Plus className="h-4 w-4" /></button>
            </div>
          </div>

          {/* Putar */}
          <div className="mb-3">
            <div className="mb-1 flex items-center justify-between text-[12px] font-semibold text-zinc-600">
              <span>Putar</span>
              <span>{rot}°</span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => rotateSelected(-15)} className="flex h-8 w-8 items-center justify-center rounded-md border border-zinc-300 hover:bg-zinc-50" data-testid="text-rotate-left"><RotateCcw className="h-4 w-4" /></button>
              <input
                type="range" min={0} max={360} value={rot}
                onChange={(e) => rotateSelected(Number(e.target.value) - rot)}
                className="h-1.5 flex-1 cursor-pointer accent-zinc-900"
                data-testid="text-rotate-range"
              />
              <button onClick={() => rotateSelected(15)} className="flex h-8 w-8 items-center justify-center rounded-md border border-zinc-300 hover:bg-zinc-50" data-testid="text-rotate-right"><RotateCw className="h-4 w-4" /></button>
            </div>
          </div>

          {/* Lengkung (arch) */}
          <div className="mb-3">
            <div className="mb-1 flex items-center justify-between text-[12px] font-semibold text-zinc-600">
              <span>Lengkung Teks</span>
              <span data-testid="text-curve-value">{Math.round(selectedLayer.curve || 0)}°</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => updateSelectedText({ curve: clamp((selectedLayer.curve || 0) - 10, -180, 180) })}
                className="flex h-8 w-8 items-center justify-center rounded-md border border-zinc-300 hover:bg-zinc-50"
                data-testid="text-curve-minus"
                title="Lengkungkan ke bawah"
              ><Minus className="h-4 w-4" /></button>
              <input
                type="range" min={-180} max={180} step={5}
                value={Math.round(selectedLayer.curve || 0)}
                onChange={(e) => updateSelectedText({ curve: Number(e.target.value) })}
                className="h-1.5 flex-1 cursor-pointer accent-zinc-900"
                data-testid="text-curve-range"
              />
              <button
                onClick={() => updateSelectedText({ curve: clamp((selectedLayer.curve || 0) + 10, -180, 180) })}
                className="flex h-8 w-8 items-center justify-center rounded-md border border-zinc-300 hover:bg-zinc-50"
                data-testid="text-curve-plus"
                title="Lengkungkan ke atas"
              ><Plus className="h-4 w-4" /></button>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2">
              <button
                onClick={() => updateSelectedText({ curve: 120 })}
                data-testid="text-curve-top"
                className="rounded-md border border-zinc-300 py-1.5 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-50"
              >Atas ⌢</button>
              <button
                onClick={() => updateSelectedText({ curve: 0 })}
                data-testid="text-curve-straight"
                className="rounded-md border border-zinc-300 py-1.5 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-50"
              >Lurus —</button>
              <button
                onClick={() => updateSelectedText({ curve: -120 })}
                data-testid="text-curve-bottom"
                className="rounded-md border border-zinc-300 py-1.5 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-50"
              >Bawah ⌣</button>
            </div>
            <p className="mt-1.5 text-[10px] leading-tight text-zinc-400">
              Untuk logo lingkaran: buat satu teks <b>Atas ⌢</b> dan satu teks <b>Bawah ⌣</b>.
            </p>
          </div>

          {/* Aksi cepat */}
          <div className="flex items-center gap-2">
            <button onClick={centerSelected} className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-zinc-300 py-2 text-[12px] font-semibold text-zinc-700 hover:bg-zinc-50" data-testid="text-center"><Move className="h-3.5 w-3.5" /> Tengah</button>
            <button onClick={resetRotation} className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-zinc-300 py-2 text-[12px] font-semibold text-zinc-700 hover:bg-zinc-50" data-testid="text-reset-rotate"><RotateCcw className="h-3.5 w-3.5" /> 0°</button>
            <button onClick={() => deleteLayer(selectedLayer.id)} className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-rose-200 py-2 text-[12px] font-semibold text-rose-600 hover:bg-rose-50" data-testid="text-delete"><Trash2 className="h-3.5 w-3.5" /> Hapus</button>
          </div>
        </div>
      )}
    </>
  );
}

/* =========================================================================
   PANEL: Clipart (pustaka aset transparan + upload sheet untuk auto-segmentasi)
   ========================================================================= */
function ClipartPanel({ addClipart }) {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("Semua");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/cliparts");
      setItems(data.items || []);
      setCategories(data.categories || []);
    } catch (e) {
      toast.error(formatApiError(e?.response?.data?.detail) || "Gagal memuat pustaka clip art.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const filtered = items.filter((it) => {
    const okCat = cat === "Semua" || it.category === cat;
    const hay = `${it.name} ${it.category} ${(it.tags || []).join(" ")}`.toLowerCase();
    const okQ = !q.trim() || hay.includes(q.toLowerCase());
    return okCat && okQ;
  });

  const onSheet = (file) => {
    if (!file) return;
    if (!/^image\//.test(file.type)) { toast.error("Pilih file gambar (PNG/JPG)."); return; }
    if (file.size > 20 * 1024 * 1024) { toast.error("Ukuran gambar maks 20MB."); return; }
    setUploading(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const { data } = await api.post("/cliparts/process", { image: reader.result });
        toast.success(`${data.added?.length || 0} clip art baru diproses & masuk pustaka.`);
        await load();
        if ((data.added || []).length) setCat("Uncategorized");
      } catch (e) {
        toast.error(formatApiError(e?.response?.data?.detail) || "Gagal memproses sheet.");
      } finally {
        setUploading(false);
      }
    };
    reader.onerror = () => { setUploading(false); toast.error("Gagal membaca file."); };
    reader.readAsDataURL(file);
  };

  return (
    <>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-bold">Clipart</h2>
        <span className="text-[11px] text-zinc-400">{items.length} aset</span>
      </div>

      {/* Upload sheet -> auto segmentasi */}
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        data-testid="clipart-sheet-input"
        onChange={(e) => { onSheet(e.target.files?.[0]); e.target.value = ""; }}
      />
      <button
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        data-testid="clipart-upload-sheet"
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-zinc-300 px-3 py-2.5 text-sm font-semibold text-zinc-700 hover:border-zinc-500 hover:bg-zinc-50 disabled:opacity-60"
      >
        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        {uploading ? "Memproses sheet…" : "Upload Sheet Clip Art"}
      </button>
      <p className="mt-1.5 text-[10px] leading-tight text-zinc-400">
        Unggah 1 gambar berisi banyak clip art (latar terang). Sistem memisahkan tiap gambar otomatis jadi PNG transparan.
      </p>

      {/* Cari */}
      <div className="mt-4 flex items-center gap-2 rounded-lg border border-zinc-300 px-2.5 py-1.5">
        <Search className="h-4 w-4 text-zinc-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cari clip art…"
          data-testid="clipart-search"
          className="w-full bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400"
        />
      </div>

      {/* Kategori */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {["Semua", ...categories].map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            data-testid={`clipart-cat-${c.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
              cat === c ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Grid aset */}
      <div className="mt-3">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-zinc-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Memuat…
          </div>
        ) : filtered.length === 0 ? (
          <p className="rounded-lg bg-zinc-50 px-3 py-6 text-center text-[12px] text-zinc-500">
            Tidak ada clip art yang cocok.
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-2" data-testid="clipart-grid">
            {filtered.map((it) => (
              <button
                key={it.id}
                onClick={() => addClipart(it)}
                title={`${it.name} · ${it.category}`}
                data-testid={`clipart-item-${it.id}`}
                className="group flex aspect-square items-center justify-center rounded-lg border border-zinc-200 bg-white p-1.5 transition hover:border-zinc-900 hover:shadow-sm"
              >
                <img
                  src={it.thumb}
                  alt={it.name}
                  loading="lazy"
                  className="max-h-full max-w-full object-contain transition group-hover:scale-105"
                  draggable={false}
                />
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

/* =========================================================================
   PANEL: Layer (atur urutan / tumpuk objek desain — z-order)
   Urutan tampil = paling depan di atas. (akhir array = depan)
   ========================================================================= */
function LayerPanel({ layers, selectedId, setSelectedId, moveLayer, deleteLayer }) {
  // tampilkan front-most dulu (kebalikan urutan array)
  const ordered = [...layers].reverse();
  const total = layers.length;

  return (
    <>
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-base font-bold">Layer</h2>
        <span className="text-[11px] text-zinc-400">{total} objek</span>
      </div>
      <p className="mb-3 text-[11px] leading-tight text-zinc-500">
        Objek paling atas berada di <b>depan</b>. Geser urutan untuk menumpuk desain.
      </p>

      {total === 0 ? (
        <p className="rounded-lg bg-zinc-50 px-3 py-6 text-center text-[12px] text-zinc-500">
          Belum ada objek di tampilan ini. Tambah teks, clip art, atau gambar dulu.
        </p>
      ) : (
        <div className="flex flex-col gap-2" data-testid="layer-list">
          {ordered.map((l, i) => {
            const isTxt = isTextLayer(l);
            const active = l.id === selectedId;
            const isFront = i === 0;
            const isBack = i === ordered.length - 1;
            return (
              <div
                key={l.id}
                onClick={() => setSelectedId(l.id)}
                data-testid={`layer-item-${l.id}`}
                className={`flex items-center gap-2 rounded-lg border p-2 transition ${
                  active ? "border-zinc-900 bg-zinc-50" : "border-zinc-200 hover:border-zinc-400"
                }`}
              >
                {/* thumbnail */}
                <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md border border-zinc-200 bg-white">
                  {isTxt ? (
                    <span className="text-[9px] font-bold leading-none text-zinc-700" style={{ fontFamily: l.font }}>
                      {(l.text || "T").slice(0, 3) || "T"}
                    </span>
                  ) : (
                    <img src={l.src} alt={l.name || "objek"} className="h-full w-full object-contain" draggable={false} />
                  )}
                </span>

                {/* nama */}
                <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-zinc-700">
                  {isTxt ? (l.text || "Teks") : (l.name || "Gambar")}
                </span>

                {/* kontrol urutan */}
                <div className="flex items-center gap-0.5">
                  <button
                    onClick={(e) => { e.stopPropagation(); moveLayer(l.id, "front"); }}
                    disabled={isFront}
                    title="Paling depan"
                    data-testid={`layer-front-${l.id}`}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 disabled:opacity-30"
                  ><ChevronsUp className="h-4 w-4" /></button>
                  <button
                    onClick={(e) => { e.stopPropagation(); moveLayer(l.id, "up"); }}
                    disabled={isFront}
                    title="Maju ke depan"
                    data-testid={`layer-up-${l.id}`}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 disabled:opacity-30"
                  ><ArrowUp className="h-4 w-4" /></button>
                  <button
                    onClick={(e) => { e.stopPropagation(); moveLayer(l.id, "down"); }}
                    disabled={isBack}
                    title="Mundur ke belakang"
                    data-testid={`layer-down-${l.id}`}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 disabled:opacity-30"
                  ><ArrowDown className="h-4 w-4" /></button>
                  <button
                    onClick={(e) => { e.stopPropagation(); moveLayer(l.id, "back"); }}
                    disabled={isBack}
                    title="Paling belakang"
                    data-testid={`layer-back-${l.id}`}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 disabled:opacity-30"
                  ><ChevronsDown className="h-4 w-4" /></button>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteLayer(l.id); }}
                    title="Hapus"
                    data-testid={`layer-delete-${l.id}`}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 hover:bg-rose-50 hover:text-rose-600"
                  ><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

/* =========================================================================
   PANEL: placeholder untuk tool yang belum aktif
   ========================================================================= */
function ComingSoon({ tool, onUpload, setActiveTool }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-100 text-zinc-400">
        <Shapes className="h-6 w-6" />
      </div>
      <div>
        <h2 className="text-base font-bold">{tool}</h2>
        <p className="mt-1 text-[12px] text-zinc-500">Fitur ini segera hadir.</p>
      </div>
      <button
        onClick={() => { setActiveTool("Gambar Saya"); onUpload(); }}
        className="mt-1 flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
      >
        <Upload className="h-4 w-4" /> Upload Gambar Saya
      </button>
    </div>
  );
}

/* small toolbar icon with tiny label under it */
function ToolbarIcon({ icon: Icon, label }) {
  return (
    <button className="flex w-12 flex-col items-center gap-0.5 rounded-lg py-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900">
      <Icon className="h-4.5 w-4.5" style={{ width: 18, height: 18 }} />
      <span className="text-[10px] leading-none">{label}</span>
    </button>
  );
}

/**
 * Thumbnail mockup yang ikut ter-tint sesuai warna aktif.
 */
function TintedThumb({ src, mask, color, alt, size = 36, inner = 28 }) {
  const isWhite = color.toLowerCase() === "#ffffff";
  return (
    <span
      className="relative flex items-center justify-center rounded-lg bg-zinc-100"
      style={{ height: size, width: size }}
    >
      <img src={src} alt={alt} className="object-contain" style={{ height: inner, width: inner }} />
      {!isWhite && mask && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute"
          style={{
            height: inner,
            width: inner,
            backgroundColor: color,
            mixBlendMode: "multiply",
            WebkitMaskImage: `url(${mask})`,
            maskImage: `url(${mask})`,
            WebkitMaskSize: "contain",
            maskSize: "contain",
            WebkitMaskPosition: "center",
            maskPosition: "center",
            WebkitMaskRepeat: "no-repeat",
            maskRepeat: "no-repeat",
          }}
        />
      )}
    </span>
  );
}
