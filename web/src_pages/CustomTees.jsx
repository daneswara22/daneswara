/**
 * Custom Tees — Desainer Kaos (TAHAP 1: LAYOUT SAJA)
 * ---------------------------------------------------
 * Halaman ini sengaja dibuat statis untuk fokus pada tata letak dulu.
 * Belum ada fungsi apa pun (semua tombol dekoratif). Akses sementara hanya
 * lewat menu admin (link khusus dengan badge DEV).
 *
 * Skala warna dibuat eksplisit (light theme) supaya persis seperti rancangan,
 * tidak terpengaruh mode gelap admin.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Shirt, Upload, Type, Shapes, ImageIcon, LayoutTemplate, Layers,
  Undo2, Redo2, Save, HelpCircle, ChevronRight, ChevronDown, Check,
  Minus, Plus, RotateCcw, ArrowRight, LifeBuoy,
} from "lucide-react";

/* ---------- t-shirt silhouette (dipakai untuk kanvas & thumbnail) ---------- */
/* ---------- gambar mockup kaos (WebP ringan) per tampilan ---------- */
const MOCKUPS = {
  "Depan": "/mockups/depan.webp",
  "Belakang": "/mockups/belakang.webp",
  "Lengan Kiri": "/mockups/lengan-kiri.webp",
  "Lengan Kanan": "/mockups/lengan-kanan.webp",
};

const SIZES = ["S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL"];
const COLOR_TABS = ["Populer", "Netral", "Merah", "Biru", "Hijau", "Lainnya"];
const SWATCHES = [
  "#111111", "#ffffff", "#cbd0d6", "#2b3a67", "#5b1f1f", "#c0392b", "#2e7d32",
  "#f1c40f", "#27ae60", "#e67e22", "#3b3b2f", "#7a7a2e", "#8ec7f0", "#f4b8cf",
  "#d8c3a5", "#7d3cc9", "#1f3fae", "#2ea67a",
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

export default function CustomTees() {
  const navigate = useNavigate();
  const [view, setView] = useState("Depan");

  return (
    <div className="flex h-screen w-full overflow-hidden bg-zinc-100 text-zinc-900">
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
          {TOOLS.map((t, i) => {
            const active = i === 0;
            return (
              <button
                key={t.label}
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

        {/* -------- Left product panel -------- */}
        <aside className="hidden w-[300px] shrink-0 flex-col overflow-y-auto border-r border-zinc-200 bg-white p-4 lg:flex">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-bold">Produk</h2>
            <button className="flex items-center text-xs font-semibold text-zinc-500 hover:text-zinc-900">
              Ganti Produk <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* product card */}
          <div className="flex items-center gap-3 rounded-xl border border-zinc-200 p-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-zinc-100">
              <img src={MOCKUPS["Depan"]} alt="Kaos" className="h-9 w-9 object-contain" />
            </div>
            <div className="leading-tight">
              <div className="text-[13px] font-semibold">24 COTTON LOCAL SIZE (BUILDUP TEES)</div>
              <div className="text-[11px] text-zinc-500">Kaos 24s Dengan ukuran local</div>
            </div>
          </div>

          {/* size */}
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

          {/* color */}
          <div className="mt-5 flex items-center justify-between">
            <h3 className="text-sm font-bold">Warna Kaos</h3>
            <button className="text-xs font-semibold text-zinc-500 underline-offset-2 hover:text-zinc-900 hover:underline">Lihat Semua Warna</button>
          </div>
          <div className="mt-2 flex items-center gap-3 rounded-xl border border-zinc-200 p-2.5">
            <span className="h-8 w-8 rounded-full border border-zinc-300 bg-black" />
            <div className="leading-tight">
              <div className="text-sm font-semibold">Black</div>
              <div className="text-[11px] text-zinc-400">#000000</div>
            </div>
          </div>

          {/* color tabs */}
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

          {/* swatches */}
          <div className="mt-3 grid grid-cols-7 gap-2">
            {SWATCHES.map((c, i) => (
              <button
                key={`${c}-${i}`}
                title={c}
                className={`aspect-square rounded-full border ${
                  i === 0 ? "ring-2 ring-zinc-900 ring-offset-1" : "border-zinc-200"
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>

          {/* detail produk */}
          <button className="mt-5 flex items-center justify-between rounded-xl border border-zinc-200 px-3.5 py-3 text-sm font-semibold text-zinc-700 hover:bg-zinc-50">
            Detail Produk
            <ChevronDown className="h-4 w-4 text-zinc-400" />
          </button>
        </aside>

        {/* -------- Canvas -------- */}
        <main className="relative flex min-w-0 flex-1 flex-col items-center justify-center bg-zinc-100">
          <div className="flex w-full max-w-[560px] flex-col items-center px-6">
            <img
              src={MOCKUPS[view]}
              alt={`Kaos tampak ${view}`}
              className="h-[62vh] w-auto max-w-full object-contain drop-shadow-sm"
            />
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
              {VIEWS.map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`flex items-center gap-3 rounded-xl border p-2.5 text-sm transition ${
                    view === v ? "border-zinc-900 bg-zinc-50 font-semibold" : "border-zinc-200 hover:border-zinc-400"
                  }`}
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-100">
                    <img src={MOCKUPS[v]} alt={v} className="h-7 w-7 object-contain" />
                  </span>
                  {v}
                </button>
              ))}
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-bold">Status Desain</h3>
            <div className="flex flex-col gap-2.5">
              {VIEWS.map((v) => (
                <div key={v} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-zinc-700">
                    <Check className="h-4 w-4 text-emerald-500" /> {v}
                  </span>
                  <span className="text-xs font-semibold text-emerald-600">Siap</span>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>

      {/* ============================ BOTTOM BAR ============================ */}
      <footer className="flex h-16 shrink-0 items-center justify-between border-t border-zinc-200 bg-white px-4">
        <button className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100">
          <RotateCcw className="h-4 w-4" /> Reset Desain
        </button>

        <div className="flex items-center gap-3">
          <button className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-300 text-zinc-600 hover:bg-zinc-50">
            <Minus className="h-4 w-4" />
          </button>
          <span className="w-12 text-center text-sm font-semibold">100%</span>
          <button className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-300 text-zinc-600 hover:bg-zinc-50">
            <Plus className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 rounded-lg border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50">
            <Save className="h-4 w-4" /> Simpan Desain
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

/* small toolbar icon with tiny label under it */
function ToolbarIcon({ icon: Icon, label }) {
  return (
    <button className="flex w-12 flex-col items-center gap-0.5 rounded-lg py-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900">
      <Icon className="h-4.5 w-4.5" style={{ width: 18, height: 18 }} />
      <span className="text-[10px] leading-none">{label}</span>
    </button>
  );
}
