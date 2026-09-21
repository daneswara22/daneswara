/**
 * Admin — Custom Tees Orders
 * Daftar pesanan Custom Tees yang dikirim customer dari desainer.
 * Menampilkan: Order ID, tanggal, nama, kontak, email, jenis, ukuran, warna,
 * preview desain (lengkap), dan status. Admin bisa memperbarui status.
 */
import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import api, { formatApiError } from "@/lib/api";
import {
  Palette, RefreshCw, X, Loader2, Shirt, Phone, Mail, Calendar, Plus, Trash2,
} from "lucide-react";

/* Mockup kaos statis (sama seperti desainer) untuk render preview read-only. */
const MOCKUPS = {
  "Depan": "/mockups/depan.webp",
  "Belakang": "/mockups/belakang.webp",
  "Lengan Kiri": "/mockups/lengan-kiri.webp",
  "Lengan Kanan": "/mockups/lengan-kanan.webp",
};
const MOCKUP_MASKS = {
  "Depan": "/mockups/depan-mask.webp",
  "Belakang": "/mockups/belakang-mask.webp",
  "Lengan Kiri": "/mockups/lengan-kiri-mask.webp",
  "Lengan Kanan": "/mockups/lengan-kanan-mask.webp",
};
const VIEWS = ["Depan", "Belakang", "Lengan Kiri", "Lengan Kanan"];
const STATUSES = ["Baru", "Diproses", "Selesai", "Dibatalkan"];
const STATUS_STYLE = {
  Baru: "bg-blue-100 text-blue-700 border-blue-200",
  Diproses: "bg-amber-100 text-amber-700 border-amber-200",
  Selesai: "bg-green-100 text-green-700 border-green-200",
  Dibatalkan: "bg-zinc-100 text-zinc-500 border-zinc-200",
};

const fmtDate = (iso) => {
  try {
    return new Date(iso).toLocaleString("id-ID", {
      day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
    });
  } catch { return iso; }
};

/* Render read-only sebuah sisi desain (mockup + layer gambar/teks) — desain UTUH. */
function SidePreview({ view, colorHex, layers, height = 150 }) {
  const white = (colorHex || "#ffffff").toLowerCase() === "#ffffff";
  return (
    <div className="relative overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50" style={{ height }}>
      <img src={MOCKUPS[view]} alt={view} className="absolute inset-0 h-full w-full object-contain" draggable={false} />
      {!white && (
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundColor: colorHex,
            WebkitMaskImage: `url(${MOCKUP_MASKS[view]})`,
            maskImage: `url(${MOCKUP_MASKS[view]})`,
            WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat",
            WebkitMaskPosition: "center", maskPosition: "center",
            WebkitMaskSize: "contain", maskSize: "contain",
            mixBlendMode: "multiply",
          }}
        />
      )}
      {(layers || []).map((l) => (
        <div
          key={l.id}
          className="absolute"
          style={{
            left: `${l.cx}%`, top: `${l.cy}%`,
            width: `${l.wPct}%`,
            transform: `translate(-50%, -50%) rotate(${l.rot || 0}deg)`,
          }}
        >
          {l.type === "text" ? (
            <span
              style={{
                color: l.color, fontFamily: l.font, fontWeight: l.bold ? 700 : 400,
                fontStyle: l.italic ? "italic" : "normal", whiteSpace: "pre",
                fontSize: `${(l.wPct / 100) * height}px`, lineHeight: 1.1, display: "block", textAlign: "center",
              }}
            >
              {l.text}
            </span>
          ) : (
            <img src={l.src} alt="" className="w-full select-none" draggable={false} />
          )}
        </div>
      ))}
      <span className="absolute left-1.5 top-1.5 rounded bg-zinc-900/80 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">
        {view}
      </span>
    </div>
  );
}

function DetailModal({ id, onClose, onChanged }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api.get(`/custom-tees-orders/${id}`)
      .then((r) => { if (alive) setData(r.data); })
      .catch((e) => toast.error(formatApiError(e?.response?.data?.detail)))
      .finally(() => { if (alive) setLoading(false); onChanged && onChanged(); });
    return () => { alive = false; };
  }, [id]);

  const updateStatus = async (status) => {
    setSaving(true);
    try {
      await api.patch(`/custom-tees-orders/${id}`, { status });
      setData((d) => ({ ...d, status }));
      toast.success(`Status diperbarui: ${status}`);
      onChanged && onChanged();
    } catch (e) {
      toast.error(formatApiError(e?.response?.data?.detail));
    } finally { setSaving(false); }
  };

  const views = (data?.design?.views) || {};

  return (
    <div className="fixed inset-0 z-[220] flex items-center justify-center bg-black/60 p-2 sm:p-4" data-testid="cto-detail-modal" onClick={onClose}>
      <div className="flex w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" style={{ maxHeight: "94vh" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-zinc-100 px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-zinc-900">{data?.order_code || "Detail Pesanan"}</h2>
            <p className="text-[12px] text-zinc-500">{data ? fmtDate(data.created_at) : ""}</p>
          </div>
          <button onClick={onClose} data-testid="cto-detail-close" className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-300 text-zinc-500 hover:bg-zinc-100"><X className="h-4 w-4" /></button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-zinc-400"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Memuat…</div>
          ) : !data ? (
            <div className="py-16 text-center text-zinc-400">Data tidak ditemukan.</div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-zinc-200 p-3">
                  <h3 className="mb-2 text-[13px] font-bold text-zinc-900">Data Customer</h3>
                  <div className="space-y-1 text-[13px] text-zinc-700">
                    <div className="font-semibold">{data.customer_name}</div>
                    <div className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 text-zinc-400" /> {data.customer_phone}</div>
                    <div className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5 text-zinc-400" /> {data.customer_email || "—"}</div>
                  </div>
                </div>
                <div className="rounded-xl border border-zinc-200 p-3">
                  <h3 className="mb-2 text-[13px] font-bold text-zinc-900">Spesifikasi Kaos</h3>
                  <div className="space-y-1 text-[13px] text-zinc-700">
                    <div className="flex justify-between gap-2"><span className="text-zinc-500">Jenis</span><span className="text-right font-semibold">{data.product_name}</span></div>
                    <div className="flex justify-between gap-2"><span className="text-zinc-500">Ukuran</span><span className="font-semibold">{data.shirt_size}</span></div>
                    <div className="flex items-center justify-between gap-2"><span className="text-zinc-500">Warna</span><span className="flex items-center gap-1.5 font-semibold"><span className="h-4 w-4 rounded-full border border-zinc-300" style={{ backgroundColor: data.color_hex }} />{data.color_name}</span></div>
                  </div>
                </div>
              </div>

              <h3 className="mb-2 mt-4 text-[13px] font-bold text-zinc-900">Preview Desain (Semua Sisi)</h3>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {VIEWS.map((v) => (
                  <SidePreview key={v} view={v} colorHex={data.color_hex} layers={views[v] || []} />
                ))}
              </div>

              <h3 className="mb-2 mt-4 text-[13px] font-bold text-zinc-900">Status Pesanan</h3>
              <div className="flex flex-wrap gap-2">
                {STATUSES.map((s) => (
                  <button
                    key={s}
                    onClick={() => updateStatus(s)}
                    disabled={saving}
                    data-testid={`cto-status-${s.toLowerCase()}`}
                    className={`rounded-lg border px-3 py-1.5 text-[13px] font-semibold transition disabled:opacity-60 ${
                      data.status === s ? STATUS_STYLE[s] + " ring-2 ring-offset-1 ring-zinc-400" : "border-zinc-200 text-zinc-600 hover:border-zinc-400"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CustomTeesOrders() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [newCount, setNewCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    api.get("/custom-tees-orders")
      .then((r) => { setOrders(r.data?.orders || []); setNewCount(r.data?.new_count || 0); })
      .catch((e) => toast.error(formatApiError(e?.response?.data?.detail)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const remove = async (id, code) => {
    if (!window.confirm(`Hapus pesanan ${code}?`)) return;
    try {
      await api.delete(`/custom-tees-orders/${id}`);
      toast.success("Pesanan dihapus.");
      load();
    } catch (e) { toast.error(formatApiError(e?.response?.data?.detail)); }
  };

  return (
    <div className="p-4 sm:p-6" data-testid="custom-tees-orders-page">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Palette className="h-5 w-5" /></div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Custom Tees</h1>
            <p className="text-[13px] text-muted-foreground">
              {orders.length} pesanan · {newCount} baru
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} data-testid="cto-refresh" className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-secondary">
            <RefreshCw className="h-4 w-4" /> Muat Ulang
          </button>
          <button onClick={() => navigate("/custom-tees")} data-testid="cto-new-design" className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90">
            <Plus className="h-4 w-4" /> Buat Desain
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Memuat pesanan…</div>
      ) : orders.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-20 text-center text-muted-foreground" data-testid="cto-empty">
          Belum ada pesanan Custom Tees.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="bg-secondary text-left text-[12px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2.5">Order ID</th>
                <th className="px-3 py-2.5">Tanggal</th>
                <th className="px-3 py-2.5">Customer</th>
                <th className="px-3 py-2.5">Kontak</th>
                <th className="px-3 py-2.5">Kaos</th>
                <th className="px-3 py-2.5">Warna</th>
                <th className="px-3 py-2.5">Status</th>
                <th className="px-3 py-2.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {orders.map((o) => (
                <tr key={o.id} data-testid={`cto-row-${o.order_code}`} className="hover:bg-secondary/50">
                  <td className="px-3 py-2.5 font-mono text-[12px] font-semibold text-foreground">
                    <div className="flex items-center gap-2">
                      {!o.seen && <span className="h-2 w-2 shrink-0 rounded-full bg-blue-500" title="Belum dibuka" />}
                      {o.order_code}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-[12px] text-muted-foreground">{fmtDate(o.created_at)}</td>
                  <td className="px-3 py-2.5 font-medium text-foreground">{o.customer_name}</td>
                  <td className="px-3 py-2.5 text-[12px] text-muted-foreground">
                    <div>{o.customer_phone}</div>
                    <div>{o.customer_email || "—"}</div>
                  </td>
                  <td className="px-3 py-2.5 text-[12px] text-muted-foreground">
                    <div className="font-medium text-foreground">{o.shirt_size}</div>
                    <div className="max-w-[160px] truncate" title={o.product_name}>{o.product_name}</div>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
                      <span className="h-4 w-4 rounded-full border border-border" style={{ backgroundColor: o.color_hex }} />
                      {o.color_name}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`inline-block rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${STATUS_STYLE[o.status] || "bg-zinc-100 text-zinc-600 border-zinc-200"}`}>
                      {o.status}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-end gap-1.5">
                      <button onClick={() => setOpenId(o.id)} data-testid={`cto-open-${o.order_code}`} className="rounded-md border border-border px-3 py-1.5 text-[12px] font-semibold text-foreground hover:bg-secondary">
                        Lihat
                      </button>
                      <button onClick={() => remove(o.id, o.order_code)} title="Hapus" className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-red-500 hover:bg-red-50">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {openId && <DetailModal id={openId} onClose={() => setOpenId(null)} onChanged={load} />}
    </div>
  );
}
