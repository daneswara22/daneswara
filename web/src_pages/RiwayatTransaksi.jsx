import { useEffect, useMemo, useState } from "react";
import api, { rupiah } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { NotaDialog } from "@/components/NotaDialog";
import { Search, Receipt, Printer } from "lucide-react";

export default function RiwayatTransaksi() {
  const [sales, setSales] = useState([]);
  const [settings, setSettings] = useState({});
  const [q, setQ] = useState("");
  const [nota, setNota] = useState(null);

  useEffect(() => {
    api.get("/sales?limit=1000").then((r) => setSales(r.data));
    api.get("/settings").then((r) => setSettings(r.data || {}));
  }, []);

  const term = q.trim().toLowerCase();
  const filtered = useMemo(
    () => term
      ? sales.filter((s) => `${s.invoice || ""} ${s.customer_name || ""} ${s.payment_method || ""} ${s.cashier || ""}`.toLowerCase().includes(term))
      : sales,
    [sales, term]
  );

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Kasir</p>
        <h1 className="font-display text-3xl font-bold tracking-tight">Riwayat Transaksi</h1>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari no. invoice, pelanggan, metode, kasir..." className="pl-10" data-testid="riwayat-search" />
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Invoice</th>
              <th className="px-4 py-3">Waktu</th>
              <th className="px-4 py-3">Pelanggan</th>
              <th className="px-4 py-3">Metode</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => (
              <tr key={s.id} className="cursor-pointer border-t border-border transition-colors hover:bg-secondary/50" onClick={() => setNota(s)} data-testid={`riwayat-row-${s.id}`}>
                <td className="px-4 py-3 font-medium">
                  {s.invoice}
                  {s.refunded && <span className="ml-2 rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive">Refunded</span>}
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(s.created_at).toLocaleString("id-ID")}</td>
                <td className="px-4 py-3">{s.customer_name || "Umum"}</td>
                <td className="px-4 py-3 text-muted-foreground">{s.payment_method}</td>
                <td className="px-4 py-3 text-right font-semibold">{rupiah(s.total)}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={(e) => { e.stopPropagation(); setNota(s); }} className="inline-flex items-center gap-1 text-primary" data-testid={`riwayat-reprint-${s.id}`}>
                    <Printer className="h-4 w-4" /> Nota
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                <Receipt className="mx-auto mb-2 h-8 w-8 opacity-40" />
                {term ? "Tidak ada transaksi cocok." : "Belum ada transaksi."}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      <NotaDialog nota={nota} onClose={() => setNota(null)} settings={settings} />
    </div>
  );
}
