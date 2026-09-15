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
  const [mobilePanelTab, setMobilePanelTab] = useState(null); // null = closed
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
      className="flex flex-col h-[calc(100vh-0px)] w-full bg-background overflow-hidden"
      data-testid="custom-design-page"
    >
      {/* ==================== TOP BAR ==================== */}
      <header
        className="shrink-0 border-b-2 border-foreground bg-card"
        data-testid="custom-top-bar"
      >
        <div className="flex items-center gap-3 px-3 sm:px-5 py-2.5">
          <Link
            href="/"
            className="hidden sm:inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest hover:text-primary"
            data-testid="custom-back-link"
          >
            <ChevronLeft size={14} /> Kembali
          </Link>
          <div className="hidden sm:block h-6 w-[2px] bg-foreground/30" />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground leading-none">Custom Design</p>
            <h1 className="font-display uppercase tracking-wide text-sm sm:text-base truncate leading-tight">
              {title}
            </h1>
          </div>
          {/* Zoom & history cluster */}
          <div className="flex items-center gap-1 sm:gap-2">
            <div className="flex border-2 border-foreground bg-background">
              <TopIconBtn icon={Undo2} label="Undo" onClick={() => {}} testId="custom-undo" />
              <TopIconBtn icon={Redo2} label="Redo" onClick={() => {}} testId="custom-redo" />
            </div>
            <div className="flex items-center border-2 border-foreground bg-background">
              <TopIconBtn icon={ZoomOut} label="Perkecil" onClick={zoomOut} testId="custom-zoom-out" />
              <span
                className="px-2 sm:px-3 text-[11px] font-bold tabular-nums border-x-2 border-foreground select-none"
                data-testid="custom-zoom-label"
              >
                {Math.round(zoom * 100)}%
              </span>
              <TopIconBtn icon={ZoomIn} label="Perbesar" onClick={zoomIn} testId="custom-zoom-in" />
            </div>
          </div>
        </div>
      </header>

      {/* ==================== MAIN ROW ==================== */}
      <div className="flex flex-1 min-h-0">
        {/* Left compact tool dock (icon-only) */}
        <aside
          className="w-12 sm:w-14 shrink-0 border-r-2 border-foreground bg-card flex flex-col items-stretch"
          data-testid="custom-tool-rail"
        >
          {TOOLS.map((t) => {
            const Icon = t.icon;
            const active = activeTool === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTool(t.id)}
                title={t.label}
                aria-label={t.label}
                data-testid={`custom-tool-${t.id}`}
                className={`relative flex items-center justify-center py-3.5 border-b border-foreground/15 transition-colors ${
                  active
                    ? 'bg-foreground text-background'
                    : 'text-foreground hover:bg-muted'
                }`}
              >
                <Icon size={18} strokeWidth={1.75} />
                {active && (
                  <span className="absolute right-0 top-0 h-full w-[3px] bg-primary" aria-hidden />
                )}
              </button>
            );
          })}
        </aside>

        {/* Canvas center */}
        <main className="flex-1 relative bg-muted/40 overflow-hidden" data-testid="custom-canvas">
          <div className="absolute inset-0 flex items-center justify-center p-4 sm:p-8">
            <div
              className="h-[80%] max-h-[720px] transition-transform duration-200 flex items-center justify-center"
              style={{ transform: `scale(${zoom})` }}
            >
              <TshirtMockup
                view={activeView}
                colorHex={color}
                mockups={mockups}
                alt={`${colorName} ${activeView}`}
                priority
              />
            </div>
          </div>
          {/* Selected color chip pinned bottom-left of canvas */}
          <div className="absolute bottom-3 left-3 flex items-center gap-2 bg-card border-2 border-foreground shadow-stamp px-2.5 py-1.5">
            <span
              className="h-4 w-4 border-2 border-foreground"
              style={{ background: color }}
              aria-hidden
            />
            <span className="text-[11px] font-bold uppercase tracking-widest">{colorName}</span>
          </div>
        </main>

        {/* Right panel with tabs (desktop only) */}
        <aside
          className="hidden md:flex w-72 sm:w-80 shrink-0 border-l-2 border-foreground bg-background flex-col"
          data-testid="custom-side-panel"
        >
          <RightPanel
            title={title}
            description={description}
            sizes={dynamicSizes}
            specs={dynamicSpecs}
            color={color}
            colorName={colorName}
            onSelectColor={(hex, name) => { setColor(hex); setColorName(name); }}
            onOpenSizeGuide={() => setSizeGuideOpen(true)}
          />
        </aside>
      </div>

      {/* ==================== BOTTOM VIEWS STRIP ==================== */}
      <footer
        className="shrink-0 border-t-2 border-foreground bg-card"
        data-testid="custom-views-strip"
      >
        <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-5 py-2.5 overflow-x-auto">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground shrink-0 hidden sm:inline">
            Sudut Pandang
          </span>
          <div className="hidden sm:block h-6 w-[2px] bg-foreground/30 shrink-0" />
          {VIEWS.map((v) => {
            const active = activeView === v.id;
            return (
              <button
                key={v.id}
                onClick={() => setActiveView(v.id)}
                data-testid={`custom-view-${v.id}`}
                className={`group flex items-center gap-2 border-2 pl-1.5 pr-3 py-1 transition-shadow shrink-0 ${
                  active
                    ? 'border-foreground bg-background shadow-stamp'
                    : 'border-foreground/25 bg-background/60 hover:border-foreground'
                }`}
              >
                <div className="h-10 w-10 flex items-center justify-center bg-muted/60 overflow-hidden">
                  <div className="h-9 w-auto">
                    <TshirtMockup view={v.id} colorHex={color} mockups={mockups} alt={v.label} />
                  </div>
                </div>
                <span
                  className={`text-[11px] font-bold uppercase tracking-widest ${
                    active ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground'
                  }`}
                >
                  {v.label}
                </span>
              </button>
            );
          })}
        </div>
      </footer>

      {/* ==================== MOBILE BOTTOM TAB BAR ==================== */}
      <nav
        className="md:hidden shrink-0 grid grid-cols-3 border-t-2 border-foreground bg-card"
        data-testid="custom-mobile-tabs"
      >
        {[
          { id: 'color', label: 'Warna' },
          { id: 'size', label: 'Ukuran' },
          { id: 'info', label: 'Info' },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setMobilePanelTab(t.id)}
            data-testid={`custom-mobile-tab-${t.id}`}
            className="py-3 text-[11px] font-bold uppercase tracking-widest border-r-2 last:border-r-0 border-foreground hover:bg-foreground hover:text-background transition-colors"
          >
            {t.label}
          </button>
        ))}
      </nav>

      {/* ==================== MOBILE BOTTOM SHEET ==================== */}
      {mobilePanelTab && (
        <div
          className="md:hidden fixed inset-0 z-40 flex flex-col"
          data-testid="custom-mobile-sheet"
        >
          <div
            className="flex-1 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobilePanelTab(null)}
            aria-hidden
          />
          <div className="bg-background border-t-2 border-foreground max-h-[75vh] flex flex-col shadow-stamp">
            <div className="flex items-center justify-between px-4 py-2 border-b-2 border-foreground bg-card">
              <span className="font-display uppercase tracking-widest text-sm">
                {mobilePanelTab === 'color' ? 'Warna' : mobilePanelTab === 'size' ? 'Ukuran' : 'Info Produk'}
              </span>
              <button
                type="button"
                onClick={() => setMobilePanelTab(null)}
                aria-label="Tutup"
                data-testid="custom-mobile-sheet-close"
                className="p-1.5 border-2 border-foreground bg-background hover:bg-foreground hover:text-background transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            <div className="overflow-y-auto">
              <RightPanel
                initialTab={mobilePanelTab}
                hideTabs
                title={title}
                description={description}
                sizes={dynamicSizes}
                specs={dynamicSpecs}
                color={color}
                colorName={colorName}
                onSelectColor={(hex, name) => { setColor(hex); setColorName(name); }}
                onOpenSizeGuide={() => { setMobilePanelTab(null); setSizeGuideOpen(true); }}
              />
            </div>
          </div>
        </div>
      )}

      {/* ==================== SIZE GUIDE MODAL ==================== */}
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

/* -------- small button used in the top bar (icon + tooltip) -------- */
function TopIconBtn({ icon: Icon, label, onClick, testId }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      data-testid={testId}
      className="h-8 w-9 sm:w-10 flex items-center justify-center border-r-2 border-foreground last:border-r-0 text-foreground hover:bg-foreground hover:text-background transition-colors"
    >
      <Icon size={15} strokeWidth={1.9} />
    </button>
  );
}

/* -------- right panel with tabs: Warna / Ukuran / Info -------- */
function RightPanel({
  title,
  description,
  sizes,
  specs,
  color,
  colorName,
  onSelectColor,
  onOpenSizeGuide,
  initialTab = 'color',
  hideTabs = false,
}) {
  const [tab, setTab] = useState(initialTab);
  const tabs = [
    { id: 'color', label: 'Warna' },
    { id: 'size', label: 'Ukuran' },
    { id: 'info', label: 'Info' },
  ];
  return (
    <div className="flex flex-col h-full">
      {/* Tab head */}
      {!hideTabs && (
        <div className="grid grid-cols-3 border-b-2 border-foreground bg-card" data-testid="custom-right-tabs">
          {tabs.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                data-testid={`custom-right-tab-${t.id}`}
                className={`py-2.5 text-[11px] font-bold uppercase tracking-widest border-r-2 last:border-r-0 border-foreground transition-colors ${
                  active
                    ? 'bg-foreground text-background'
                    : 'bg-background text-foreground hover:bg-muted'
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Tab body (scrolls) */}
      <div className="flex-1 overflow-y-auto">
        {tab === 'color' && (
          <div className="p-4 sm:p-5" data-testid="pane-color">
            <div className="flex items-center gap-2 mb-3">
              <span
                className="h-6 w-6 border-2 border-foreground"
                style={{ background: color }}
                aria-hidden
              />
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground leading-none">Warna terpilih</p>
                <p className="text-sm font-bold truncate">{colorName}</p>
              </div>
            </div>
            <div className="grid grid-cols-6 sm:grid-cols-7 gap-1.5" data-testid="custom-color-grid">
              {COLORS.map((c) => {
                const active = c.hex === color;
                return (
                  <button
                    key={c.hex + c.name}
                    onClick={() => onSelectColor(c.hex, c.name)}
                    title={c.name}
                    aria-label={c.name}
                    data-testid={`custom-color-${c.name.toLowerCase().replace(/\s+/g, '-')}`}
                    className={`aspect-square border-2 transition-transform ${
                      active
                        ? 'border-foreground ring-2 ring-foreground ring-offset-1 ring-offset-background'
                        : 'border-foreground/25 hover:scale-110'
                    }`}
                    style={{ background: c.hex }}
                  />
                );
              })}
            </div>
          </div>
        )}

        {tab === 'size' && (
          <div className="p-4 sm:p-5 space-y-4" data-testid="pane-size">
            <div className="flex flex-wrap gap-1.5">
              {sizes.map((s) => (
                <span
                  key={s}
                  className="inline-flex items-center justify-center min-w-[36px] h-8 px-2.5 border-2 border-foreground bg-card text-xs font-bold uppercase tracking-wider"
                >
                  {s}
                </span>
              ))}
            </div>
            <button
              type="button"
              onClick={onOpenSizeGuide}
              data-testid="custom-size-guide"
              className="w-full border-2 border-foreground bg-foreground text-background py-2.5 text-[11px] font-bold uppercase tracking-widest lift"
            >
              Buka Panduan Ukuran
            </button>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Toleransi ukuran 1–2,5 cm. Klik &quot;Buka Panduan Ukuran&quot; untuk melihat detail dimensi.
            </p>
          </div>
        )}

        {tab === 'info' && (
          <div className="p-4 sm:p-5 space-y-4" data-testid="pane-info">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground leading-none mb-1">Produk</p>
              <h3 className="font-display uppercase tracking-wide text-sm leading-snug mb-2">{title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
            </div>
            <button
              type="button"
              data-testid="custom-btn-change-product"
              className="w-full border-2 border-foreground bg-background text-foreground py-2 text-[11px] font-bold uppercase tracking-widest lift"
            >
              Ganti Produk
            </button>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest mb-2">Spesifikasi</p>
              <ul className="list-disc pl-5 text-xs text-foreground/80 space-y-1 leading-relaxed">
                {specs.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
