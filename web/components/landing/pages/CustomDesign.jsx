'use client';
import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  Shirt,
  Upload,
  Type,
  Sticker,
  Layers,
  Images,
  LayoutTemplate,
  HelpCircle,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  X,
} from 'lucide-react';

// Feature flag: only render the tool when explicitly ready (build step-by-step)
const READY = process.env.NEXT_PUBLIC_CUSTOM_DESIGN_READY === 'true';
const PRODUCT_KEY = 'premium-cotton-7200';
const DEFAULT_SIZE_GUIDE = '/assets/size-guide/premium-cotton-7200.webp';

const TOOLS = [
  { id: 'product', icon: Shirt, label: 'Product' },
  { id: 'upload', icon: Upload, label: 'Upload Image' },
  { id: 'text', icon: Type, label: 'Add Text' },
  { id: 'clipart', icon: Sticker, label: 'Add Clip Art' },
  { id: 'layer', icon: Layers, label: 'Layer' },
  { id: 'images', icon: Images, label: 'My Images' },
  { id: 'template', icon: LayoutTemplate, label: 'Template' },
  { id: 'help', icon: HelpCircle, label: 'Help' },
];

const SIZES = ['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL'];

const COLORS = [
  { hex: '#111111', name: 'Black' },
  { hex: '#E5E7EB', name: 'Salmon' },
  { hex: '#8B8F94', name: 'Grey' },
  { hex: '#1E2A44', name: 'Navy' },
  { hex: '#5B1F1F', name: 'Maroon' },
  { hex: '#B71C1C', name: 'Red' },
  { hex: '#1E4FA1', name: 'Royal' },
  { hex: '#2E8B57', name: 'Green' },
  { hex: '#F4C400', name: 'Yellow' },
  { hex: '#0F5132', name: 'Forest' },
  { hex: '#3F3F46', name: 'Charcoal' },
  { hex: '#F08A24', name: 'Orange' },
  { hex: '#2A241C', name: 'Espresso' },
  { hex: '#7C6E3A', name: 'Olive' },
  { hex: '#7EA6E0', name: 'Sky' },
  { hex: '#E15A2A', name: 'Rust' },
  { hex: '#F6C6D3', name: 'Pink' },
  { hex: '#CDB79E', name: 'Tan' },
  { hex: '#5A2E9E', name: 'Purple' },
  { hex: '#141414', name: 'Ink' },
  { hex: '#1B2A4A', name: 'Deep Navy' },
  { hex: '#C43A5C', name: 'Berry' },
  { hex: '#376D50', name: 'Emerald' },
  { hex: '#4B3524', name: 'Coffee' },
  { hex: '#A9C3D1', name: 'Powder' },
  { hex: '#C2C39A', name: 'Sage' },
  { hex: '#94BFB2', name: 'Mint' },
  { hex: '#A9A0C2', name: 'Lavender' },
  { hex: '#BFA48C', name: 'Sand' },
  { hex: '#B6892A', name: 'Mustard' },
  { hex: '#B9D33A', name: 'Lime' },
  { hex: '#5C4630', name: 'Brown' },
  { hex: '#1E6BB8', name: 'Cobalt' },
  { hex: '#D63BB8', name: 'Magenta' },
];

const VIEWS = [
  { id: 'front', label: 'Depan' },
  { id: 'back', label: 'Belakang' },
  { id: 'left', label: 'Lengan Kiri' },
  { id: 'right', label: 'Lengan Kanan' },
  { id: 'label', label: 'Label' },
];

function TshirtSVG({ view = 'front', color = '#FFFFFF' }) {
  // Vector t-shirt placeholder — used as fallback when no photo mockup uploaded yet.
  const stroke = '#1A1A1A';
  return (
    <svg viewBox="0 0 400 460" className="h-full w-auto" xmlns="http://www.w3.org/2000/svg" aria-label={`t-shirt ${view}`}>
      <defs>
        <linearGradient id="shade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.06" />
        </linearGradient>
      </defs>
      <path
        d="M80 80 L150 50 Q200 90 250 50 L320 80 L380 150 L330 190 L310 170 L310 420 Q200 440 90 420 L90 170 L70 190 L20 150 Z"
        fill={color}
        stroke={stroke}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path
        d="M150 50 Q200 100 250 50"
        fill="none"
        stroke={stroke}
        strokeWidth="2"
      />
      {/* subtle shading */}
      <path
        d="M80 80 L150 50 Q200 90 250 50 L320 80 L380 150 L330 190 L310 170 L310 420 Q200 440 90 420 L90 170 L70 190 L20 150 Z"
        fill="url(#shade)"
      />
      {/* Neck tag hint */}
      <rect x="188" y="55" width="24" height="14" fill="#EDEDED" stroke={stroke} strokeWidth="1" />
    </svg>
  );
}

/**
 * Renders either a real uploaded mockup photo (if admin uploaded one for this
 * color+view combination) or falls back to the SVG placeholder.
 */
function TshirtMockup({ view, colorHex, mockups, alt = 't-shirt', priority = false }) {
  const key = `${colorHex.toUpperCase()}::${view}`;
  const mock = mockups?.get(key);
  if (mock?.image_url) {
    return (
      <img
        src={mock.image_url}
        alt={alt}
        className="h-full w-auto max-w-full object-contain"
        loading={priority ? 'eager' : 'lazy'}
        draggable={false}
      />
    );
  }
  return <TshirtSVG view={view} color={colorHex} />;
}

function useMockups(productKey) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    setLoading(true);
    fetch(`/api/public/mockups?product_key=${encodeURIComponent(productKey)}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => { if (live) setItems(Array.isArray(data) ? data : []); })
      .catch(() => { if (live) setItems([]); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [productKey]);

  const map = useMemo(() => {
    const m = new Map();
    for (const it of items) m.set(`${(it.color_hex || '').toUpperCase()}::${it.view}`, it);
    return m;
  }, [items]);

  return { mockups: map, mockupsList: items, loading };
}

// Fetches editable product info (title, description, sizes, specs, size guide image).
function useCustomProduct(productKey) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let live = true;
    setLoading(true);
    fetch(`/api/public/custom-product?product_key=${encodeURIComponent(productKey)}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (live) setData(d || null); })
      .catch(() => { if (live) setData(null); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [productKey]);
  return { product: data, loading };
}

function ComingSoon() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6" data-testid="custom-coming-soon">
      <div className="max-w-lg w-full text-center border-2 border-foreground bg-card p-8 sm:p-12 shadow-stamp">
        <div className="inline-block bg-primary text-primary-foreground px-3 py-1 text-[11px] font-bold uppercase tracking-[0.25em] border-2 border-foreground mb-6">
          Segera Hadir
        </div>
        <h1 className="font-display text-4xl sm:text-5xl uppercase tracking-wider mb-4">
          Custom Design
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground mb-8 leading-relaxed">
          Alat desain kaos online sedang kami siapkan. Tools untuk upload gambar, tambah teks,
          pilih warna &amp; ukuran akan tersedia di sini sebentar lagi.
        </p>
        <Link
          href="/"
          data-testid="custom-back-home"
          className="inline-flex items-center gap-2 bg-foreground text-background px-5 py-2.5 border-2 border-foreground font-bold uppercase tracking-widest text-xs lift"
        >
          <ChevronLeft size={14} /> Kembali ke Beranda
        </Link>
      </div>
    </div>
  );
}

export default function CustomDesign() {
  const [activeTool, setActiveTool] = useState('product');
  const [activeView, setActiveView] = useState('front');
  const [color, setColor] = useState('#E5E7EB');
  const [colorName, setColorName] = useState('Salmon');
  const [zoom, setZoom] = useState(1);
  const [sizeGuideOpen, setSizeGuideOpen] = useState(false);
  const { mockups } = useMockups(PRODUCT_KEY);
  const { product } = useCustomProduct(PRODUCT_KEY);

  // Dynamic content w/ safe fallbacks so the layout stays intact while loading.
  const title = product?.title || 'New States Apparel Premium Cotton T-shirt 7200';
  const description =
    product?.description ||
    'Made from lightweight ring-spun cotton, this t-shirt offers a noticeably softer and more comfortable feel. It features a regular fit that sits nicely without feeling tight. A versatile choice for relaxed days or clean, casual looks.';
  const dynamicSizes = product?.sizes && product.sizes.length ? product.sizes : SIZES;
  const dynamicSpecs =
    product?.specs && product.specs.length
      ? product.specs
      : [
          '100% cotton ring spun preshrunk jersey knit.',
          '50% Cotton, 50% Polyester for Heather colors.',
          '90% Cotton, 10% Polyester for Sport Grey color.',
          '180g/m².',
          'Single needle 2.2 cm collar.',
          'Taped neck and shoulders.',
          'Tubular construction.',
          'Double needle sleeve and bottom hems.',
          'Quarter-turned to eliminate centre crease.',
        ];
  const sizeGuideSrc = product?.size_guide_url || DEFAULT_SIZE_GUIDE;

  if (!READY) return <ComingSoon />;

  const zoomIn = () => setZoom((z) => Math.min(2, +(z + 0.15).toFixed(2)));
  const zoomOut = () => setZoom((z) => Math.max(0.5, +(z - 0.15).toFixed(2)));

  return (
    <div
      className="flex h-[calc(100vh-0px)] w-full bg-background overflow-hidden"
      data-testid="custom-design-page"
    >
      {/* ============ LEFT TOOL RAIL ============ */}
      <aside
        className="w-16 sm:w-20 shrink-0 border-r-2 border-foreground bg-card flex flex-col"
        data-testid="custom-tool-rail"
      >
        {TOOLS.map((t) => {
          const Icon = t.icon;
          const active = activeTool === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTool(t.id)}
              data-testid={`custom-tool-${t.id}`}
              className={`flex flex-col items-center justify-center gap-1 py-3 border-b border-foreground/15 text-[10px] font-semibold uppercase tracking-wider transition-colors ${
                active
                  ? 'bg-foreground text-background'
                  : 'text-foreground hover:bg-muted'
              }`}
            >
              <Icon size={20} strokeWidth={1.75} />
              <span className="leading-tight text-center px-1">{t.label}</span>
            </button>
          );
        })}
      </aside>

      {/* ============ PRODUCT / TOOL PANEL ============ */}
      <aside
        className="w-72 sm:w-80 shrink-0 border-r-2 border-foreground bg-background overflow-y-auto"
        data-testid="custom-side-panel"
      >
        <div className="p-4 sm:p-5">
          <h2 className="font-display uppercase tracking-wider text-lg mb-3">Produk</h2>

          <div className="border-2 border-foreground bg-card p-4 shadow-stamp">
            <h3 className="font-display uppercase tracking-wide text-base leading-snug mb-2">
              {title}
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed mb-4">
              {description}
            </p>
            <div className="flex gap-2">
              <button
                data-testid="custom-btn-change-product"
                className="w-full border-2 border-foreground bg-foreground text-background text-[11px] font-bold uppercase tracking-widest py-2 lift"
              >
                Ganti Produk
              </button>
            </div>
          </div>

          {/* Ukuran */}
          <div className="mt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold">Ukuran:</span>
              <button
                type="button"
                onClick={() => setSizeGuideOpen(true)}
                className="text-[11px] font-bold uppercase tracking-widest underline underline-offset-2 hover:text-primary"
                data-testid="custom-size-guide"
              >
                Panduan Ukuran
              </button>
            </div>
            <p className="text-sm text-foreground/80">{dynamicSizes.join(' – ')}</p>
          </div>

          {/* Warna */}
          <div className="mt-6">
            <p className="text-sm font-semibold mb-3">
              Warna: <span className="font-normal">{colorName}</span>
            </p>
            <div className="grid grid-cols-8 gap-2" data-testid="custom-color-grid">
              {COLORS.map((c) => {
                const active = c.hex === color;
                return (
                  <button
                    key={c.hex + c.name}
                    onClick={() => {
                      setColor(c.hex);
                      setColorName(c.name);
                    }}
                    title={c.name}
                    aria-label={c.name}
                    data-testid={`custom-color-${c.name.toLowerCase().replace(/\s+/g, '-')}`}
                    className={`h-6 w-6 border-2 ${
                      active ? 'border-foreground ring-2 ring-foreground ring-offset-1 ring-offset-background' : 'border-foreground/30'
                    }`}
                    style={{ background: c.hex }}
                  />
                );
              })}
            </div>
          </div>

          {/* Spesifikasi */}
          <div className="mt-6">
            <p className="text-sm font-semibold mb-2">Spesifikasi</p>
            <ul className="list-disc pl-5 text-xs text-foreground/80 space-y-1 leading-relaxed">
              {dynamicSpecs.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </div>
        </div>
      </aside>

      {/* ============ CANVAS ============ */}
      <main className="flex-1 relative bg-muted/40 overflow-hidden" data-testid="custom-canvas">
        {/* Top dock */}
        <div
          className="absolute top-4 left-1/2 -translate-x-1/2 flex bg-card border-2 border-foreground shadow-stamp z-10"
          data-testid="custom-top-dock"
        >
          <DockButton icon={Undo2} label="Undo" testId="custom-undo" onClick={() => {}} />
          <DockButton icon={Redo2} label="Redo" testId="custom-redo" onClick={() => {}} />
          <DockButton icon={ZoomIn} label="Perbesar" testId="custom-zoom-in" onClick={zoomIn} active />
          <DockButton icon={ZoomOut} label="Perkecil" testId="custom-zoom-out" onClick={zoomOut} />
        </div>

        {/* Canvas stage */}
        <div className="absolute inset-0 flex items-center justify-center p-8">
          <div
            className="h-[80%] max-h-[720px] transition-transform duration-200 flex items-center justify-center"
            style={{ transform: `scale(${zoom})` }}
          >
            <TshirtMockup view={activeView} colorHex={color} mockups={mockups} alt={`${colorName} ${activeView}`} priority />
          </div>
        </div>

        {/* Zoom badge */}
        <div className="absolute bottom-4 left-4 bg-card border-2 border-foreground px-2.5 py-1 text-[11px] font-bold uppercase tracking-widest shadow-stamp">
          {Math.round(zoom * 100)}%
        </div>
      </main>

      {/* ============ RIGHT VIEWS RAIL ============ */}
      <aside
        className="w-24 sm:w-28 shrink-0 border-l-2 border-foreground bg-card overflow-y-auto p-2 sm:p-3 space-y-3"
        data-testid="custom-views-rail"
      >
        {VIEWS.map((v) => {
          const active = activeView === v.id;
          return (
            <button
              key={v.id}
              onClick={() => setActiveView(v.id)}
              data-testid={`custom-view-${v.id}`}
              className={`w-full border-2 bg-background flex flex-col items-center gap-1 p-1.5 transition-shadow ${
                active
                  ? 'border-foreground shadow-stamp'
                  : 'border-foreground/25 hover:border-foreground'
              }`}
            >
              <div className="w-full aspect-square bg-muted/60 flex items-center justify-center overflow-hidden">
                <div className="h-14 w-auto">
                  <TshirtMockup view={v.id} colorHex={color} mockups={mockups} alt={v.label} />
                </div>
              </div>
              <span
                className={`text-[10px] font-semibold uppercase tracking-wider text-center leading-tight ${
                  active ? 'text-foreground' : 'text-muted-foreground'
                }`}
              >
                {v.label}
              </span>
            </button>
          );
        })}
      </aside>

      {/* Size guide modal — opens when user taps "Panduan Ukuran" */}
      {sizeGuideOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/70 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Panduan Ukuran"
          data-testid="size-guide-modal"
          onClick={() => setSizeGuideOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative bg-background border-2 border-foreground shadow-stamp max-w-4xl w-full max-h-[92vh] overflow-hidden flex flex-col"
          >
            <div className="flex items-center justify-between border-b-2 border-foreground px-4 py-2.5 bg-card">
              <h3 className="font-display uppercase tracking-widest text-sm sm:text-base">Panduan Ukuran</h3>
              <button
                type="button"
                onClick={() => setSizeGuideOpen(false)}
                aria-label="Tutup"
                data-testid="size-guide-close"
                className="p-1.5 border-2 border-foreground bg-background hover:bg-foreground hover:text-background transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            <div className="overflow-auto p-3 sm:p-5 bg-muted/30 flex-1">
              <img
                src={sizeGuideSrc}
                alt="Panduan Ukuran"
                className="w-full h-auto object-contain mx-auto max-h-[80vh]"
                loading="lazy"
                draggable={false}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DockButton({ icon: Icon, label, onClick, active = false, testId }) {
  return (
    <button
      onClick={onClick}
      data-testid={testId}
      className={`flex flex-col items-center justify-center gap-0.5 px-3 py-2 border-r-2 border-foreground last:border-r-0 min-w-[64px] transition-colors ${
        active ? 'bg-foreground text-background' : 'bg-card hover:bg-muted text-foreground'
      }`}
    >
      <Icon size={16} strokeWidth={1.75} />
      <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
    </button>
  );
}
