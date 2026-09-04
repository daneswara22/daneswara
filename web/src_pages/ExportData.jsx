import { useState } from "react";
import api, { formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Download, DownloadCloud, Receipt, ShoppingBag, ClipboardList, Wallet, HandCoins,
  Warehouse, Package, Tags, UserCircle, Truck, Users as UsersIcon, History,
} from "lucide-react";

const TRANSACTIONS = [
  { key: "sales", label: "Penjualan", desc: "Semua transaksi kasir (POS)", icon: Receipt, dateFilter: true },
  { key: "orders", label: "Pesanan", desc: "Pesanan & deposit (DP)", icon: ShoppingBag, dateFilter: true },
  { key: "purchases", label: "Pembelian", desc: "Transaksi pembelian ke supplier", icon: ClipboardList, dateFilter: true },
  { key: "expenses", label: "Pengeluaran", desc: "Catatan biaya & pengeluaran", icon: Wallet, dateFilter: true },
  { key: "other_income", label: "Pendapatan Lain-lain", desc: "Biaya layanan, express, komisi, dll", icon: HandCoins, dateFilter: true },
  { key: "stock_movements", label: "Mutasi Stok", desc: "Riwayat perubahan stok", icon: Warehouse, dateFilter: true },
  { key: "activities", label: "Log Aktivitas", desc: "Riwayat aktivitas pengguna", icon: History, dateFilter: true },
];

const MASTER = [
  { key: "products", label: "Produk", desc: "Data produk & harga", icon: Package, dateFilter: false },
  { key: "categories", label: "Kategori", desc: "Daftar kategori", icon: Tags, dateFilter: false },
  { key: "customers", label: "Pelanggan", desc: "Data pelanggan", icon: UserCircle, dateFilter: false },
  { key: "suppliers", label: "Supplier", desc: "Data supplier", icon: Truck, dateFilter: false },
  { key: "users", label: "Pengguna", desc: "Akun pengguna (termasuk semua kolom)", icon: UsersIcon, dateFilter: false },
];

const ALL = [...TRANSACTIONS, ...MASTER];

export default function ExportData() {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [loading, setLoading] = useState(null);
  const [bulk, setBulk] = useState(false);

  const download = async (ds) => {
    setLoading(ds.key);
    try {
      const params = {};
      if (ds.dateFilter) { if (start) params.start = start; if (end) params.end = end; }
      const res = await api.get(`/export/${ds.key}`, { params, responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: "text/csv;charset=utf-8" }));
      const a = document.createElement("a");
      a.href = url;
      const cd = res.headers["content-disposition"] || "";
      const m = cd.match(/filename="(.+?)"/);
      a.download = m ? m[1] : `${ds.key}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success(`Ekspor ${ds.label} berhasil`);
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || "Gagal mengekspor data");
    } finally {
      setLoading(null);
    }
  };

  const downloadAll = async () => {
    setBulk(true);
    for (const ds of ALL) {
      // eslint-disable-next-line no-await-in-loop
      await download(ds);
    }
    setBulk(false);
    toast.success("Semua data selesai diekspor");
  };

  const periodLabel = () => (start || end) ? `${start || "awal"} s/d ${end || "sekarang"}` : "Semua Periode";

  const Card = (ds) => (
    <div key={ds.key} className="flex items-center gap-3 rounded-lg border border-border bg-card p-4" data-testid={`export-card-${ds.key}`}>
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-secondary">
        <ds.icon className="h-5 w-5 text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-display text-sm font-semibold">{ds.label}</p>
        <p className="truncate text-xs text-muted-foreground">{ds.desc}</p>
      </div>
      <Button size="sm" variant="outline" className="gap-2" onClick={() => download(ds)} disabled={loading === ds.key || bulk} data-testid={`export-btn-${ds.key}`}>
        <Download className="h-4 w-4" /> {loading === ds.key ? "..." : "CSV"}
      </Button>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Backup & Data</p>
          <h1 className="font-display text-3xl font-bold tracking-tight">Ekspor Data</h1>
        </div>
        <Button className="gap-2" onClick={downloadAll} disabled={bulk} data-testid="export-all-button">
          <DownloadCloud className="h-4 w-4" /> {bulk ? "Mengunduh..." : "Unduh Semua CSV"}
        </Button>
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1"><Label className="text-xs">Dari (opsional)</Label><Input type="date" value={start} onChange={(e) => setStart(e.target.value)} data-testid="export-start" /></div>
          <div className="space-y-1"><Label className="text-xs">Sampai (opsional)</Label><Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} data-testid="export-end" /></div>
          {(start || end) && (
            <Button variant="ghost" onClick={() => { setStart(""); setEnd(""); }} data-testid="export-clear-dates">Reset Tanggal</Button>
          )}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Filter tanggal ({periodLabel()}) hanya berlaku untuk data transaksi. Data master (Produk, Kategori, dll) selalu diekspor lengkap.</p>
      </div>

      <div>
        <h3 className="mb-3 font-display font-semibold">Transaksi</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="export-transactions-grid">
          {TRANSACTIONS.map(Card)}
        </div>
      </div>

      <div>
        <h3 className="mb-3 font-display font-semibold">Master Data</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="export-master-grid">
          {MASTER.map(Card)}
        </div>
      </div>
    </div>
  );
}
