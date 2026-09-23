/**
 * Daftar Harga DTF Digital Printing.
 * ---------------------------------------------------------------------------
 * Jenis kaos (Langkah 1) TIDAK lagi hardcoded: datanya diambil dari
 * `GET /api/public/custom-products` yang dikelola admin di halaman
 * /app/mockup-kaos ("Jenis Produk"). Setiap jenis kaos menampilkan:
 *   - harga kaos + spesifikasi (Suplier / Size / Model / Bahan)
 *   - jumlah varian warna sebagai deretan ikon kaos; ikon bisa diklik untuk
 *     melihat thumbnail tampak depan warna tersebut (di-upload admin)
 *   - size chart (lebar dada & panjang dalam cm)
 *
 * Paket cetakan (Langkah 2) tetap memakai tabel harga statis di bawah.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ShoppingBag, Check, Shirt, Loader2, ImageOff, X, Ruler } from "lucide-react";
import { useLang } from "@/components/landing/i18n/LangContext";
import { SubPageBar } from "@/components/landing/components/SubPageBar";

const PAGE_SIZE = 9;

const PRINTS = [
  { id: "logo", label: "Logo", price: 10000, mockup: "/assets/mockups/logo-front.webp" },
  { id: "a5", label: "A5", price: 15000, mockup: "/assets/mockups/a5.webp" },
  { id: "a4", label: "A4", price: 25000, mockup: "/assets/mockups/a4.webp" },
  { id: "a3", label: "A3", price: 30000, mockup: "/assets/mockups/a3.webp" },
];
const DOUBLE = {
  "logo+logo": "/assets/mockups/logo-logo.webp", "a5+logo": "/assets/mockups/logo-a5.webp",
  "a4+logo": "/assets/mockups/logo-a4.webp", "a3+logo": "/assets/mockups/logo-a3.webp",
  "a5+a5": "/assets/mockups/a5-a5.webp", "a4+a5": "/assets/mockups/a5-a4.webp",
  "a3+a5": "/assets/mockups/a5-a3.webp", "a4+a4": "/assets/mockups/a4-a4.webp",
  "a3+a4": "/assets/mockups/a4-a3.webp", "a3+a3": "/assets/mockups/a3-a3.webp",
};
const DISCOUNT = 5000;
const key = (a, b) => [a.id, b.id].sort().join("+");
const Rp = (n) => "Rp " + Number(n || 0).toLocaleString("id-ID");
const PAIRS = (() => { const o=[]; for (let i=0;i<PRINTS.length;i++) for (let j=i;j<PRINTS.length;j++) o.push([PRINTS[i],PRINTS[j]]); return o.sort((a,b)=>a[0].price+a[1].price-(b[0].price+b[1].price)); })();

const isLightHex = (hex) => {
  const h = String(hex || "").replace("#", "").slice(0, 6);
  if (h.length !== 6) return false;
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.72;
};

function Card({ shirt, label, pkgId, mockup, price, isID }) {
  const p = new URLSearchParams({ shirt: shirt.title, shirtId: shirt.product_key, package: label, packageId: pkgId, price: String(price) });
  return (
    <div className="bg-card border-2 border-foreground shadow-stamp flex flex-col">
      <div className="aspect-square bg-[#F4F1EA] border-b-2 border-foreground overflow-hidden">
        <img src={mockup} alt={label} loading="lazy" className="w-full h-full object-contain" />
      </div>
      <div className="p-4 flex-1 flex flex-col">
        <div className="font-display text-xl uppercase tracking-wider">{label}</div>
        <div className="font-display text-2xl text-primary mt-2 leading-none">{Rp(price)}</div>
        <Link data-testid="price-list-link-1" to={`/order?${p.toString()}`} className="mt-4 inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 border-2 border-foreground shadow-stamp font-bold uppercase tracking-wider text-xs lift">
          <ShoppingBag size={14} /> {isID ? "Pesan" : "Order"}
        </Link>
      </div>
    </div>
  );
}

/** Ikon kaos per varian warna; diklik => tampil thumbnail tampak depan. */
function ColorIcons({ colors, activeId, onPick, isID }) {
  const list = Array.isArray(colors) ? colors : [];
  if (list.length === 0) {
    return (
      <p className="text-xs uppercase tracking-widest text-muted-foreground">
        {isID ? "Warna menyusul" : "Colors coming soon"}
      </p>
    );
  }
  return (
    <div className="flex flex-wrap gap-1.5" data-testid="price-list-color-icons">
      {list.map((c) => {
        const active = activeId === c.id;
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onPick(active ? null : c)}
            title={`${c.name}${c.thumb_url ? "" : isID ? " (foto menyusul)" : " (photo coming soon)"}`}
            aria-label={`${isID ? "Lihat warna" : "View color"} ${c.name}`}
            data-testid={`price-list-color-${c.id}`}
            className={`relative grid place-items-center h-9 w-9 border-2 transition ${
              active ? "border-primary shadow-stamp-red" : "border-foreground/70 hover:border-primary"
            }`}
          >
            <Shirt
              size={20}
              strokeWidth={1.6}
              style={{ color: isLightHex(c.hex) ? "#111111" : c.hex, fill: c.hex }}
            />
          </button>
        );
      })}
    </div>
  );
}

export default function PriceList() {
  const { lang } = useLang();
  const isID = lang === "id";

  const [shirts, setShirts] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [selId, setSelId] = useState(null);
  const [activeColor, setActiveColor] = useState(null);
  const sentinelRef = useRef(null);

  const fetchPage = useCallback(async (targetPage, append) => {
    const res = await fetch(`/api/public/custom-products?page=${targetPage}&limit=${PAGE_SIZE}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    setTotal(data.total || 0);
    setHasMore(!!data.has_more);
    setPage(data.page || targetPage);
    setShirts((prev) => {
      const next = append ? [...prev, ...(data.items || [])] : data.items || [];
      const seen = new Set();
      return (next || []).filter((it) => (seen.has(it.id) ? false : seen.add(it.id)));
    });
    return data;
  }, []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchPage(1, false)
      .catch((e) => { if (alive) setError(e.message || "Gagal memuat jenis kaos"); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [fetchPage]);

  const loadMore = useCallback(() => {
    if (loading || loadingMore || !hasMore) return;
    setLoadingMore(true);
    fetchPage(page + 1, true)
      .catch(() => {})
      .finally(() => setLoadingMore(false));
  }, [fetchPage, hasMore, loading, loadingMore, page]);

  // lazy-load jenis kaos berikutnya saat sentinel terlihat
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => { if (entries.some((en) => en.isIntersecting)) loadMore(); },
      { rootMargin: "300px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [loadMore]);

  const sel = useMemo(() => (shirts || []).find((s) => s.id === selId) || null, [shirts, selId]);

  const pickShirt = (s) => {
    setSelId(s.id);
    setActiveColor(null);
  };

  return (
    <div className="min-h-screen bg-background">
      <SubPageBar />
      <header className="border-b-2 border-foreground bg-card">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10 py-8">
          <Link data-testid="price-list-link-2" to="/" className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground">
            <ArrowLeft size={14} /> {isID ? "Kembali" : "Back"}
          </Link>
          <div className="mt-4 text-xs uppercase tracking-[0.3em] text-primary font-bold">★ {isID ? "Daftar Harga" : "Price List"} ★</div>
          <h1 className="font-display mt-2 text-4xl sm:text-5xl lg:text-6xl uppercase tracking-wider leading-none">DTF Digital Printing</h1>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10 py-10 sm:py-14">
        {/* STEP 1 — Choose Shirt */}
        <section>
          <div className="text-[10px] uppercase tracking-[0.3em] font-bold text-primary">{isID ? "Langkah 1" : "Step 1"}</div>
          <h2 className="font-display text-2xl sm:text-3xl uppercase tracking-wider mt-1">
            {isID ? "Pilih Jenis Kaos" : "Choose Your T-Shirt"}
          </h2>

          {loading ? (
            <div className="mt-6 grid sm:grid-cols-3 gap-4" data-testid="price-list-shirts-loading">
              {[0, 1, 2].map((i) => (
                <div key={i} className="bg-card border-2 border-foreground shadow-stamp p-5 animate-pulse">
                  <div className="h-5 w-2/3 bg-foreground/10" />
                  <div className="mt-3 h-7 w-1/2 bg-foreground/10" />
                  <div className="mt-3 h-4 w-1/3 bg-foreground/10" />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="mt-6 bg-card border-2 border-foreground shadow-stamp p-6" data-testid="price-list-shirts-error">
              <p className="font-bold uppercase tracking-wider">{isID ? "Gagal memuat jenis kaos" : "Failed to load shirts"}</p>
              <p className="mt-1 text-sm text-muted-foreground">{error}</p>
            </div>
          ) : shirts.length === 0 ? (
            <div className="mt-6 bg-card border-2 border-foreground shadow-stamp p-6" data-testid="price-list-shirts-empty">
              <p className="font-bold uppercase tracking-wider">{isID ? "Belum ada jenis kaos" : "No shirts yet"}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {isID ? "Daftar harga sedang diperbarui, hubungi kami untuk penawaran." : "Our price list is being updated, contact us for a quote."}
              </p>
            </div>
          ) : (
            <>
              <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="price-list-shirts">
                {shirts.map((s) => {
                  const active = selId === s.id;
                  return (
                    <button
                      data-testid={`price-list-shirt-${s.product_key}`}
                      key={s.id}
                      onClick={() => pickShirt(s)}
                      className={`text-left bg-card border-2 border-foreground p-5 lift ${active ? "shadow-stamp-red ring-2 ring-primary" : "shadow-stamp"}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-display text-lg uppercase tracking-wider">{s.title}</div>
                        {active && <Check size={18} className="text-primary shrink-0" />}
                      </div>
                      <div className="font-display text-2xl text-primary mt-2 leading-none">{Rp(s.price)}</div>
                      <div className="text-xs uppercase tracking-widest text-muted-foreground mt-1">{isID ? "harga kaos" : "shirt only"}</div>
                      <div className="mt-3 flex items-center gap-2 text-[11px] uppercase tracking-widest text-muted-foreground">
                        <Shirt size={13} />
                        <span data-testid={`price-list-color-count-${s.product_key}`}>
                          {(s.colors || []).length} {isID ? "pilihan warna" : "colors"}
                        </span>
                        {(s.size_chart || []).length > 0 && (
                          <>
                            <span className="opacity-40">|</span>
                            <Ruler size={13} />
                            <span>{(s.size_chart || []).length} {isID ? "ukuran" : "sizes"}</span>
                          </>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div ref={sentinelRef} className="h-2" data-testid="price-list-sentinel" />
              {(loadingMore || hasMore) && (
                <div className="mt-4 flex flex-col items-center gap-2">
                  {loadingMore ? (
                    <span className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground" data-testid="price-list-loading-more">
                      <Loader2 size={14} className="animate-spin" /> {isID ? "Memuat..." : "Loading..."}
                    </span>
                  ) : (
                    <button
                      data-testid="price-list-load-more"
                      onClick={loadMore}
                      className="bg-card border-2 border-foreground shadow-stamp px-4 py-2 font-bold uppercase tracking-wider text-xs lift"
                    >
                      {isID ? `Lihat jenis kaos lain (${total - shirts.length})` : `Load more shirts (${total - shirts.length})`}
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </section>

        {sel && (
          <>
            {/* Shirt detail */}
            <section className="mt-12 bg-card border-2 border-foreground shadow-stamp-lg p-6 sm:p-8" data-testid="price-list-shirt-detail">
              <div className="text-[10px] uppercase tracking-[0.3em] font-bold text-primary">{isID ? "Detail Kaos" : "Shirt Details"}</div>
              <h3 className="font-display text-2xl uppercase tracking-wider mt-1">{sel.title}</h3>
              {sel.subtitle && <p className="mt-1 text-sm text-muted-foreground">{sel.subtitle}</p>}

              <dl className="mt-4 grid sm:grid-cols-2 gap-x-8 gap-y-2 text-sm">
                <SpecItem label={isID ? "Suplier" : "Supplier"} value={sel.supplier} />
                <SpecItem label="Size" value={sel.size_region} />
                <SpecItem label="Model" value={sel.model} />
                <SpecItem label={isID ? "Bahan" : "Material"} value={sel.material} />
              </dl>

              {sel.description && (
                <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{sel.description}</p>
              )}

              {/* Varian warna */}
              <div className="mt-6 border-t-2 border-dashed border-foreground/30 pt-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-display text-lg uppercase tracking-wider">
                    {isID ? "Pilihan Warna" : "Color Options"}
                  </div>
                  <span className="text-[11px] uppercase tracking-widest text-muted-foreground">
                    {(sel.colors || []).length} {isID ? "varian" : "variants"}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {isID ? "Klik ikon kaos untuk melihat tampilan depannya." : "Tap a shirt icon to preview the front view."}
                </p>
                <div className="mt-3">
                  <ColorIcons colors={sel.colors} activeId={activeColor?.id} onPick={setActiveColor} isID={isID} />
                </div>

                {activeColor && (
                  <div className="mt-4 border-2 border-foreground bg-[#F4F1EA] p-4" data-testid="price-list-color-preview">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span
                          className={`h-5 w-5 border ${isLightHex(activeColor.hex) ? "border-foreground/40" : "border-transparent"}`}
                          style={{ backgroundColor: activeColor.hex }}
                        />
                        <span className="font-display uppercase tracking-wider" data-testid="price-list-color-preview-name">
                          {activeColor.name}
                        </span>
                        <span className="font-mono text-[11px] text-muted-foreground">{activeColor.hex}</span>
                      </div>
                      <button
                        data-testid="price-list-color-preview-close"
                        onClick={() => setActiveColor(null)}
                        aria-label={isID ? "Tutup preview warna" : "Close color preview"}
                        className="border-2 border-foreground bg-card p-1 lift"
                      >
                        <X size={14} />
                      </button>
                    </div>
                    <div className="mt-3 grid place-items-center">
                      {activeColor.thumb_url ? (
                        <img
                          src={activeColor.thumb_url}
                          alt={`${sel.title} ${activeColor.name}`}
                          loading="lazy"
                          data-testid="price-list-color-preview-image"
                          className="max-h-80 w-auto object-contain"
                        />
                      ) : (
                        <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground" data-testid="price-list-color-preview-noimage">
                          <ImageOff size={28} />
                          <p className="text-xs uppercase tracking-widest text-center">
                            {isID ? "Foto warna ini belum tersedia" : "Photo for this color is not available yet"}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Size chart */}
              {(sel.size_chart || []).length > 0 && (
                <div className="mt-6 border-t-2 border-dashed border-foreground/30 pt-5">
                  <div className="font-display text-lg uppercase tracking-wider">
                    {isID ? "Tabel Ukuran" : "Size Chart"}
                  </div>
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full min-w-[320px] border-2 border-foreground text-sm" data-testid="price-list-size-chart">
                      <thead className="bg-foreground text-background">
                        <tr>
                          <th className="px-3 py-2 text-left text-[11px] uppercase tracking-widest">{isID ? "Ukuran" : "Size"}</th>
                          <th className="px-3 py-2 text-right text-[11px] uppercase tracking-widest">{isID ? "Lebar Dada" : "Chest"} (cm)</th>
                          <th className="px-3 py-2 text-right text-[11px] uppercase tracking-widest">{isID ? "Panjang" : "Length"} (cm)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(sel.size_chart || []).map((s) => (
                          <tr key={s.id} className="border-t border-foreground/20" data-testid={`price-list-size-row-${s.label}`}>
                            <td className="px-3 py-2 font-bold">{s.label}</td>
                            <td className="px-3 py-2 text-right">{s.chest_cm}</td>
                            <td className="px-3 py-2 text-right">{s.length_cm}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="mt-6">
                <Link
                  data-testid="price-list-design-link"
                  to={`/custom?product=${encodeURIComponent(sel.product_key)}`}
                  className="inline-flex items-center gap-2 bg-foreground text-background px-4 py-2.5 border-2 border-foreground shadow-stamp font-bold uppercase tracking-wider text-xs lift"
                >
                  {isID ? "Rancang Sendiri Kaos Ini" : "Design This Shirt"}
                </Link>
              </div>
            </section>

            {/* STEP 2 — Choose Package */}
            <section className="mt-12">
              <div className="text-[10px] uppercase tracking-[0.3em] font-bold text-primary">{isID ? "Langkah 2" : "Step 2"}</div>
              <h2 className="font-display text-2xl sm:text-3xl uppercase tracking-wider mt-1">
                {isID ? "Pilih Paket Cetakan" : "Choose Your Print Package"}
              </h2>

              <div className="mt-8 mb-4 flex items-center gap-3 bg-foreground text-background border-2 border-foreground px-4 py-2.5 shadow-stamp">
                <span className="font-display text-base sm:text-lg uppercase tracking-wider">
                  {isID ? "Sablon Satu Sisi" : "Single-Sided Printing"}
                </span>
                <span className="text-[10px] uppercase tracking-[0.25em] text-background/70 hidden sm:inline">
                  {isID ? "Cetak depan saja" : "Front only"}
                </span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {PRINTS.map((p) => (
                  <Card key={p.id} shirt={sel} label={p.label} pkgId={`single-${p.id}`} mockup={p.mockup} price={sel.price + p.price} isID={isID} />
                ))}
              </div>

              <div className="my-10 border-t-2 border-dashed border-foreground/40" />

              <div className="mt-6 mb-4 flex items-center gap-3 bg-primary text-primary-foreground border-2 border-foreground px-4 py-2.5 shadow-stamp">
                <span className="font-display text-base sm:text-lg uppercase tracking-wider">
                  {isID ? "Sablon Dua Sisi" : "Double-Sided Printing"}
                </span>
                <span className="text-[10px] uppercase tracking-[0.25em] text-primary-foreground/80">
                  {isID ? "Hemat Rp 5.000" : "Save Rp 5,000"}
                </span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {(PAIRS || []).map(([a, b]) => {
                  const k = key(a, b);
                  return <Card key={k} shirt={sel} label={`${a.label} + ${b.label}`} pkgId={`double-${k}`} mockup={DOUBLE[k]} price={sel.price + a.price + b.price - DISCOUNT} isID={isID} />;
                })}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function SpecItem({ label, value }) {
  return (
    <div className="flex justify-between gap-4 border-b border-foreground/15 pb-2">
      <dt className="uppercase tracking-widest text-[11px] font-bold">{label}</dt>
      <dd className="text-right">{value || "—"}</dd>
    </div>
  );
}
