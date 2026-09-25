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
import { useState, useRef, useEffect, useCallback, useLayoutEffect, useId, useMemo } from "react";
import { toast } from "sonner";
import api, { formatApiError } from "@/lib/api";
import {
  Shirt, Upload, Type, Shapes, ImageIcon, LayoutTemplate, Layers,
  Undo2, Redo2, Save, ChevronRight, ChevronDown, Check,
  Minus, Plus, RotateCcw, RotateCw, ArrowRight, Trash2, X, Move,
  Bold, Italic, AlignLeft, AlignCenter, AlignRight, Search, Loader2,
  ArrowUp, ArrowDown, ChevronsUp, ChevronsDown, ClipboardList, Send, CheckCircle2,
  Home, LayoutDashboard,
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

/* ---------- fallback ukuran & warna (dipakai kalau data produk belum ada) --- */
const FALLBACK_SIZES = ["S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL"];
const SIZE_ORDER = ["XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL", "6XL"];
const sizeRank = (s) => {
  const i = SIZE_ORDER.indexOf(String(s || "").toUpperCase());
  return i === -1 ? 900 : i;
};
const FALLBACK_SWATCHES = [
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

/* ---------- produk bawaan (fallback kalau API jenis produk belum terbaca) --- */
const FALLBACK_PRODUCT = {
  product_key: "premium-cotton-7200",
  title: "24 COTTON LOCAL SIZE (BUILDUP TEES)",
  subtitle: "Kaos 24s Dengan ukuran local",
  price: 0,
  supplier: "",
  size_region: "",
  model: "",
  material: "",
  description: "",
  colors: [],
  size_chart: [],
};
const ORDER_STATUSES = ["Baru", "Diproses", "Selesai", "Dibatalkan"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/* ---------- helper jumlah per ukuran (multi-size, satu desain) ---------- */
function selectedSizeItems(sizeQty) {
  return Object.keys(sizeQty || {})
    .filter((s) => Number(sizeQty[s]) > 0)
    .sort((a, b) => sizeRank(a) - sizeRank(b) || String(a).localeCompare(String(b)))
    .map((s) => ({ size: s, qty: Number(sizeQty[s]) }));
}
function totalPcs(sizeQty) {
  return selectedSizeItems(sizeQty).reduce((a, it) => a + it.qty, 0);
}
function sizeRecapText(items) {
  const list = Array.isArray(items) ? items : [];
  if (list.length === 0) return "—";
  return list.map((it) => `${it.size} × ${it.qty}`).join(", ");
}

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
/* Pemetaan ekstensi -> nilai format() pada aturan @font-face. */
const FONT_CSS_FORMAT = { woff2: "woff2", woff: "woff", ttf: "truetype", otf: "opentype" };
/* Panduan format font yang ditampilkan di panel "Kelola Font". */
const FONT_FORMAT_LABELS = [
  { ext: "WOFF2", badge: "Paling ideal", tone: "good", note: "Paling ringan & cepat dimuat" },
  { ext: "WOFF", badge: "Bagus", tone: "ok", note: "Cadangan untuk browser lama" },
  { ext: "TTF", badge: "Berat", tone: "warn", note: "Sebaiknya diubah ke WOFF2" },
  { ext: "OTF", badge: "Berat", tone: "warn", note: "Sebaiknya diubah ke WOFF2" },
];
const FONT_MAX_BYTES = 3 * 1024 * 1024;
/* Ubah label font jadi slug untuk data-testid, mis. "Inter (Google)" -> "inter-google". */
const slugifyFontLabel = (label) =>
  String(label || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const TEXT_COLORS = [
  "#111111", "#ffffff", "#c0392b", "#e67e22", "#f1c40f",
  "#27ae60", "#1f3fae", "#7d3cc9", "#2ea67a", "#f4b8cf",
];
// canvas tinggi = 62vh; fontSize teks = (wPct/100) * 62vh agar skala relatif terhadap kaos
const CANVAS_VH = 62;
const textFontVh = (wPct) => (wPct / 100) * CANVAS_VH;
const isTextLayer = (l) => l && l.type === "text";

export default function CustomTees({ publicMode = false, canManageFonts: canManageFontsProp }) {
  const [view, setView] = useState("Depan");
  const [color, setColor] = useState(FALLBACK_SWATCHES[0]); // Putih (default)
  const isWhite = color.hex.toLowerCase() === "#ffffff";

  /* ---------- jenis produk (dikelola admin di /app/mockup-kaos) ----------
     Daftar produk aktif diambil dari GET /api/public/custom-products. Ukuran
     dan warna pada panel Produk mengikuti produk yang sedang dipilih. */
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productId, setProductId] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [sizeGuideOpen, setSizeGuideOpen] = useState(false);

  const [activeTool, setActiveTool] = useState("Produk");
  // HP: panel alat tampil sebagai lembar geser bawah. null = tertutup.
  const [mobileSheet, setMobileSheet] = useState(null);
  const [sizeQty, setSizeQty] = useState({ L: 1 });
  // Desain objek per-tampilan: { [view]: [ {id, src, cx, cy, wPct, rot} ] }
  const [design, setDesign] = useState(emptyDesign);
  const [selectedId, setSelectedId] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  /* ---------- alur pesanan (Cek Harga -> form customer -> kirim) ---------- */
  const [checkingPrice, setCheckingPrice] = useState(false);
  const [orderFormOpen, setOrderFormOpen] = useState(false);
  const [draftId, setDraftId] = useState(null);
  const [ordersOpen, setOrdersOpen] = useState(false);
  const [newOrderCount, setNewOrderCount] = useState(0);
  /** Estimasi harga dari server (POST /api/public/custom-tees/quote). */
  const [quote, setQuote] = useState(null);

  /* ---------- font kustom (diunggah admin lewat panel Teks) ----------
     Daftar font aktif diambil dari GET /api/public/fonts, lalu aturan
     @font-face-nya disuntikkan ke <head> supaya langsung bisa dipakai. */
  const [customFonts, setCustomFonts] = useState([]);
  const [fontsLoading, setFontsLoading] = useState(true);
  const [fontManagerOpen, setFontManagerOpen] = useState(false);

  const loadFonts = useCallback(async () => {
    try {
      const { data } = await api.get("/public/fonts");
      setCustomFonts(Array.isArray(data?.items) ? data.items : []);
    } catch {
      setCustomFonts([]);
    } finally {
      setFontsLoading(false);
    }
  }, []);

  useEffect(() => { loadFonts(); }, [loadFonts]);

  // Suntikkan @font-face / <link> Google untuk tiap font kustom (dibersihkan saat unmount).
  useEffect(() => {
    if (typeof document === "undefined" || customFonts.length === 0) return;
    const nodes = [];

    // 1) Font Google: cukup satu <link> ke CSS resmi Google (tanpa berkas lokal).
    const googleUrls = Array.from(
      new Set(
        customFonts
          .filter((f) => f.source === "google" && f.css_href)
          .map((f) => f.css_href),
      ),
    );
    googleUrls.forEach((href) => {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      link.setAttribute("data-dnsw-google-font", "1");
      document.head.appendChild(link);
      nodes.push(link);
    });

    // 2) Font unggahan: @font-face ke berkas same-origin.
    const uploaded = customFonts.filter((f) => f.source !== "google" && f.file_href);
    if (uploaded.length > 0) {
      const css = uploaded
        .map((f) => {
          const fmt = FONT_CSS_FORMAT[f.format] || "woff2";
          return `@font-face{font-family:"${f.family}";src:url("${f.file_href}") format("${fmt}");font-display:swap;}`;
        })
        .join("\n");
      const el = document.createElement("style");
      el.setAttribute("data-dnsw-custom-fonts", "1");
      el.textContent = css;
      document.head.appendChild(el);
      nodes.push(el);
    }

    return () => { (nodes || []).forEach((n) => n.remove()); };
  }, [customFonts]);

  /** Font bawaan + font kustom admin, dipakai dropdown "Jenis Font". */
  const fontOptions = useMemo(() => {
    const extra = customFonts.map((f) => ({
      label: `${f.name} (${f.source === "google" ? "Google" : "kustom"})`,
      value: `"${f.family}", sans-serif`,
      custom: true,
    }));
    return [...FONTS, ...extra];
  }, [customFonts]);

  const canvasRef = useRef(null);

  /* Kanvas tetap setinggi 62vh di semua layar supaya skala teks (yang memakai
     satuan vh) dan hasil preview identik. Di layar sempit (HP) lebar alaminya
     tidak cukup, jadi kanvas hanya DIPERKECIL secara visual dengan CSS
     transform. Semua perhitungan geser/putar/ubah-ukuran memakai persentase
     dari getBoundingClientRect, jadi tetap akurat meski diperkecil. */
  const canvasWrapRef = useRef(null);
  const [canvasScale, setCanvasScale] = useState(1);
  const fitCanvas = useCallback(() => {
    const el = canvasRef.current;
    const wrap = canvasWrapRef.current;
    if (!el || !wrap) return;
    const natural = el.offsetWidth;   // lebar layout, tidak terpengaruh transform
    const avail = wrap.clientWidth;
    if (!natural || !avail) return;
    setCanvasScale(natural > avail ? avail / natural : 1);
  }, []);
  useLayoutEffect(() => {
    fitCanvas();
    window.addEventListener("resize", fitCanvas);
    window.addEventListener("orientationchange", fitCanvas);
    return () => {
      window.removeEventListener("resize", fitCanvas);
      window.removeEventListener("orientationchange", fitCanvas);
    };
  }, [fitCanvas]);
  const fileInputRef = useRef(null);
  const gesture = useRef(null); // { mode, id, view, ... }

  /* ---------- muat daftar jenis produk (publik, tanpa login) ---------- */
  useEffect(() => {
    let alive = true;
    setProductsLoading(true);
    api
      .get("/public/custom-products?limit=50")
      .then(({ data }) => {
        if (!alive) return;
        const list = Array.isArray(data?.items) ? data.items : [];
        setProducts(list);
        if (list.length === 0) return;
        // hormati ?product=<product_key> (mis. dari tombol di Daftar Harga)
        let wanted = null;
        if (typeof window !== "undefined") {
          const qs = new URLSearchParams(window.location.search).get("product");
          if (qs) wanted = list.find((p) => p.product_key === qs) || null;
        }
        setProductId((wanted || list[0]).id);
      })
      .catch(() => { /* fallback ke produk bawaan */ })
      .finally(() => { if (alive) setProductsLoading(false); });
    return () => { alive = false; };
  }, []);

  const product = useMemo(
    () => products.find((p) => p.id === productId) || (products.length ? products[0] : FALLBACK_PRODUCT),
    [products, productId],
  );

  /** Ukuran yang tersedia = size chart produk (fallback ke daftar standar). */
  const sizes = useMemo(() => {
    const list = (product?.size_chart || []).map((s) => s.label);
    return list.length ? list : FALLBACK_SIZES;
  }, [product]);

  /** Warna yang tersedia = varian warna produk (fallback ke palet bawaan). */
  const swatches = useMemo(() => {
    const list = (product?.colors || [])
      .filter((c) => c.is_active !== false)
      .map((c) => ({ name: c.name, hex: c.hex, thumb_url: c.thumb_url || "" }));
    return list.length ? list : FALLBACK_SWATCHES;
  }, [product]);

  /* Saat produk berganti: warna & ukuran ikut menyesuaikan produk baru.
     Jumlah per ukuran yang masih valid dipertahankan supaya tidak hilang. */
  useEffect(() => {
    if (!product) return;
    setColor((prev) => {
      const match = swatches.find((c) => c.hex.toLowerCase() === String(prev?.hex || "").toLowerCase());
      return match || swatches[0];
    });
    setSizeQty((prev) => {
      const kept = {};
      for (const s of sizes) {
        if (Number(prev?.[s]) > 0) kept[s] = Number(prev[s]);
      }
      if (Object.keys(kept).length) return kept;
      const def = sizes.includes("L") ? "L" : sizes[0];
      return def ? { [def]: 1 } : {};
    });
  }, [product?.id]);

  const layers = design[view] || [];
  const selectedLayer = layers.find((l) => l.id === selectedId) || null;

  /* ---------- update satu objek pada tampilan tertentu ---------- */
  const applyPatch = useCallback((viewName, id, patch) => {
    setDesign((d) => ({
      ...d,
      [viewName]: (d[viewName] || []).map((l) => (l.id === id ? { ...l, ...patch } : l)),
    }));
  }, []);

  /* ---------- pointer gestures (drag / resize / rotate) ----------
     Deterministic lifecycle built on EXPLICIT pointer capture bound to the
     stable canvas element (canvasRef). The canvas never unmounts or moves
     during an interaction, so once we capture the pointer to it every
     pointermove / pointerup / pointercancel for that exact pointer is
     delivered to a single stable target — even while the dragged layer
     re-renders, changes z-order, resizes, rotates, or slides out from under
     the finger. `gesture.current` is the single source of truth and is keyed
     by `pointerId`, which prevents stale/competing drag state and stops a
     second (multi-touch) pointer from cancelling or hijacking an active drag.
     After every interaction we return to a clean idle state WITHOUT touching
     `selectedId`, so the object stays selected and immediately draggable
     again — no deselect/reselect workaround is ever required. */
  const centerOf = (l, rect) => ({
    x: rect.left + (l.cx / 100) * rect.width,
    y: rect.top + (l.cy / 100) * rect.height,
  });

  // Capture the pointer on the stable canvas element and record drag state.
  const beginGesture = (e, base) => {
    const canvas = canvasRef.current;
    const rect = canvas?.getBoundingClientRect();
    if (!canvas || !rect) return;
    try { canvas.setPointerCapture(e.pointerId); } catch { /* capture unsupported/lost */ }
    if (e.cancelable) e.preventDefault();
    gesture.current = { ...base, pointerId: e.pointerId, rect };
  };

  const startMove = (e, id) => {
    e.stopPropagation();
    if (gesture.current) return; // a gesture is already in progress
    setSelectedId(id);
    const l = layers.find((x) => x.id === id);
    if (!l) return;
    beginGesture(e, {
      mode: "move", id, view,
      startX: e.clientX, startY: e.clientY,
      startCx: l.cx, startCy: l.cy,
    });
  };

  const startResize = (e, id) => {
    e.stopPropagation();
    if (gesture.current) return;
    setSelectedId(id);
    const rect = canvasRef.current?.getBoundingClientRect();
    const l = layers.find((x) => x.id === id);
    if (!rect || !l) return;
    const c = centerOf(l, rect);
    beginGesture(e, {
      mode: "resize", id, view,
      centerX: c.x, centerY: c.y,
      startDist: Math.hypot(e.clientX - c.x, e.clientY - c.y),
      startW: l.wPct,
    });
  };

  const startRotate = (e, id) => {
    e.stopPropagation();
    if (gesture.current) return;
    setSelectedId(id);
    const rect = canvasRef.current?.getBoundingClientRect();
    const l = layers.find((x) => x.id === id);
    if (!rect || !l) return;
    const c = centerOf(l, rect);
    beginGesture(e, { mode: "rotate", id, view, centerX: c.x, centerY: c.y });
  };

  // Move handler bound to the canvas; only the pointer that started the
  // gesture is honoured (guards against multi-touch / stray pointers).
  const onCanvasPointerMove = (e) => {
    const g = gesture.current;
    if (!g || e.pointerId !== g.pointerId) return;
    if (g.mode === "move") {
      const dx = ((e.clientX - g.startX) / g.rect.width) * 100;
      const dy = ((e.clientY - g.startY) / g.rect.height) * 100;
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

  // Finalise: release capture + clear temporary drag state. Selection is
  // intentionally preserved so the object stays draggable immediately.
  const endGesture = (e) => {
    const g = gesture.current;
    if (!g) return;
    if (e && typeof e.pointerId === "number" && e.pointerId !== g.pointerId) return;
    const canvas = canvasRef.current;
    try {
      if (canvas && canvas.hasPointerCapture && canvas.hasPointerCapture(g.pointerId)) {
        canvas.releasePointerCapture(g.pointerId);
      }
    } catch { /* ignore */ }
    gesture.current = null;
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

  /* =======================================================================
     ALUR PESANAN (tambahan) — desain TIDAK pernah dihapus oleh alur ini.
     "Cek Harga" menyimpan desain sebagai draft lalu membuka form customer.
     ======================================================================= */
  const designPayload = useCallback(() => {
    const items = selectedSizeItems(sizeQty);
    return {
      product_key: product?.product_key || FALLBACK_PRODUCT.product_key,
      product_title: product?.title || FALLBACK_PRODUCT.title,
      size: items.map((it) => it.size).join(", "),
      size_items: items,
      qty: items.reduce((a, it) => a + it.qty, 0),
      color_name: color.name,
      color_hex: color.hex,
      design,
    };
  }, [sizeQty, color, design, product]);

  const refreshOrderCount = useCallback(async () => {
    if (publicMode) return;   // badge admin tidak ada di halaman publik
    try {
      const { data } = await api.get("/custom-tees/orders/count");
      setNewOrderCount(Number(data?.new || 0));
    } catch { /* badge bersifat opsional */ }
  }, [publicMode]);

  useEffect(() => { refreshOrderCount(); }, [refreshOrderCount]);

  const handleCheckPrice = useCallback(async () => {
    if (checkingPrice) return;
    if (selectedSizeItems(sizeQty).length === 0) {
      toast.error("Pilih ukuran dan isi jumlahnya dulu ya");
      return;
    }
    if (VIEWS.reduce((a, v) => a + (design[v] || []).length, 0) === 0) {
      toast.error("Desainnya masih kosong — tambahkan teks, clipart, atau gambar dulu");
      return;
    }
    setCheckingPrice(true);
    try {
      const payload = designPayload();
      // Estimasi harga dihitung di server supaya angkanya tidak bisa diubah
      // dari browser. Kalau gagal, alur pesanan tetap lanjut tanpa angka.
      const quotePromise = api
        .post("/public/custom-tees/quote", {
          size: payload.size,
          size_items: payload.size_items,
          qty: payload.qty,
          design: payload.design,
        })
        .then((r) => r.data)
        .catch(() => null);
      const { data } = await api.post("/public/custom-tees/drafts", payload);
      setDraftId(data?.id || null);
      setQuote(await quotePromise);
      setPreviewOpen(false);
      setOrderFormOpen(true);
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    } finally {
      setCheckingPrice(false);
    }
  }, [checkingPrice, designPayload, sizeQty, design]);

  const submitOrder = useCallback(async (customer) => {
    const { data } = await api.post("/public/custom-tees/orders", {
      ...designPayload(),
      draft_id: draftId,
      customer_name: customer.name,
      customer_phone: customer.phone,
      customer_email: customer.email,
      design: draftId ? undefined : design,
    });
    setDraftId(null);
    refreshOrderCount();
    return data;
  }, [designPayload, draftId, design, refreshOrderCount]);

  /* Panel alat dipakai dua kali: di panel kiri (layar lebar) dan di lembar
     geser bawah (HP). Dibuat satu variabel supaya isinya tidak dobel. */
  const toolPanel = activeTool === "Gambar Saya" ? (
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
      fontOptions={fontOptions}
      fontsLoading={fontsLoading}
      customFontCount={customFonts.length}
      canManageFonts={canManageFontsProp ?? !publicMode}
      onManageFonts={() => setFontManagerOpen(true)}
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
    <ProductPanel
      color={color}
      setColor={setColor}
      sizeQty={sizeQty}
      setSizeQty={setSizeQty}
      product={product}
      products={products}
      productsLoading={productsLoading}
      sizes={sizes}
      swatches={swatches}
      onOpenPicker={() => setPickerOpen(true)}
      onOpenSizeGuide={() => setSizeGuideOpen(true)}
    />
  ) : (
    <ComingSoon tool={activeTool} onUpload={triggerUpload} setActiveTool={setActiveTool} />
  );

  return (
    <div className="flex h-screen w-full overflow-hidden bg-zinc-100 text-zinc-900">      {/* input file tersembunyi untuk upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg"
        className="hidden"
        onChange={onInputChange}
        data-testid="custom-file-input"
      />

      {/* Desainer: satu tata letak untuk semua ukuran layar.
          Di HP, panel alat pindah ke bilah bawah + lembar geser (sheet),
          pemilih tampilan jadi chip di atas kanvas, dan tombol aksi dibuat
          padat. Ukuran kanvas tetap 62vh di semua layar supaya skala teks
          dan hasil preview tidak berubah. */}
      <div className="flex h-full w-full flex-col">
      {/* ============================ TOP BAR ============================ */}
      <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-zinc-200 bg-white px-3 md:h-16 md:px-4">
        {/* Brand */}
        <div className="flex min-w-0 items-center gap-2 md:gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-neutral-900 p-1.5 md:h-10 md:w-10">
            <img src="/logo.png" alt="Daneswara" className="h-full w-full object-contain" />
          </div>
          <div className="min-w-0 leading-tight">
            <div className="truncate text-sm font-bold tracking-tight md:text-[15px]">Custom Tees</div>
            <div className="hidden text-[11px] text-zinc-500 sm:block">Desain Sesukamu, Pakai Gayamu</div>
          </div>
        </div>

        {/* Stepper */}
        <div className="hidden items-center gap-2 lg:flex">
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
        <div className="flex shrink-0 items-center gap-1">
          {publicMode ? (
            <a
              href="/"
              data-testid="designer-home-link"
              title="Beranda"
              className="flex items-center gap-1.5 rounded-full border border-zinc-300 px-2.5 py-1.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 md:mr-1 md:px-3.5"
            >
              <Home className="h-4 w-4 sm:hidden" />
              <span className="hidden sm:inline">Beranda</span>
            </a>
          ) : (
            <>
              <a
                href="/app"
                data-testid="designer-dashboard-link"
                title="Dashboard"
                className="flex items-center gap-1.5 rounded-full border border-zinc-300 px-2.5 py-1.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 md:mr-1 md:px-3.5"
              >
                <LayoutDashboard className="h-4 w-4" />
                <span className="hidden sm:inline">Dashboard</span>
              </a>
              <a
                href="/"
                data-testid="designer-home-link"
                title="Beranda"
                className="flex items-center gap-1.5 rounded-full border border-zinc-300 px-2.5 py-1.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 md:mr-1 md:px-3.5"
              >
                <Home className="h-4 w-4" />
                <span className="hidden sm:inline">Beranda</span>
              </a>
            </>
          )}
          {!publicMode && (
            <button
              onClick={() => setOrdersOpen(true)}
              data-testid="open-orders-button"
              title="Pesanan"
              className="flex items-center gap-1.5 rounded-full border border-zinc-300 px-2.5 py-1.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 md:mr-1 md:px-3.5"
            >
              <ClipboardList className="h-4 w-4" />
              <span className="hidden sm:inline">Pesanan</span>
              {newOrderCount > 0 && (
                <span
                  data-testid="orders-badge"
                  className="ml-0.5 inline-flex min-w-[20px] items-center justify-center rounded-full bg-blue-600 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white"
                >
                  {newOrderCount}
                </span>
              )}
            </button>
          )}
          <div className="hidden items-center gap-1 md:flex">
            <ToolbarIcon icon={Undo2} label="Undo" />
            <ToolbarIcon icon={Redo2} label="Redo" />
            <ToolbarIcon icon={Save} label="Simpan" />
          </div>
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
          {/* Bantuan pelanggan lewat tombol bulat "Customer Live Chat" di pojok kiri bawah. */}
        </nav>

        {/* -------- Left panel (konten sesuai tool aktif) -------- */}
        <aside className="hidden w-[300px] shrink-0 flex-col overflow-y-auto border-r border-zinc-200 bg-white p-4 lg:flex">
          {toolPanel}
        </aside>

        {/* -------- Canvas -------- */}
        <main className="relative flex min-w-0 flex-1 flex-col items-center overflow-y-auto overflow-x-hidden bg-zinc-100 md:justify-center">
          {/* HP: pemilih tampilan kaos (Depan / Belakang / Lengan) */}
          <div
            className="sticky top-0 z-10 flex w-full shrink-0 gap-2 overflow-x-auto border-b border-zinc-200 bg-white/95 px-3 py-2 backdrop-blur md:hidden"
            data-testid="mobile-view-switcher"
          >
            {VIEWS.map((v) => {
              const count = (design[v] || []).length;
              const active = view === v;
              return (
                <button
                  key={v}
                  onClick={() => { setView(v); setSelectedId(null); }}
                  data-testid={`mobile-view-${v.toLowerCase().replace(/\s+/g, "-")}`}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                    active ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300 bg-white text-zinc-600"
                  }`}
                >
                  {v}
                  {count > 0 && (
                    <span className={`rounded-full px-1.5 text-[10px] font-bold ${active ? "bg-white text-zinc-900" : "bg-zinc-900 text-white"}`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex w-full max-w-[560px] flex-col items-center px-3 py-4 md:px-6 md:py-0">
            {/* Label tampilan aktif */}
            <div
              className="mb-3 inline-flex items-center gap-2 rounded-full bg-zinc-900 px-4 py-1.5 text-sm font-bold uppercase tracking-wide text-white shadow-sm"
              data-testid="active-view-label"
            >
              <Shirt className="h-4 w-4" />
              {view}
            </div>
            {/* Pembungkus penyesuai lebar: di HP kanvas diperkecil, bukan dipotong */}
            <div
              ref={canvasWrapRef}
              className="flex w-full justify-center"
              data-testid="tee-canvas-fit"
              style={canvasScale < 1 ? { height: `calc(62vh * ${canvasScale})` } : undefined}
            >
            <div style={canvasScale < 1 ? { transform: `scale(${canvasScale})`, transformOrigin: "top center" } : undefined} className="shrink-0">
            <div
              ref={canvasRef}
              className="relative h-[62vh] w-auto"
              data-testid="tee-canvas"
              style={{ touchAction: "none" }}
              onPointerDown={(e) => { if (e.target === e.currentTarget || e.target.tagName === "IMG") setSelectedId(null); }}
              onPointerMove={onCanvasPointerMove}
              onPointerUp={endGesture}
              onPointerCancel={endGesture}
              onLostPointerCapture={endGesture}
            >
              <img
                src={MOCKUPS[view]}
                alt={`Kaos tampak ${view}`}
                onLoad={fitCanvas}
                className="pointer-events-none h-full w-auto object-contain drop-shadow-sm"
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
            </div>
            </div>
            <div className="mt-4 w-full max-w-[430px] border-t border-dashed border-zinc-300 pt-2 text-center text-[11px] font-semibold tracking-[0.2em] text-zinc-400 md:mt-6">
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

          {/* Detail Produk - selalu terbuka, di bawah Status Desain (Lengan Kanan) */}
          <ProductDetailCard product={product} />
        </aside>
      </div>

      {/* ============================ BOTTOM BAR ============================ */}
      <footer className="flex shrink-0 items-center justify-between gap-2 border-t border-zinc-200 bg-white px-3 py-2 md:h-16 md:px-4 md:py-0">
        <div className="flex shrink-0 items-center gap-2 md:gap-3">
          <button
            onClick={() => resizeSelected(-5)}
            disabled={!selectedLayer}
            data-testid="size-minus-button"
            aria-label="Perkecil objek"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-300 text-zinc-600 hover:bg-zinc-50 disabled:opacity-40 md:h-8 md:w-8"
          >
            <Minus className="h-4 w-4" />
          </button>
          <span className="w-10 text-center text-sm font-semibold md:w-16">
            {selectedLayer ? `${Math.round(selectedLayer.wPct)}%` : "—"}
          </span>
          <button
            onClick={() => resizeSelected(5)}
            disabled={!selectedLayer}
            data-testid="size-plus-button"
            aria-label="Perbesar objek"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-300 text-zinc-600 hover:bg-zinc-50 disabled:opacity-40 md:h-8 md:w-8"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        <div className="flex min-w-0 items-center gap-1.5 md:gap-2">
          <button
            onClick={() => setPreviewOpen(true)}
            data-testid="save-design-button"
            title="Simpan Desain"
            className="flex items-center gap-2 rounded-lg border border-zinc-300 px-2.5 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 md:px-4"
          >
            <Save className="h-4 w-4" />
            <span className="hidden md:inline">Simpan Desain</span>
          </button>
          <button
            onClick={resetView}
            data-testid="reset-design-button"
            title="Reset Desain"
            className="flex items-center gap-2 rounded-lg border border-zinc-300 px-2.5 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50 md:px-4"
          >
            <RotateCcw className="h-4 w-4" />
            <span className="hidden md:inline">Reset Desain</span>
          </button>
          <button
            onClick={() => setPreviewOpen(true)}
            data-testid="continue-button"
            className="flex shrink-0 items-center gap-1.5 rounded-lg bg-zinc-900 px-3.5 py-2 text-sm font-semibold text-white hover:bg-zinc-800 md:gap-2 md:px-5"
          >
            Lanjutkan <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </footer>

      {/* ---------- HP: bilah alat bawah (pengganti tool rail) ---------- */}
      <nav
        className="relative z-[75] flex h-14 shrink-0 items-stretch gap-1 overflow-x-auto border-t border-zinc-200 bg-white px-2 py-1.5 md:hidden"
        data-testid="mobile-tool-bar"
      >
        {TOOLS.map((t) => {
          const active = mobileSheet === t.label;
          return (
            <button
              key={t.label}
              onClick={() => { setActiveTool(t.label); setMobileSheet((cur) => (cur === t.label ? null : t.label)); }}
              data-testid={`mobile-tool-${t.label.toLowerCase().replace(/\s+/g, "-")}`}
              className={`flex min-w-[68px] flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1 transition ${
                active ? "bg-zinc-900 text-white" : "text-zinc-600"
              }`}
            >
              <t.icon className="h-5 w-5" />
              <span className="whitespace-nowrap text-[10px] font-semibold leading-none">{t.label}</span>
            </button>
          );
        })}
      </nav>

      {/* ---------- HP: lembar geser berisi panel alat ----------
          Lembar & latar gelap berhenti di atas bilah alat (bottom-14) supaya
          pengguna tetap bisa berpindah alat tanpa menutup lembarnya dulu. */}
      {mobileSheet && (
        <div className="md:hidden">
          <button
            type="button"
            aria-label="Tutup panel"
            onClick={() => setMobileSheet(null)}
            data-testid="mobile-sheet-backdrop"
            className="fixed inset-x-0 bottom-14 top-0 z-[65] bg-black/40"
          />
          <div
            className="fixed inset-x-0 bottom-14 z-[70] flex max-h-[68vh] flex-col rounded-t-2xl border-t border-zinc-200 bg-white shadow-[0_-12px_40px_rgba(0,0,0,0.2)]"
            data-testid="mobile-tool-sheet"
          >
            <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="h-1 w-8 rounded-full bg-zinc-300" aria-hidden="true" />
                <span className="text-sm font-bold" data-testid="mobile-sheet-title">{mobileSheet}</span>
              </div>
              <button
                onClick={() => setMobileSheet(null)}
                data-testid="mobile-sheet-close"
                aria-label="Tutup panel"
                className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-300 text-zinc-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {toolPanel}
              {activeTool === "Produk" && (
                <div className="mt-5">
                  <ProductDetailCard product={product} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      </div>

      {/* Preview gabungan semua sisi */}
      <PreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        design={design}
        color={color}
        sizeItems={selectedSizeItems(sizeQty)}
        onCheckPrice={handleCheckPrice}
        checkingPrice={checkingPrice}
      />

      {/* Form data customer (setelah "Cek Harga") */}
      <OrderFormModal
        open={orderFormOpen}
        onClose={() => setOrderFormOpen(false)}
        design={design}
        color={color}
        sizeItems={selectedSizeItems(sizeQty)}
        product={product}
        quote={quote}
        onSubmit={submitOrder}
      />

      {/* Pilih jenis produk (data dari halaman admin "Jenis Produk") */}
      <ProductPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        products={products}
        loading={productsLoading}
        activeId={product?.id}
        onPick={(p) => { setProductId(p.id); setPickerOpen(false); toast.success(`Produk diganti ke ${p.title}`); }}
      />

      {/* Panduan ukuran (size chart produk terpilih) */}
      <SizeGuideModal
        open={sizeGuideOpen}
        onClose={() => setSizeGuideOpen(false)}
        product={product}
      />

      {/* Kelola font kustom (admin saja) */}
      {!publicMode && (
        <FontManagerModal
          open={fontManagerOpen}
          onClose={() => setFontManagerOpen(false)}
          onChanged={loadFonts}
        />
      )}

      {/* Daftar pesanan Custom Tees (admin) — tidak ada di halaman publik */}
      {!publicMode && (
        <OrdersModal
          open={ordersOpen}
          onClose={() => { setOrdersOpen(false); refreshOrderCount(); }}
          onCountChange={refreshOrderCount}
        />
      )}    </div>
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

function PreviewModal({ open, onClose, design, color, sizeItems, onCheckPrice, checkingPrice }) {
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

        {/* Rekap ukuran & jumlah */}
        <div
          className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-zinc-100 px-4 py-2.5 sm:px-5"
          data-testid="preview-size-recap"
        >
          <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Rekap Ukuran</span>
          {(sizeItems || []).length === 0 ? (
            <span className="text-[12px] font-medium text-amber-600">
              Belum ada ukuran dipilih — pilih ukuran & isi jumlah di panel Produk.
            </span>
          ) : (
            <>
              {(sizeItems || []).map((it) => (
                <span
                  key={it.size}
                  data-testid={`preview-recap-${it.size}`}
                  className="rounded-full bg-zinc-900 px-2.5 py-0.5 text-[11px] font-bold text-white"
                >
                  {it.size} × {it.qty}
                </span>
              ))}
              <span className="text-[12px] font-bold text-zinc-700" data-testid="preview-recap-total">
                Total {(sizeItems || []).reduce((a, it) => a + it.qty, 0)} pcs
              </span>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-zinc-100 px-4 py-3 sm:px-5">
          {onCheckPrice && (
            <button
              onClick={onCheckPrice}
              disabled={checkingPrice}
              data-testid="check-price-button"
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
            >
              {checkingPrice ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Cek Harga
            </button>
          )}
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
   ORDER FLOW (tambahan): form data customer setelah "Cek Harga".
   Desain yang sedang dikerjakan TIDAK diubah/dihapus oleh modal ini.
   ========================================================================= */
function OrderFormModal({ open, onClose, design, color, sizeItems, product, quote, onSubmit }) {
  const [form, setForm] = useState({ name: "", phone: "", email: "" });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(null);

  useEffect(() => {
    if (open) { setErrors({}); setDone(null); }
  }, [open]);

  if (!open) return null;

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const validate = () => {
    const err = {};
    if (!form.name.trim()) err.name = "Nama Customer wajib diisi";
    if (!form.phone.trim()) err.phone = "No. yang bisa dihubungi wajib diisi";
    if (form.email.trim() && !EMAIL_RE.test(form.email.trim())) err.email = "Format email tidak valid";
    setErrors(err);
    return Object.keys(err).length === 0;
  };

  const send = async () => {
    if (!validate()) return;   // desain tetap utuh, tidak ada yang dihapus
    setSubmitting(true);
    try {
      const data = await onSubmit({
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
      });
      setDone(data || {});
      setForm({ name: "", phone: "", email: "" });
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[210] flex items-center justify-center bg-black/60 p-2 sm:p-4"
      data-testid="order-form-modal"
    >
      <div
        className="flex max-h-[96vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white text-zinc-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-zinc-100 px-5 py-4">
          <div>
            <h2 className="text-base font-bold sm:text-lg">Pesanan Custom Tees</h2>
            <p className="text-[12px] text-zinc-500">
              {done ? "Pesanan sudah kami terima." : "Lengkapi data kamu, desain sudah kami simpan."}
            </p>
          </div>
          <button
            onClick={onClose}
            data-testid="order-form-close"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-zinc-300 text-zinc-500 hover:bg-zinc-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {done ? (
          <div className="flex flex-col items-center gap-4 px-6 py-12 text-center" data-testid="order-success">
            <CheckCircle2 className="h-14 w-14 text-emerald-500" />
            <p className="max-w-md text-lg font-bold" data-testid="order-success-message">
              Pesanan Diterima Sebentar Lagi CS akan Menghubungi Kembali
            </p>
            {done.order_code && (
              <p className="text-sm text-zinc-500">
                Nomor pesanan kamu: <span className="font-semibold text-zinc-800" data-testid="order-success-code">{done.order_code}</span>
              </p>
            )}
            <button
              onClick={onClose}
              data-testid="order-success-close"
              className="mt-2 rounded-lg bg-zinc-900 px-5 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
            >
              Tutup
            </button>
          </div>
        ) : (
          <>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              <div className="grid gap-5 md:grid-cols-2">
                {/* Ringkasan pesanan */}
                <div className="space-y-3">
                  <SummaryRow label="Jenis Kaos" value={product?.title} testid="summary-product" />
                  <div className="rounded-xl border border-zinc-200 p-3">
                    <div className="flex items-center justify-between">
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Ukuran &amp; Jumlah</div>
                      <div className="text-[11px] font-bold text-zinc-700" data-testid="summary-total-qty">
                        Total {(sizeItems || []).reduce((a, it) => a + it.qty, 0)} pcs
                      </div>
                    </div>
                    <div className="mt-1.5 space-y-1 text-sm" data-testid="summary-size-items">
                      {(sizeItems || []).map((it) => (
                        <div key={it.size} className="flex items-center justify-between" data-testid={`summary-size-${it.size}`}>
                          <span className="text-zinc-600">Ukuran {it.size}</span>
                          <span className="font-semibold text-zinc-900">{it.qty} pcs</span>
                        </div>
                      ))}
                      {(sizeItems || []).length === 0 && <span className="text-zinc-400">—</span>}
                    </div>
                  </div>
                  <div className="rounded-xl border border-zinc-200 p-3">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Warna Kaos</div>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="h-6 w-6 rounded-full border border-zinc-300" style={{ backgroundColor: color?.hex }} />
                      <span className="text-sm font-semibold" data-testid="summary-color">{color?.name}</span>
                      <span className="text-[11px] uppercase text-zinc-400">{color?.hex}</span>
                    </div>
                  </div>
                  <div className="rounded-xl border border-zinc-200 p-3">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Objek Desain</div>
                    <div className="mt-1 space-y-1 text-sm">
                      {PREVIEW_VIEWS.map((v) => (
                        <div key={v} className="flex items-center justify-between">
                          <span className="text-zinc-600">{v}</span>
                          <span className="font-semibold text-zinc-800" data-testid={`summary-count-${v.toLowerCase().replace(/\s+/g, "-")}`}>
                            {(design[v] || []).length} objek
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Preview ringkas desain */}
                <div className="grid grid-cols-2 gap-2" data-testid="order-form-preview">
                  {PREVIEW_VIEWS.map((v) => (
                    <div
                      key={v}
                      className="flex h-[150px] flex-col rounded-xl border border-zinc-200 bg-zinc-50 p-1.5"
                    >
                      <div className="z-10 mx-auto mb-1 inline-flex shrink-0 items-center gap-1 rounded-full bg-zinc-900 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                        <Shirt className="h-3 w-3" /> {v}
                      </div>
                      <PreviewFitTile view={v} color={color} layers={design[v] || []} />
                    </div>
                  ))}
                </div>
              </div>

              {/* Estimasi harga (dihitung di server) */}
              <QuoteCard quote={quote} />

              {/* Data customer */}
              <div className="mt-6 grid gap-4 md:grid-cols-3">
                <Field
                  label="Nama Customer *" value={form.name} onChange={set("name")}
                  error={errors.name} testid="customer-name-input" placeholder="Nama lengkap"
                />
                <Field
                  label="No. yang bisa dihubungi *" value={form.phone} onChange={set("phone")}
                  error={errors.phone} testid="customer-phone-input" placeholder="08xxxxxxxxxx"
                />
                <Field
                  label="Email aktif (Optional)" value={form.email} onChange={set("email")}
                  error={errors.email} testid="customer-email-input" placeholder="nama@email.com"
                />
              </div>
            </div>

            <div className="flex shrink-0 items-center justify-end gap-2 border-t border-zinc-100 px-5 py-3">
              <button
                onClick={onClose}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
              >
                Batal
              </button>
              <button
                onClick={send}
                disabled={submitting}
                data-testid="submit-order-button"
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Kirim Pesanan
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ---------- estimasi harga: rincian dari /api/public/custom-tees/quote ---------- */
const rupiah = (n) => "Rp " + Number(n || 0).toLocaleString("id-ID");

function QuoteCard({ quote }) {
  if (!quote) return null;
  return (
    <div
      className="mt-6 overflow-hidden rounded-2xl border-2 border-zinc-900 bg-white"
      data-testid="quote-card"
    >
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-zinc-200 bg-zinc-900 px-4 py-3 text-white">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-300">
            Estimasi Harga
          </div>
          <div className="text-2xl font-extrabold leading-tight" data-testid="quote-total">
            {rupiah(quote.total)}
          </div>
        </div>
        <div className="text-right text-[12px] leading-tight text-zinc-300">
          <div data-testid="quote-total-qty">{quote.total_qty} pcs</div>
          <div data-testid="quote-per-pcs">{rupiah(quote.price_per_pcs)} / pcs</div>
        </div>
      </div>

      <div className="divide-y divide-zinc-100 px-4 py-2 text-sm" data-testid="quote-lines">
        {(quote.lines || []).map((l, i) => (
          <div key={`${l.label}-${i}`} className="flex items-start justify-between gap-3 py-1.5">
            <div className="min-w-0">
              <div className="font-semibold text-zinc-800">{l.label}</div>
              <div className="text-[11px] text-zinc-500">{l.detail}</div>
            </div>
            <div className="shrink-0 font-semibold text-zinc-900">{rupiah(l.amount)}</div>
          </div>
        ))}
      </div>

      <div className="space-y-1 border-t border-zinc-100 px-4 py-2.5 text-sm">
        <div className="flex items-center justify-between text-zinc-600">
          <span>Subtotal</span>
          <span className="font-semibold text-zinc-900" data-testid="quote-subtotal">{rupiah(quote.subtotal)}</span>
        </div>
        {quote.discount_percent > 0 && (
          <div className="flex items-center justify-between text-emerald-700">
            <span>Diskon jumlah {quote.discount_percent}%</span>
            <span className="font-semibold" data-testid="quote-discount">- {rupiah(quote.discount_amount)}</span>
          </div>
        )}
        {quote.small_order_fee > 0 && (
          <div className="flex items-center justify-between text-zinc-600">
            <span>Biaya order kecil</span>
            <span className="font-semibold text-zinc-900" data-testid="quote-small-fee">{rupiah(quote.small_order_fee)}</span>
          </div>
        )}
        <div className="flex items-center justify-between border-t border-zinc-200 pt-1.5 text-base">
          <span className="font-bold text-zinc-900">Total estimasi</span>
          <span className="font-extrabold text-zinc-900">{rupiah(quote.total)}</span>
        </div>
      </div>

      {quote.next_tier && (
        <div
          className="border-t border-zinc-100 bg-emerald-50 px-4 py-2 text-[12px] font-semibold text-emerald-800"
          data-testid="quote-next-tier"
        >
          Tambah {quote.next_tier.add_qty} pcs lagi (total {quote.next_tier.min_qty} pcs) untuk dapat diskon {quote.next_tier.percent}%.
        </div>
      )}

      <div className="border-t border-zinc-100 px-4 py-2 text-[11px] leading-relaxed text-zinc-500" data-testid="quote-note">
        {quote.note}
      </div>
    </div>
  );
}

function SummaryRow({ label, value, testid }) {  return (
    <div className="rounded-xl border border-zinc-200 p-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">{label}</div>
      <div className="mt-0.5 text-sm font-semibold text-zinc-900" data-testid={testid}>{value || "—"}</div>
    </div>
  );
}

function Field({ label, value, onChange, error, testid, placeholder }) {
  return (
    <label className="block">
      <span className="text-[12px] font-semibold text-zinc-700">{label}</span>
      <input
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        data-testid={testid}
        className={`mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition ${
          error ? "border-rose-400 focus:border-rose-500" : "border-zinc-300 focus:border-zinc-900"
        }`}
      />
      {error && (
        <span className="mt-1 block text-[11px] font-semibold text-rose-600" data-testid={`${testid}-error`}>
          {error}
        </span>
      )}
    </label>
  );
}

/* =========================================================================
   ADMIN: daftar pesanan Custom Tees + detail desain lengkap.
   ========================================================================= */
function OrdersModal({ open, onClose, onCountChange }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/custom-tees/orders");
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (open) { setDetail(null); load(); } }, [open, load]);

  if (!open) return null;

  const openDetail = async (id) => {
    setDetailLoading(true);
    try {
      const { data } = await api.get(`/custom-tees/orders/${id}`);
      setDetail(data);
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    } finally {
      setDetailLoading(false);
    }
  };

  const changeStatus = async (id, status) => {
    try {
      const { data } = await api.patch(`/custom-tees/orders/${id}`, { status });
      setDetail(data);
      setRows((rs) => (rs || []).map((r) => (r.id === id ? { ...r, status } : r)));
      onCountChange && onCountChange();
      toast.success(`Status pesanan jadi "${status}"`);
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    }
  };

  const design = detail?.design || null;
  const views = design?.views || {};
  const detailColor = design?.color || { name: detail?.color_name, hex: detail?.color_hex };

  return (
    <div className="fixed inset-0 z-[205] flex items-center justify-center bg-black/60 p-2 sm:p-4" data-testid="orders-modal">
      <div
        className="flex w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white text-zinc-900 shadow-2xl"
        style={{ height: "94vh" }}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-zinc-100 px-5 py-4">
          <div>
            <h2 className="text-base font-bold sm:text-lg">Pesanan Custom Tees</h2>
            <p className="text-[12px] text-zinc-500">{rows.length} pesanan masuk</p>
          </div>
          <div className="flex items-center gap-2">
            {detail && (
              <button
                onClick={() => setDetail(null)}
                data-testid="order-detail-back"
                className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
              >
                Kembali ke daftar
              </button>
            )}
            <button
              onClick={onClose}
              data-testid="orders-modal-close"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-300 text-zinc-500 hover:bg-zinc-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-4">
          {loading || detailLoading ? (
            <div className="flex h-full items-center justify-center text-sm text-zinc-500">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Memuat…
            </div>
          ) : detail ? (
            <div className="grid gap-4 lg:grid-cols-2" data-testid="order-detail">
              <div className="space-y-3">
                <div className="rounded-xl border border-zinc-200 p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Order ID</div>
                  <div className="text-base font-bold" data-testid="detail-order-code">{detail.order_code}</div>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                    <Info label="Tanggal / Waktu" value={fmtDateTime(detail.submitted_at || detail.created_at)} testid="detail-datetime" />
                    <Info label="Status" value={detail.status} testid="detail-status" />
                    <Info label="Nama Customer" value={detail.customer_name} testid="detail-name" />
                    <Info label="No. Telepon" value={detail.customer_phone} testid="detail-phone" />
                    <Info label="Email" value={detail.customer_email || "—"} testid="detail-email" />
                    <Info label="Produk" value={detail.product_title} testid="detail-product" />
                    <Info label="Ukuran & Jumlah" value={sizeRecapText(detail.size_items)} testid="detail-size" />
                    <Info label="Total" value={`${detail.qty || 1} pcs`} testid="detail-qty" />
                    <Info label="Warna" value={`${detail.color_name} (${detail.color_hex})`} testid="detail-color" />
                    <Info label="Jumlah Objek" value={`${detail.objects_count} objek`} testid="detail-objects" />
                  </div>
                  <div className="mt-4">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Ubah Status</span>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {ORDER_STATUSES.map((s) => (
                        <button
                          key={s}
                          onClick={() => changeStatus(detail.id, s)}
                          data-testid={`detail-status-${s.toLowerCase()}`}
                          className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                            detail.status === s
                              ? "border-zinc-900 bg-zinc-900 text-white"
                              : "border-zinc-300 text-zinc-700 hover:bg-zinc-50"
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-zinc-200 p-4" data-testid="detail-design-data">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Data Desain (lengkap)</div>
                  {PREVIEW_VIEWS.map((v) => {
                    const layers = Array.isArray(views[v]) ? views[v] : [];
                    return (
                      <div key={v} className="mt-2">
                        <div className="text-sm font-semibold">{v} · {layers.length} objek</div>
                        {layers.length > 0 && (
                          <ul className="mt-1 space-y-1 text-[12px] text-zinc-600">
                            {layers.map((l, i) => (
                              <li key={l.id || i} data-testid={`detail-layer-${v.toLowerCase().replace(/\s+/g, "-")}-${i}`}>
                                {l.type === "text"
                                  ? `Teks "${l.text}" · font ${String(l.font || "").split(",")[0]} · warna ${l.color}`
                                  : `Gambar ${l.name || "objek"}`}
                                {" · "}pos {Math.round(l.cx)}%/{Math.round(l.cy)}% · ukuran {Math.round(l.wPct)}% · rotasi {Math.round(l.rot || 0)}°
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2" data-testid="detail-design-preview">
                {PREVIEW_VIEWS.map((v) => (
                  <div key={v} className="flex h-[220px] flex-col rounded-xl border border-zinc-200 bg-zinc-50 p-1.5">
                    <div className="z-10 mx-auto mb-1 inline-flex shrink-0 items-center gap-1 rounded-full bg-zinc-900 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                      <Shirt className="h-3 w-3" /> {v}
                    </div>
                    <PreviewFitTile view={v} color={detailColor} layers={Array.isArray(views[v]) ? views[v] : []} />
                  </div>
                ))}
              </div>
            </div>
          ) : rows.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-zinc-500" data-testid="orders-empty">
              <ClipboardList className="h-8 w-8 text-zinc-300" />
              Belum ada pesanan Custom Tees yang masuk.
            </div>
          ) : (
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="text-[11px] uppercase tracking-wide text-zinc-400">
                <tr>
                  <th className="px-2 py-2">Order ID</th>
                  <th className="px-2 py-2">Tanggal / Waktu</th>
                  <th className="px-2 py-2">Customer</th>
                  <th className="px-2 py-2">No. HP</th>
                  <th className="px-2 py-2">Email</th>
                  <th className="px-2 py-2">Produk</th>
                  <th className="px-2 py-2">Ukuran &amp; Jumlah</th>
                  <th className="px-2 py-2">Total</th>
                  <th className="px-2 py-2">Warna</th>
                  <th className="px-2 py-2">Status</th>
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-zinc-100" data-testid={`order-row-${r.order_code}`}>
                    <td className="px-2 py-2 font-semibold">{r.order_code}</td>
                    <td className="px-2 py-2 text-zinc-600">{fmtDateTime(r.submitted_at || r.created_at)}</td>
                    <td className="px-2 py-2">{r.customer_name}</td>
                    <td className="px-2 py-2 text-zinc-600">{r.customer_phone}</td>
                    <td className="px-2 py-2 text-zinc-600">{r.customer_email || "—"}</td>
                    <td className="px-2 py-2 text-zinc-600">{r.product_title}</td>
                    <td className="px-2 py-2">{sizeRecapText(r.size_items)}</td>
                    <td className="px-2 py-2 font-semibold">{r.qty || 1} pcs</td>
                    <td className="px-2 py-2">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-3.5 w-3.5 rounded-full border border-zinc-300" style={{ backgroundColor: r.color_hex }} />
                        {r.color_name}
                      </span>
                    </td>
                    <td className="px-2 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                        r.status === "Baru" ? "bg-blue-100 text-blue-700"
                        : r.status === "Selesai" ? "bg-emerald-100 text-emerald-700"
                        : r.status === "Dibatalkan" ? "bg-rose-100 text-rose-700"
                        : "bg-amber-100 text-amber-700"
                      }`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-right">
                      <button
                        onClick={() => openDetail(r.id)}
                        data-testid={`order-view-${r.order_code}`}
                        className="rounded-lg border border-zinc-300 px-3 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                      >
                        Lihat Desain
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function Info({ label, value, testid }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">{label}</div>
      <div className="font-semibold text-zinc-900" data-testid={testid}>{value || "—"}</div>
    </div>
  );
}

function fmtDateTime(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return String(iso);
  }
}

/* =========================================================================
   PANEL: Produk (warna & ukuran)
   ========================================================================= */
function ProductPanel({
  color, setColor, sizeQty, setSizeQty,
  product, products, productsLoading, sizes, swatches,
  onOpenPicker, onOpenSizeGuide,
}) {
  const isSizeSelected = (s) => Object.prototype.hasOwnProperty.call(sizeQty || {}, s);
  const selectedSizes = selectedSizeItems(sizeQty);
  const totalQty = totalPcs(sizeQty);
  const activeColorThumb = (swatches || []).find(
    (c) => c.hex.toLowerCase() === String(color?.hex || "").toLowerCase(),
  )?.thumb_url;

  const toggleSize = (s) => {
    if (!setSizeQty) return;
    setSizeQty((prev) => {
      const next = { ...prev };
      if (Object.prototype.hasOwnProperty.call(next, s)) delete next[s];
      else next[s] = 1;
      return next;
    });
  };

  const setSizeQtyFor = (s, raw) => {
    if (!setSizeQty) return;
    const v = parseInt(raw, 10);
    setSizeQty((prev) => ({ ...prev, [s]: Number.isFinite(v) ? clamp(v, 0, 9999) : 0 }));
  };

  const gridCols = sizes.length >= 4 ? "grid-cols-4" : `grid-cols-${Math.max(sizes.length, 1)}`;

  return (
    <>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-bold">Produk</h2>
        <button
          onClick={onOpenPicker}
          data-testid="custom-change-product"
          disabled={productsLoading}
          className="flex items-center text-xs font-semibold text-zinc-500 transition hover:text-zinc-900 disabled:opacity-50"
        >
          {productsLoading ? "Memuat..." : "Ganti Produk"} <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Kartu produk: seluruh kartu (termasuk gambar) bisa diklik untuk ganti produk */}
      <button
        type="button"
        onClick={onOpenPicker}
        disabled={productsLoading}
        data-testid="custom-product-card"
        title="Klik untuk memilih / mengganti produk"
        aria-label="Pilih atau ganti produk"
        className="group flex w-full items-center gap-3 rounded-xl border border-zinc-200 bg-white p-3 text-left transition hover:border-zinc-900 hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/20 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {product?.thumbnail_url || activeColorThumb ? (
          <img
            src={activeColorThumb || product.thumbnail_url}
            alt={product?.title || "Kaos"}
            className="h-12 w-12 shrink-0 rounded-lg border border-zinc-200 object-contain transition group-hover:scale-105"
          />
        ) : (
          <TintedThumb src={MOCKUPS["Depan"]} mask={MOCKUP_MASKS["Depan"]} color={color.hex} alt="Kaos" size={48} inner={36} />
        )}
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate text-[13px] font-semibold" data-testid="custom-product-title">
            {product?.title || FALLBACK_PRODUCT.title}
          </div>
          <div className="truncate text-[11px] text-zinc-500">
            {product?.subtitle || product?.material || FALLBACK_PRODUCT.subtitle}
          </div>
          {Number(product?.price) > 0 && (
            <div className="mt-0.5 text-[11px] font-bold text-zinc-900" data-testid="custom-product-price">
              Mulai Rp {Number(product.price).toLocaleString("id-ID")} / pcs
            </div>
          )}
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-zinc-300 transition group-hover:text-zinc-900" />
      </button>
      {(products || []).length > 1 && (
        <p className="mt-1.5 text-[11px] text-zinc-500">
          Tersedia {products.length} jenis kaos — klik kartu produk di atas untuk melihat semuanya.
        </p>
      )}

      <div className="mt-5 flex items-center justify-between">
        <h3 className="text-sm font-bold">Ukuran</h3>
        <button
          onClick={onOpenSizeGuide}
          data-testid="custom-size-guide"
          className="text-xs font-semibold text-zinc-500 underline-offset-2 hover:text-zinc-900 hover:underline"
        >
          Panduan Ukuran
        </button>
      </div>
      {/* Ukuran bisa dipilih lebih dari satu (multi-size, satu desain) */}
      <div className={`mt-2 grid gap-2 ${gridCols}`} data-testid="custom-size-options">
        {sizes.map((s) => {
          const active = isSizeSelected(s);
          return (
            <button
              key={s}
              onClick={() => toggleSize(s)}
              data-testid={`size-option-${s}`}
              aria-pressed={active}
              className={`h-9 rounded-lg border text-sm font-semibold transition ${
                active
                  ? "border-zinc-900 bg-zinc-900 text-white"
                  : "border-zinc-200 text-zinc-700 hover:border-zinc-400"
              }`}
            >
              {s}
            </button>
          );
        })}
      </div>
      <p className="mt-1.5 text-[11px] text-zinc-500">
        Pilih satu atau beberapa ukuran, lalu isi jumlah per ukuran di bawah.
      </p>

      {/* Jumlah per ukuran */}
      <div className="mt-4 flex items-center justify-between">
        <h3 className="text-sm font-bold">Jumlah</h3>
        <span className="text-xs font-semibold text-zinc-500" data-testid="qty-total">
          Total {totalQty} pcs
        </span>
      </div>
      <div className={`mt-2 grid gap-2 ${gridCols}`} data-testid="size-qty-grid">
        {sizes.map((s) => {
          const active = isSizeSelected(s);
          return (
            <div key={s} className="flex flex-col items-center gap-1">
              <span className={`text-[11px] font-semibold ${active ? "text-zinc-900" : "text-zinc-400"}`}>{s}</span>
              <input
                type="number"
                min={0}
                max={9999}
                inputMode="numeric"
                value={active ? sizeQty[s] : ""}
                placeholder="0"
                disabled={!active}
                onChange={(e) => setSizeQtyFor(s, e.target.value)}
                data-testid={`qty-input-${s}`}
                className={`h-9 w-full rounded-lg border text-center text-sm font-semibold outline-none transition ${
                  active
                    ? "border-zinc-900 bg-white text-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
                    : "cursor-not-allowed border-zinc-200 bg-zinc-100 text-zinc-400 placeholder:text-zinc-300"
                }`}
              />
            </div>
          );
        })}
      </div>
      {selectedSizes.length > 0 && (
        <div className="mt-2 rounded-xl border border-zinc-200 bg-zinc-50 p-2.5" data-testid="size-recap-panel">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Rekap Ukuran</div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {selectedSizes.map((it) => (
              <span
                key={it.size}
                data-testid={`size-recap-${it.size}`}
                className="rounded-full bg-zinc-900 px-2.5 py-0.5 text-[11px] font-bold text-white"
              >
                {it.size} × {it.qty}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="mt-5 flex items-center justify-between">
        <h3 className="text-sm font-bold">Warna Kaos</h3>
        <span className="text-xs font-semibold text-zinc-400" data-testid="custom-color-count">
          {swatches.length} varian
        </span>
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

      <div className="mt-3 grid grid-cols-7 gap-2" data-testid="custom-swatches">
        {swatches.map((c) => {
          const active = c.hex.toLowerCase() === String(color?.hex || "").toLowerCase();
          const light = c.hex.toLowerCase() === "#ffffff";
          return (
            <button
              key={c.hex}
              onClick={() => setColor(c)}
              title={`${c.name} (${c.hex})`}
              aria-label={`Pilih warna ${c.name}`}
              data-testid={`swatch-${c.name.toLowerCase().replace(/\s+/g, "-")}`}
              className={`relative aspect-square rounded-full border transition ${
                active ? "ring-2 ring-zinc-900 ring-offset-1" : "border-zinc-200 hover:scale-110"
              } ${light ? "border-zinc-300" : ""}`}
              style={{ backgroundColor: c.hex }}
            >
              {active && (
                <Check className="absolute inset-0 m-auto h-3.5 w-3.5" style={{ color: light ? "#111" : "#fff" }} />
              )}
            </button>
          );
        })}
      </div>
    </>
  );
}

/* Kartu "Detail Produk" (selalu terbuka). Dipakai di kolom kanan pada layar
   lebar dan di dalam lembar geser "Produk" pada HP. */
function ProductDetailCard({ product }) {
  return (
    <div data-testid="custom-product-detail-panel">
      <div className="mb-2 rounded-xl bg-blue-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm">
        Detail Produk
      </div>
      <div
        className="space-y-1.5 rounded-xl border border-blue-200 bg-blue-50/60 p-3 text-[12px]"
        data-testid="custom-product-detail"
      >
        <DetailRow label="Suplier" value={product?.supplier} />
        <DetailRow label="Size" value={product?.size_region} />
        <DetailRow label="Model" value={product?.model} />
        <DetailRow label="Bahan" value={product?.material} />
        {product?.description && (
          <p className="pt-1 leading-relaxed text-zinc-600">{product.description}</p>
        )}
      </div>
    </div>
  );
}

function DetailRow({ label, value }) {  return (
    <div className="flex justify-between gap-3 border-b border-zinc-200 pb-1 last:border-0">
      <span className="font-semibold uppercase tracking-wide text-zinc-400">{label}</span>
      <span className="text-right text-zinc-800">{value || "—"}</span>
    </div>
  );
}

/* =========================================================================
   MODAL: pilih jenis produk ("Ganti Produk")
   Datanya dari GET /api/public/custom-products (dikelola admin di
   /app/mockup-kaos). Gambar & daftar warna ikut ditampilkan sebagai preview.
   ========================================================================= */
function ProductPickerModal({ open, onClose, products, loading, activeId, onPick }) {
  const [q, setQ] = useState("");
  useEffect(() => { if (open) setQ(""); }, [open]);
  if (!open) return null;

  const term = q.trim().toLowerCase();
  const list = (products || []).filter((p) =>
    term ? `${p.title} ${p.supplier} ${p.material}`.toLowerCase().includes(term) : true,
  );

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-6">
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl bg-white text-zinc-900 shadow-2xl sm:rounded-2xl" data-testid="custom-product-picker">
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
          <div>
            <h3 className="text-base font-bold">Pilih Jenis Kaos</h3>
            <p className="text-xs text-zinc-500">Ukuran dan pilihan warna akan mengikuti produk yang dipilih.</p>
          </div>
          <button
            onClick={onClose}
            data-testid="custom-product-picker-close"
            aria-label="Tutup"
            className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="border-b border-zinc-200 px-5 py-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cari jenis kaos, suplier, atau bahan..."
              data-testid="custom-product-picker-search"
              className="h-10 w-full rounded-lg border border-zinc-200 bg-white pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-zinc-900/10"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-zinc-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Memuat jenis kaos...
            </div>
          ) : list.length === 0 ? (
            <p className="py-16 text-center text-sm text-zinc-500" data-testid="custom-product-picker-empty">
              {term ? "Tidak ada jenis kaos yang cocok." : "Belum ada jenis kaos yang aktif."}
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {list.map((p) => {
                const active = p.id === activeId;
                return (
                  <button
                    key={p.id}
                    onClick={() => onPick(p)}
                    data-testid={`custom-product-option-${p.product_key}`}
                    className={`flex gap-3 rounded-xl border p-3 text-left transition ${
                      active ? "border-zinc-900 ring-2 ring-zinc-900/10" : "border-zinc-200 hover:border-zinc-400"
                    }`}
                  >
                    <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50">
                      {p.thumbnail_url ? (
                        <img src={p.thumbnail_url} alt={p.title} loading="lazy" className="h-full w-full object-contain" />
                      ) : (
                        <Shirt className="h-7 w-7 text-zinc-300" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="text-[13px] font-bold leading-snug">{p.title}</div>
                        {active && <Check className="h-4 w-4 shrink-0 text-zinc-900" />}
                      </div>
                      {Number(p.price) > 0 && (
                        <div className="mt-0.5 text-[13px] font-bold text-zinc-900">
                          Rp {Number(p.price).toLocaleString("id-ID")}
                        </div>
                      )}
                      <div className="mt-1 text-[11px] text-zinc-500">
                        {(p.colors || []).length} warna · {(p.size_chart || []).length} ukuran
                        {p.size_region ? ` · ${p.size_region}` : ""}
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {(p.colors || []).slice(0, 8).map((c) => (
                          <span
                            key={c.id}
                            title={c.name}
                            className={`h-3.5 w-3.5 rounded-full ${c.hex.toLowerCase() === "#ffffff" ? "border border-zinc-300" : ""}`}
                            style={{ backgroundColor: c.hex }}
                          />
                        ))}
                        {(p.colors || []).length > 8 && (
                          <span className="text-[10px] text-zinc-400">+{(p.colors || []).length - 8}</span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   MODAL: kelola font kustom (admin)
   Admin mengunggah berkas font sendiri, lalu font itu langsung tersedia di
   dropdown "Jenis Font" untuk semua pelanggan di /custom.
   ========================================================================= */
function FontManagerModal({ open, onClose, onChanged }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const inputRef = useRef(null);

  /* ---------- tab "Dari Google Fonts" (tanpa unduh berkas) ---------- */
  const [tab, setTab] = useState("google");
  const [catalog, setCatalog] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [previewCssUrl, setPreviewCssUrl] = useState("");
  const [googleQuery, setGoogleQuery] = useState("");
  const [googlePicked, setGooglePicked] = useState("");
  const [addingGoogle, setAddingGoogle] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/fonts");
      setItems(Array.isArray(data?.items) ? data.items : []);
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCatalog = useCallback(async () => {
    setCatalogLoading(true);
    try {
      const { data } = await api.get("/fonts/google");
      setCatalog(Array.isArray(data?.items) ? data.items : []);
      setPreviewCssUrl(data?.preview_css_url || "");
    } catch {
      setCatalog([]);
    } finally {
      setCatalogLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setName("");
    setFile(null);
    setGoogleQuery("");
    setGooglePicked("");
    setTab("google");
    refresh();
    loadCatalog();
  }, [open, refresh, loadCatalog]);

  // Muat CSS katalog Google supaya pratinjau di picker tampil dengan font asli.
  useEffect(() => {
    if (!open || !previewCssUrl || typeof document === "undefined") return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = previewCssUrl;
    link.setAttribute("data-dnsw-google-preview", "1");
    document.head.appendChild(link);
    return () => { link.remove(); };
  }, [open, previewCssUrl]);

  const addedGoogleFamilies = useMemo(
    () => new Set((items || []).filter((f) => f.source === "google").map((f) => f.family)),
    [items],
  );

  const filteredCatalog = useMemo(() => {
    const q = googleQuery.trim().toLowerCase();
    if (!q) return catalog;
    return (catalog || []).filter(
      (f) =>
        f.family.toLowerCase().includes(q) ||
        String(f.category || "").toLowerCase().includes(q),
    );
  }, [catalog, googleQuery]);

  const addGoogleFont = async (family) => {
    const fam = String(family || "").trim();
    if (fam.length < 2) return toast.error("Pilih atau ketik nama font Google dulu");
    setAddingGoogle(true);
    try {
      const { data } = await api.post("/fonts/google", { family: fam });
      toast.success(`Font Google "${data?.name || fam}" ditambahkan`);
      setGooglePicked("");
      setGoogleQuery("");
      await refresh();
      await loadCatalog();
      onChanged?.();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || "Gagal menambahkan font Google");
    } finally {
      setAddingGoogle(false);
    }
  };

  if (!open) return null;

  const pickFile = (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const ext = (f.name.split(".").pop() || "").toLowerCase();
    if (!["woff2", "woff", "ttf", "otf"].includes(ext)) {
      return toast.error("Format font harus WOFF2, WOFF, TTF, atau OTF");
    }
    if (f.size > FONT_MAX_BYTES) {
      return toast.error("Ukuran font maksimal 3 MB. Coba ubah ke WOFF2 supaya lebih ringan.");
    }
    setFile(f);
    if (!name.trim()) setName(f.name.replace(/\.[a-zA-Z0-9]+$/, ""));
  };

  const upload = async () => {
    if (!file) return toast.error("Pilih berkas font dulu");
    if (name.trim().length < 2) return toast.error("Nama font minimal 2 karakter");
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("name", name.trim());
      await api.post("/fonts", fd, { headers: { "Content-Type": "multipart/form-data" } });
      toast.success(`Font "${name.trim()}" ditambahkan`);
      setName("");
      setFile(null);
      await refresh();
      onChanged?.();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || "Gagal mengunggah font");
    } finally {
      setUploading(false);
    }
  };

  const toggleActive = async (f) => {
    setBusyId(f.id);
    try {
      await api.put(`/fonts/${f.id}`, { is_active: !f.is_active });
      await refresh();
      onChanged?.();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (f) => {
    setBusyId(f.id);
    try {
      await api.delete(`/fonts/${f.id}`);
      toast.success(`Font "${f.name}" dihapus`);
      await refresh();
      onChanged?.();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    } finally {
      setBusyId(null);
    }
  };

  const toneClass = (tone) =>
    tone === "good"
      ? "bg-emerald-100 text-emerald-700"
      : tone === "ok"
        ? "bg-blue-100 text-blue-700"
        : "bg-amber-100 text-amber-700";

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-6">
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-white text-zinc-900 shadow-2xl sm:rounded-2xl" data-testid="font-manager-modal">
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
          <div>
            <h3 className="text-base font-bold">Kelola Font</h3>
            <p className="text-xs text-zinc-500">Tambah font dari Google Fonts (tanpa unduh berkas) atau unggah berkas sendiri — langsung bisa dipakai pelanggan di desainer kaos.</p>
          </div>
          <button
            onClick={onClose}
            data-testid="font-manager-close"
            aria-label="Tutup"
            className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {/* Pilihan cara menambah font */}
          <div className="flex gap-2 rounded-xl bg-zinc-100 p-1" data-testid="font-source-tabs">
            <button
              onClick={() => setTab("google")}
              data-testid="font-tab-google"
              className={`flex-1 rounded-lg px-3 py-2 text-[13px] font-semibold transition ${
                tab === "google" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
              }`}
            >
              Dari Google Fonts
            </button>
            <button
              onClick={() => setTab("upload")}
              data-testid="font-tab-upload"
              className={`flex-1 rounded-lg px-3 py-2 text-[13px] font-semibold transition ${
                tab === "upload" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
              }`}
            >
              Unggah Berkas
            </button>
          </div>

          {tab === "google" ? (
            <div className="mt-4" data-testid="font-google-panel">
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3.5">
                <div className="text-[11px] font-bold uppercase tracking-wide text-zinc-500">
                  Google Fonts — Tanpa Unduh Berkas
                </div>
                <ul className="mt-2 space-y-1 text-[11px] leading-relaxed text-zinc-600">
                  <li>• Font dimuat langsung dari CDN Google, tidak ada berkas yang perlu diunduh atau diunggah.</li>
                  <li>• Ketebalan Regular (400) dan Bold (700) diambil otomatis bila tersedia.</li>
                  <li>• Gratis dipakai untuk keperluan komersial (lisensi OFL/Apache).</li>
                </ul>
              </div>

              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                  <input
                    value={googleQuery}
                    onChange={(e) => { setGoogleQuery(e.target.value); setGooglePicked(e.target.value); }}
                    placeholder="Cari atau ketik nama font Google, misal: Bebas Neue"
                    data-testid="font-google-search"
                    className="h-10 w-full rounded-lg border border-zinc-300 pl-9 pr-3 text-sm outline-none focus:border-zinc-900"
                  />
                </div>
                <button
                  onClick={() => addGoogleFont(googlePicked || googleQuery)}
                  disabled={addingGoogle || (googlePicked || googleQuery).trim().length < 2}
                  data-testid="font-google-add"
                  className="flex h-10 items-center justify-center gap-2 rounded-lg bg-zinc-900 px-4 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
                >
                  {addingGoogle ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  {addingGoogle ? "Menambahkan..." : "Tambahkan"}
                </button>
              </div>

              {catalogLoading ? (
                <div className="flex items-center justify-center gap-2 py-10 text-sm text-zinc-500">
                  <Loader2 className="h-4 w-4 animate-spin" /> Memuat katalog Google Fonts...
                </div>
              ) : filteredCatalog.length === 0 ? (
                <p className="mt-3 rounded-xl border border-dashed border-zinc-300 p-6 text-center text-[13px] text-zinc-500" data-testid="font-google-empty">
                  Tidak ada di daftar populer. Tekan <strong>Tambahkan</strong> untuk memakai nama yang kamu ketik —
                  nama itu akan diperiksa dulu ke Google Fonts.
                </p>
              ) : (
                <div className="mt-3 grid gap-2 sm:grid-cols-2" data-testid="font-google-catalog">
                  {filteredCatalog.map((f) => {
                    const added = f.added || addedGoogleFamilies.has(f.family);
                    return (
                      <button
                        key={f.family}
                        onClick={() => (added ? null : addGoogleFont(f.family))}
                        disabled={added || addingGoogle}
                        data-testid={`font-google-item-${f.family.replace(/\s+/g, "-").toLowerCase()}`}
                        className={`rounded-xl border p-3 text-left transition ${
                          added
                            ? "border-emerald-200 bg-emerald-50"
                            : "border-zinc-200 hover:border-zinc-900 hover:bg-zinc-50"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-[12px] font-semibold text-zinc-700">{f.family}</span>
                          {added ? (
                            <span className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                              <Check className="h-3 w-3" /> Terpasang
                            </span>
                          ) : (
                            <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-bold text-zinc-500">
                              {f.category}
                            </span>
                          )}
                        </div>
                        <div
                          className="mt-1 truncate text-xl leading-snug text-zinc-900"
                          style={{ fontFamily: `"${f.family}", sans-serif` }}
                        >
                          Kaos Custom 123
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <>
          {/* Panduan format ideal */}
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3.5" data-testid="font-format-guide">
            <div className="text-[11px] font-bold uppercase tracking-wide text-zinc-500">
              Format Font yang Didukung
            </div>
            <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
              {FONT_FORMAT_LABELS.map((f) => (
                <div key={f.ext} className="flex items-center gap-2" data-testid={`font-format-${f.ext}`}>
                  <span className="w-14 font-mono text-[12px] font-bold">.{f.ext.toLowerCase()}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${toneClass(f.tone)}`}>
                    {f.badge}
                  </span>
                  <span className="text-[11px] text-zinc-500">{f.note}</span>
                </div>
              ))}
            </div>
            <ul className="mt-3 space-y-1 border-t border-zinc-200 pt-2.5 text-[11px] leading-relaxed text-zinc-600">
              <li>• Ukuran berkas maksimal <strong>3 MB</strong>.</li>
              <li>• Satu berkas = satu ketebalan. Unggah terpisah untuk Regular dan Bold.</li>
              <li>• Pakai font yang lisensinya mengizinkan penggunaan komersial.</li>
              <li>• Cukup subset huruf Latin supaya berkasnya tetap ringan.</li>
            </ul>
          </div>

          {/* Form unggah */}
          <div className="mt-4 rounded-xl border border-zinc-200 p-3.5">
            <div className="text-[11px] font-bold uppercase tracking-wide text-zinc-500">Tambah Font Baru</div>
            <div className="mt-2.5 grid gap-2.5 sm:grid-cols-[1fr_auto]">
              <div>
                <label className="mb-1 block text-[12px] font-semibold text-zinc-600">Nama Font</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Bebas Neue"
                  data-testid="font-name-input"
                  className="h-10 w-full rounded-lg border border-zinc-300 px-3 text-sm outline-none focus:border-zinc-900"
                />
              </div>
              <div>
                <label className="mb-1 block text-[12px] font-semibold text-zinc-600">Berkas Font</label>
                <button
                  onClick={() => inputRef.current?.click()}
                  data-testid="font-pick-file"
                  className="flex h-10 items-center gap-2 rounded-lg border border-zinc-300 px-3 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
                >
                  <Upload className="h-4 w-4" /> Pilih Berkas
                </button>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".woff2,.woff,.ttf,.otf,font/woff2,font/woff,font/ttf,font/otf"
                  className="hidden"
                  data-testid="font-file-input"
                  onChange={pickFile}
                />
              </div>
            </div>
            {file && (
              <p className="mt-2 text-[11px] text-zinc-600" data-testid="font-selected-file">
                Dipilih: <strong>{file.name}</strong> ({Math.max(1, Math.round(file.size / 1024))} KB)
              </p>
            )}
            <button
              onClick={upload}
              disabled={uploading || !file}
              data-testid="font-upload-submit"
              className="mt-3 flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {uploading ? "Mengunggah..." : "Tambahkan Font"}
            </button>
          </div>
            </>
          )}

          {/* Daftar font */}
          <div className="mt-4">
            <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-zinc-500">
              Font Kustom ({items.length})
            </div>
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-zinc-500">
                <Loader2 className="h-4 w-4 animate-spin" /> Memuat...
              </div>
            ) : items.length === 0 ? (
              <p className="rounded-xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500" data-testid="font-list-empty">
                Belum ada font kustom. Font bawaan tetap bisa dipakai.
              </p>
            ) : (
              <div className="space-y-2" data-testid="font-list">
                {items.map((f) => (
                  <div
                    key={f.id}
                    className="flex items-center gap-3 rounded-xl border border-zinc-200 p-3"
                    data-testid={`font-row-${f.id}`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-semibold">{f.name}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${f.source === "google" ? "bg-blue-100 text-blue-700" : f.format === "woff2" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                          {f.source === "google" ? "GOOGLE FONTS" : String(f.format || "").toUpperCase()}
                        </span>
                        {!f.is_active && (
                          <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-[10px] font-bold text-zinc-600">
                            Non-aktif
                          </span>
                        )}
                      </div>
                      <div
                        className="truncate text-lg leading-snug text-zinc-800"
                        style={{ fontFamily: `"${f.family}", sans-serif` }}
                        data-testid={`font-preview-${f.id}`}
                      >
                        Contoh Teks Kaos 123
                      </div>
                      <div className="text-[11px] text-zinc-400">
                        {f.source === "google"
                          ? "Dimuat langsung dari CDN Google — tanpa berkas"
                          : `${Math.max(1, Math.round((f.file_size || 0) / 1024))} KB`}
                      </div>
                    </div>
                    <button
                      onClick={() => toggleActive(f)}
                      disabled={busyId === f.id}
                      title={f.is_active ? "Sembunyikan dari pelanggan" : "Tampilkan ke pelanggan"}
                      data-testid={`font-toggle-${f.id}`}
                      className="rounded-lg border border-zinc-300 px-2.5 py-1.5 text-[11px] font-semibold text-zinc-600 hover:bg-zinc-50 disabled:opacity-50"
                    >
                      {f.is_active ? "Sembunyikan" : "Aktifkan"}
                    </button>
                    <button
                      onClick={() => remove(f)}
                      disabled={busyId === f.id}
                      aria-label={`Hapus font ${f.name}`}
                      data-testid={`font-delete-${f.id}`}
                      className="rounded-lg p-2 text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      {busyId === f.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   MODAL: panduan ukuran (size chart produk terpilih)
   ========================================================================= */
function SizeGuideModal({ open, onClose, product }) {
  if (!open) return null;
  const rows = product?.size_chart || [];
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-6">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white text-zinc-900 shadow-2xl sm:rounded-2xl" data-testid="custom-size-guide-modal">
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
          <div>
            <h3 className="text-base font-bold">Panduan Ukuran</h3>
            <p className="text-xs text-zinc-500">{product?.title}</p>
          </div>
          <button
            onClick={onClose}
            data-testid="custom-size-guide-close"
            aria-label="Tutup"
            className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {rows.length === 0 ? (
            <p className="py-10 text-center text-sm text-zinc-500" data-testid="custom-size-guide-empty">
              Size chart untuk produk ini belum tersedia.
            </p>
          ) : (
            <table className="w-full overflow-hidden rounded-xl border border-zinc-200 text-sm">
              <thead className="bg-zinc-100 text-[11px] uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-3 py-2 text-left">Ukuran</th>
                  <th className="px-3 py-2 text-right">Lebar Dada (cm)</th>
                  <th className="px-3 py-2 text-right">Panjang (cm)</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.id} className="border-t border-zinc-200" data-testid={`custom-size-guide-row-${s.label}`}>
                    <td className="px-3 py-2 font-bold">{s.label}</td>
                    <td className="px-3 py-2 text-right">{s.chest_cm}</td>
                    <td className="px-3 py-2 text-right">{s.length_cm}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="mt-3 text-[11px] leading-relaxed text-zinc-500">
            Ukuran diambil dengan kaos dalam posisi rata. Toleransi 1–2 cm karena proses jahit manual.
          </p>
        </div>
      </div>
    </div>
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
/**
 * Pemilih font dengan pencarian — dipakai admin maupun pelanggan.
 * Menggantikan <select> biasa supaya daftar font yang panjang tetap gampang dicari.
 */
function FontPicker({ value, options, onChange, canManageFonts = false, onManageFonts }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const boxRef = useRef(null);
  const searchRef = useRef(null);

  const current = useMemo(
    () => options.find((f) => f.value === value) || { label: "Pilih font", value },
    [options, value],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((f) => f.label.toLowerCase().includes(q));
  }, [options, query]);

  // Tutup saat klik di luar atau tekan Esc.
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    const t = setTimeout(() => searchRef.current?.focus(), 30);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      clearTimeout(t);
    };
  }, [open]);

  const pick = (f) => { onChange(f.value); setOpen(false); setQuery(""); };

  return (
    <div className="relative" ref={boxRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        data-testid="text-font-select"
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-left text-sm text-zinc-900 outline-none transition hover:border-zinc-400 focus:border-zinc-900"
      >
        <span className="truncate" style={{ fontFamily: current.value }}>{current.label}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-zinc-400 transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          data-testid="text-font-dropdown"
          className="absolute left-0 right-0 z-30 mt-1 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl"
        >
          <div className="relative border-b border-zinc-100 p-2">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && filtered.length > 0) { e.preventDefault(); pick(filtered[0]); } }}
              placeholder="Cari font..."
              data-testid="text-font-search"
              className="h-9 w-full rounded-lg border border-zinc-200 bg-zinc-50 pl-8 pr-3 text-[13px] text-zinc-900 outline-none focus:border-zinc-900 focus:bg-white"
            />
          </div>

          <div className="max-h-60 overflow-y-auto py-1" role="listbox">
            {filtered.length === 0 ? (
              <p className="px-3 py-6 text-center text-[12px] text-zinc-500" data-testid="text-font-empty">
                Font "{query}" tidak ada di daftar.
                {canManageFonts ? " Coba tambahkan dari Google Fonts di bawah." : " Coba kata kunci lain."}
              </p>
            ) : (
              filtered.map((f) => {
                const active = f.value === value;
                return (
                  <button
                    key={f.label}
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => pick(f)}
                    data-testid={`text-font-option-${slugifyFontLabel(f.label)}`}
                    className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[15px] transition ${
                      active ? "bg-zinc-900 text-white" : "text-zinc-800 hover:bg-zinc-100"
                    }`}
                  >
                    <span className="truncate" style={{ fontFamily: f.value }}>{f.label}</span>
                    {active && <Check className="h-4 w-4 shrink-0" />}
                  </button>
                );
              })
            )}
          </div>

          {canManageFonts && (
            <button
              type="button"
              onClick={() => { setOpen(false); setQuery(""); onManageFonts?.(); }}
              data-testid="text-font-find-more"
              className="flex w-full items-center gap-2 border-t border-zinc-100 bg-zinc-50 px-3 py-2.5 text-[12px] font-semibold text-zinc-700 hover:bg-zinc-100"
            >
              <Plus className="h-3.5 w-3.5" /> Cari Font Lain (Google Fonts)...
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function TextPanel({
  layers, view, selectedLayer, setSelectedId, addText, updateSelectedText,
  resizeSelected, rotateSelected, resetRotation, centerSelected, deleteLayer,
  fontOptions = FONTS, fontsLoading = false, customFontCount = 0,
  canManageFonts = false, onManageFonts,
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
          <div className="mb-1 mt-3 flex items-center justify-between">
            <label className="block text-[12px] font-semibold text-zinc-600">Jenis Font</label>
            {canManageFonts && (
              <button
                onClick={onManageFonts}
                data-testid="open-font-manager"
                className="flex items-center gap-1 text-[11px] font-semibold text-zinc-500 hover:text-zinc-900"
              >
                <Plus className="h-3 w-3" /> Kelola Font
              </button>
            )}
          </div>
          <FontPicker
            value={selectedLayer.font}
            options={fontOptions}
            onChange={(v) => updateSelectedText({ font: v })}
            canManageFonts={canManageFonts}
            onManageFonts={onManageFonts}
          />
          <p className="mt-1 text-[11px] text-zinc-400" data-testid="font-count-hint">
            {fontsLoading
              ? "Memuat font..."
              : customFontCount > 0
                ? `${fontOptions.length} font tersedia (${customFontCount} font kustom)`
                : `${fontOptions.length} font bawaan`}
          </p>

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
