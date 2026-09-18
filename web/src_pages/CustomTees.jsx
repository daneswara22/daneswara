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
import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Shirt, Upload, Type, Shapes, ImageIcon, LayoutTemplate, Layers,
  Undo2, Redo2, Save, HelpCircle, ChevronRight, ChevronDown, Check,
  Minus, Plus, RotateCcw, RotateCw, ArrowRight, LifeBuoy, Trash2, X, Move,
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
  { icon: Upload, label: "Desain", sub: "Upload Template" },
  { icon: Type, label: "Teks", sub: "Tambah Tulisan" },
  { icon: Shapes, label: "Clipart", sub: "Gambar & Bentuk" },
  { icon: ImageIcon, label: "Gambar Saya", sub: "File yang diupload" },
  { icon: LayoutTemplate, label: "Template", sub: "Desain Siap Pakai" },
  { icon: Layers, label: "Layer", sub: "Atur Urutan Objek" },
];

const STEPS = ["Produk", "Desain", "Preview", "Pesanan"];

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const emptyDesign = () => ({ "Depan": [], "Belakang": [], "Lengan Kiri": [], "Lengan Kanan": [] });

export default function CustomTees() {
  const navigate = useNavigate();
  const [view, setView] = useState("Depan");
  const [color, setColor] = useState(SWATCHES[0]); // Putih (default)
  const isWhite = color.hex.toLowerCase() === "#ffffff";

  const [activeTool, setActiveTool] = useState("Produk");
  // Desain objek per-tampilan: { [view]: [ {id, src, cx, cy, wPct, rot} ] }
  const [design, setDesign] = useState(emptyDesign);
  const [selectedId, setSelectedId] = useState(null);

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
      const layer = { id, src: reader.result, name: file.name, cx: 50, cy: 42, wPct: 42, rot: 0 };
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
              layers={layers}
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
          ) : activeTool === "Produk" ? (
            <ProductPanel color={color} setColor={setColor} />
          ) : (
            <ComingSoon tool={activeTool} onUpload={triggerUpload} setActiveTool={setActiveTool} />
          )}
        </aside>

        {/* -------- Canvas -------- */}
        <main className="relative flex min-w-0 flex-1 flex-col items-center justify-center bg-zinc-100">
          <div className="flex w-full max-w-[560px] flex-col items-center px-6">
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
              {layers.map((l) => {
                const selected = l.id === selectedId;
                return (
                  <div
                    key={l.id}
                    onPointerDown={(e) => startMove(e, l.id)}
                    data-testid={`design-layer-${l.id}`}
                    className="absolute cursor-move"
                    style={{
                      left: `${l.cx}%`,
                      top: `${l.cy}%`,
                      width: `${l.wPct}%`,
                      transform: `translate(-50%, -50%) rotate(${l.rot}deg)`,
                      touchAction: "none",
                      zIndex: selected ? 30 : 20,
                    }}
                  >
                    <img
                      src={l.src}
                      alt={l.name || "Gambar desain"}
                      draggable={false}
                      className="pointer-events-none block h-auto w-full select-none"
                    />
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
                          Klik gambar untuk melakukan perubahan
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
          <button className="flex items-center gap-2 rounded-lg border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50">
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
