import { useEffect, useState } from "react";
import api, { rupiah, formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { Receipt, Undo2, FileSpreadsheet, FileText, Scale, Landmark, Printer, Wallet, ArrowDownRight, ArrowUpRight, Store } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { printReceiptSmart } from "@/lib/printer";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const PIE = ["#2563EB", "#7C3AED", "#F97316", "#10B981", "#0EA5E9", "#EF4444"];
const METHOD_ORDER = ["Tunai", "BCA TOKO", "BRI TOKO", "BCA ADMIN (ELIS)", "QRIS", "E-Wallet"];
const BANK_METHODS = ["BCA TOKO", "BRI TOKO", "BCA ADMIN (ELIS)"];
const sortMethods = (arr) => [...arr].sort((a, b) => {
  const ia = METHOD_ORDER.indexOf(a.method); const ib = METHOD_ORDER.indexOf(b.method);
  return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
});

export default function Reports() {
  const { user } = useAuth();
  const canRefund = ["Owner", "Manager"].includes(user?.role);
  const [rep, setRep] = useState(null);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [trend, setTrend] = useState([]);
  const [pl, setPl] = useState(null);
  const [cash, setCash] = useState(null);
  const [detailSale, setDetailSale] = useState(null);
  const [settings, setSettings] = useState({});
  const [printing, setPrinting] = useState(false);

  const loadPL = (params) => {
    api.get("/reports/profit-loss", { params }).then((r) => setPl(r.data));
    api.get("/reports/cash-flow", { params }).then((r) => setCash(r.data)).catch(() => {});
  };
  const load = () => {
    const params = {};
    if (start) params.start = start;
    if (end) params.end = end;
    api.get("/reports/sales", { params }).then((r) => setRep(r.data));
    loadPL(params);
  };
  const loadTrend = (y) => {
    api.get("/reports/monthly", { params: { year: y } }).then((r) => setTrend(r.data.months));
  };
  useEffect(() => { load(); loadTrend(year); }, []);

  useEffect(() => { api.get("/settings").then((r) => setSettings(r.data || {})).catch(() => {}); }, []);

  const reprint = async () => {
    if (!detailSale) return;
    setPrinting(true);
    try {
      const mode = await printReceiptSmart(detailSale, settings);
      if (mode === "bluetooth") toast.success("Struk dikirim ke printer Bluetooth");
    } catch (e) {
      toast.error(e.message || "Gagal mencetak struk");
    } finally {
      setPrinting(false);
    }
  };

  const loadMonth = () => {
    const s = `${year}-${String(month).padStart(2, "0")}-01`;
    const last = new Date(year, month, 0).getDate();
    const e = `${year}-${String(month).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
    setStart(s); setEnd(e);
    api.get("/reports/sales", { params: { start: s, end: e } }).then((r) => setRep(r.data));
    loadPL({ start: s, end: e });
    loadTrend(year);
  };

  const MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  const YEARS = Array.from({ length: 6 }, (_, i) => now.getFullYear() - i);
  const trendData = trend.map((m) => ({ ...m, label: SHORT_MONTHS[m.month - 1] }));

  const periodLabel = () => {
    if (start && end) return `${start} s/d ${end}`;
    return "Semua Periode";
  };

  const exportExcel = () => {
    const header = [["Invoice", "Sumber", "Metode", "Subtotal", "Diskon", "Pajak", "Total", "Waktu"]];
    const rows = rep.sales.map((s) => [
      s.invoice, s.channel || "Toko", s.payment_method, s.subtotal || 0, s.discount || 0, s.tax || 0, s.total,
      new Date(s.created_at).toLocaleString("id-ID"),
    ]);
    const summary = [[], ["Ringkasan"], ["Periode", periodLabel()], ["Total Omzet", rep.total], ["Laba Kotor", rep.profit], ["Jumlah Transaksi", rep.count]];
    const perAccount = [[], ["Ringkasan Per Rekening / Metode"], ["Rekening / Metode", "Transaksi", "Total"], ...sortMethods(rep.by_method).map((m) => [m.method, m.count, m.total])];
    const perChannel = [[], ["Ringkasan Per Sumber Penjualan"], ["Sumber", "Transaksi", "Omzet", "Laba Kotor"], ...(rep.by_channel || []).map((c) => [c.channel, c.count, c.total, c.profit])];
    const ws = XLSX.utils.aoa_to_sheet([...header, ...rows, ...summary, ...perAccount, ...perChannel]);
    ws["!cols"] = [{ wch: 16 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 22 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Laporan Penjualan");
    XLSX.writeFile(wb, `Laporan-Penjualan-${start || "semua"}.xlsx`);
    toast.success("Laporan Excel diunduh");
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Laporan Penjualan", 14, 18);
    doc.setFontSize(10);
    doc.text(`Periode: ${periodLabel()}`, 14, 26);
    doc.text(`Total Omzet: Rp ${rep.total.toLocaleString("id-ID")}   |   Laba Kotor: Rp ${rep.profit.toLocaleString("id-ID")}   |   Transaksi: ${rep.count}`, 14, 32);
    autoTable(doc, {
      startY: 38,
      head: [["Invoice", "Metode", "Total", "Waktu"]],
      body: rep.sales.map((s) => [s.invoice, s.payment_method, `Rp ${s.total.toLocaleString("id-ID")}`, new Date(s.created_at).toLocaleString("id-ID")]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [37, 99, 235] },
    });
    doc.save(`Laporan-Penjualan-${start || "semua"}.pdf`);
    toast.success("Laporan PDF diunduh");
  };

  const refund = async (id) => {
    if (!window.confirm("Refund transaksi ini? Stok akan dikembalikan.")) return;
    try {
      await api.post(`/sales/${id}/refund`);
      toast.success("Refund berhasil");
      load();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    }
  };

  if (!rep) return <div className="text-muted-foreground">Memuat...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Analitik</p>
          <h1 className="font-display text-3xl font-bold tracking-tight">Laporan Penjualan</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={exportExcel} data-testid="export-excel-button">
            <FileSpreadsheet className="h-4 w-4" /> Excel
          </Button>
          <Button variant="outline" className="gap-2" onClick={exportPDF} data-testid="export-pdf-button">
            <FileText className="h-4 w-4" /> PDF
          </Button>
        </div>
      </div>

      <div className="space-y-3 rounded-lg border border-border bg-card p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Bulan</Label>
            <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="h-10 rounded-md border border-input bg-background px-3 text-sm" data-testid="report-month">
              {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Tahun</Label>
            <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="h-10 rounded-md border border-input bg-background px-3 text-sm" data-testid="report-year">
              {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <Button onClick={loadMonth} data-testid="report-month-button">Lihat Penjualan Bulan Ini</Button>
        </div>
        <div className="flex flex-wrap items-end gap-3 border-t border-border pt-3">
          <div className="space-y-1"><Label className="text-xs">Dari (custom)</Label><Input type="date" value={start} onChange={(e) => setStart(e.target.value)} data-testid="report-start" /></div>
          <div className="space-y-1"><Label className="text-xs">Sampai</Label><Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} data-testid="report-end" /></div>
          <Button variant="outline" onClick={load} data-testid="report-filter-button">Terapkan Rentang</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-5"><p className="text-xs uppercase tracking-widest text-muted-foreground">Total Omzet</p><p className="mt-2 font-display text-2xl font-bold">{rupiah(rep.total)}</p><p className="mt-1.5 text-[11px] leading-snug text-muted-foreground" data-testid="omzet-note">Total nilai penjualan (harga jual × qty) dari semua transaksi lunas pada periode ini. Belum dikurangi modal/biaya apa pun.</p></div>
        <div className="rounded-lg border border-border bg-card p-5"><p className="text-xs uppercase tracking-widest text-muted-foreground">Laba Kotor</p><p className="mt-2 font-display text-2xl font-bold text-emerald-600">{rupiah(rep.profit)}</p><p className="mt-1.5 text-[11px] leading-snug text-muted-foreground" data-testid="laba-kotor-note">Omzet − HPP (modal barang terjual = harga modal × qty). Belum termasuk pengeluaran operasional & pendapatan lain-lain.</p></div>
        <div className="rounded-lg border border-border bg-card p-5"><p className="text-xs uppercase tracking-widest text-muted-foreground">Jumlah Transaksi</p><p className="mt-2 font-display text-2xl font-bold">{rep.count}</p></div>
      </div>

      <div className="rounded-lg border border-border bg-card p-6" data-testid="account-summary-section">
        <div className="mb-4 flex items-center gap-2">
          <Landmark className="h-5 w-5 text-primary" />
          <h3 className="font-display text-lg font-semibold">Ringkasan Per Rekening / Metode</h3>
        </div>
        {rep.by_method.length === 0 ? (
          <p className="text-sm text-muted-foreground">Belum ada transaksi pada periode ini.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-sm">
              <thead className="text-xs uppercase text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="py-2 text-left font-medium">Rekening / Metode</th>
                  <th className="py-2 text-right font-medium">Transaksi</th>
                  <th className="py-2 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {sortMethods(rep.by_method).map((m) => {
                  const isBankRow = BANK_METHODS.includes(m.method);
                  return (
                    <tr key={m.method} className="border-b border-border/60" data-testid={`account-row-${m.method}`}>
                      <td className="py-2">
                        <span className="inline-flex items-center gap-2">
                          {isBankRow && <Landmark className="h-3.5 w-3.5 text-muted-foreground" />}
                          <span className={isBankRow ? "font-semibold" : ""}>{m.method}</span>
                        </span>
                      </td>
                      <td className="py-2 text-right text-muted-foreground">{m.count}x</td>
                      <td className="py-2 text-right font-semibold">{rupiah(m.total)}</td>
                    </tr>
                  );
                })}
                <tr className="border-t-2 border-border bg-secondary/30">
                  <td className="py-2 font-semibold">Total Transfer Bank</td>
                  <td className="py-2 text-right text-muted-foreground" data-testid="account-bank-count">{rep.by_method.filter((m) => BANK_METHODS.includes(m.method)).reduce((a, m) => a + m.count, 0)}x</td>
                  <td className="py-2 text-right font-bold text-primary" data-testid="account-bank-total">{rupiah(rep.by_method.filter((m) => BANK_METHODS.includes(m.method)).reduce((a, m) => a + m.total, 0))}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-border bg-card p-6" data-testid="channel-summary-section">
        <div className="mb-4 flex items-center gap-2">
          <Store className="h-5 w-5 text-primary" />
          <h3 className="font-display text-lg font-semibold">Ringkasan Per Sumber Penjualan</h3>
        </div>
        {!rep.by_channel || rep.by_channel.length === 0 ? (
          <p className="text-sm text-muted-foreground">Belum ada transaksi pada periode ini.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead className="text-xs uppercase text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="py-2 text-left font-medium">Sumber</th>
                  <th className="py-2 text-right font-medium">Transaksi</th>
                  <th className="py-2 text-right font-medium">Omzet</th>
                  <th className="py-2 text-right font-medium">Laba Kotor</th>
                </tr>
              </thead>
              <tbody>
                {rep.by_channel.map((c) => (
                  <tr key={c.channel} className="border-b border-border/60" data-testid={`channel-row-${c.channel}`}>
                    <td className="py-2"><span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold">{c.channel}</span></td>
                    <td className="py-2 text-right text-muted-foreground">{c.count}x</td>
                    <td className="py-2 text-right font-semibold">{rupiah(c.total)}</td>
                    <td className="py-2 text-right font-semibold text-emerald-600">{rupiah(c.profit)}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-border bg-secondary/30">
                  <td className="py-2 font-semibold">Total</td>
                  <td className="py-2 text-right text-muted-foreground">{rep.by_channel.reduce((a, c) => a + c.count, 0)}x</td>
                  <td className="py-2 text-right font-bold text-primary">{rupiah(rep.by_channel.reduce((a, c) => a + c.total, 0))}</td>
                  <td className="py-2 text-right font-bold text-emerald-600">{rupiah(rep.by_channel.reduce((a, c) => a + c.profit, 0))}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {pl && (
        <div className="rounded-lg border border-border bg-card p-6" data-testid="profit-loss-section">
          <div className="mb-4 flex items-center gap-2">
            <Scale className="h-5 w-5 text-primary" />
            <h3 className="font-display text-lg font-semibold">Laba Rugi {start && end ? `(${start} s/d ${end})` : "(Semua Periode)"}</h3>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between py-1">
              <span className="font-medium">Total Penjualan (Pemasukan)</span>
              <span className="font-semibold text-emerald-600" data-testid="pl-revenue">{rupiah(pl.revenue)}</span>
            </div>
            {pl.other_income_total > 0 && (
              <div className="rounded-md bg-emerald-500/5 p-3">
                <div className="mb-1 flex items-center justify-between text-xs uppercase tracking-wider text-muted-foreground">
                  <span>Pendapatan Lain-lain</span>
                  <span data-testid="pl-other-income">Total: {rupiah(pl.other_income_total)}</span>
                </div>
                {pl.other_income_by_category.map((e) => (
                  <div key={e.category} className="flex items-center justify-between py-0.5">
                    <span className="text-muted-foreground">{e.category}</span>
                    <span className="text-emerald-600">+ {rupiah(e.amount)}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="rounded-md bg-secondary/40 p-3">
              <div className="mb-1 flex items-center justify-between text-xs uppercase tracking-wider text-muted-foreground">
                <span>Pengeluaran per Kategori</span>
                <span>Total: {rupiah(pl.expense_total)}</span>
              </div>
              {pl.expenses_by_category.length === 0 ? (
                <p className="py-1 text-xs text-muted-foreground">Belum ada pengeluaran pada periode ini.</p>
              ) : (
                pl.expenses_by_category.map((e) => (
                  <div key={e.category} className="flex items-center justify-between py-0.5">
                    <span className="text-muted-foreground">{e.category}</span>
                    <span className="text-destructive">- {rupiah(e.amount)}</span>
                  </div>
                ))
              )}
            </div>
            <div className="flex items-center justify-between border-t border-border pt-3">
              <span className="font-display text-base font-bold">Laba Bersih</span>
              <span className={`font-display text-xl font-bold ${pl.net_profit >= 0 ? "text-emerald-600" : "text-destructive"}`} data-testid="pl-net-profit">{rupiah(pl.net_profit)}</span>
            </div>
            <p className="text-[11px] text-muted-foreground">Laba Bersih = Laba Kotor (Penjualan − HPP) + Pendapatan Lain-lain − Pengeluaran. Referensi: Modal barang terjual (HPP) {rupiah(pl.hpp)}, Laba Kotor {rupiah(pl.gross_profit)}. Catatan: pembelian/restok tidak mengurangi laba di sini — lihat Arus Kas.</p>
          </div>
        </div>
      )}

      {cash && (
        <div className="rounded-lg border border-border bg-card p-6" data-testid="cash-flow-section">
          <div className="mb-1 flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            <h3 className="font-display text-lg font-semibold">Arus Kas {start && end ? `(${start} s/d ${end})` : "(Semua Periode)"}</h3>
          </div>
          <p className="mb-4 text-[11px] text-muted-foreground">Uang yang benar-benar masuk vs keluar. Berbeda dari Laba Rugi — di sini <b>pembelian/restok (PO diterima)</b> dihitung sebagai uang keluar.</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-md bg-emerald-500/5 p-3">
              <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-600"><ArrowDownRight className="h-4 w-4" /> Kas Masuk</div>
              <div className="flex items-center justify-between py-0.5 text-sm"><span className="text-muted-foreground">Penjualan</span><span className="text-emerald-600" data-testid="cash-in-sales">+ {rupiah(cash.inflow.sales)}</span></div>
              <div className="flex items-center justify-between py-0.5 text-sm"><span className="text-muted-foreground">Pendapatan Lain-lain</span><span className="text-emerald-600">+ {rupiah(cash.inflow.other_income)}</span></div>
              <div className="mt-1 flex items-center justify-between border-t border-emerald-500/20 pt-1 text-sm font-bold"><span>Total Masuk</span><span className="text-emerald-600" data-testid="cash-in-total">{rupiah(cash.inflow.total)}</span></div>
            </div>
            <div className="rounded-md bg-destructive/5 p-3">
              <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-destructive"><ArrowUpRight className="h-4 w-4" /> Kas Keluar</div>
              <div className="flex items-center justify-between py-0.5 text-sm"><span className="text-muted-foreground">Pembelian / Restok</span><span className="text-destructive" data-testid="cash-out-purchases">- {rupiah(cash.outflow.purchases)}</span></div>
              <div className="flex items-center justify-between py-0.5 text-sm"><span className="text-muted-foreground">Pengeluaran</span><span className="text-destructive">- {rupiah(cash.outflow.expenses)}</span></div>
              <div className="mt-1 flex items-center justify-between border-t border-destructive/20 pt-1 text-sm font-bold"><span>Total Keluar</span><span className="text-destructive" data-testid="cash-out-total">{rupiah(cash.outflow.total)}</span></div>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
            <span className="font-display text-base font-bold">Arus Kas Bersih</span>
            <span className={`font-display text-xl font-bold ${cash.net_cash >= 0 ? "text-emerald-600" : "text-destructive"}`} data-testid="cash-net">{rupiah(cash.net_cash)}</span>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">Arus Kas Bersih = Kas Masuk − Kas Keluar. Pembelian dihitung dari PO berstatus "Diterima".</p>
        </div>
      )}

      <div className="rounded-lg border border-border bg-card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display font-semibold">Tren Omzet Bulanan {year}</h3>
          <span className="text-xs text-muted-foreground">Total setahun: {rupiah(trendData.reduce((a, m) => a + m.total, 0))}</span>
        </div>
        <div className="h-72" data-testid="yearly-trend-chart">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={trendData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={70} tickFormatter={(v) => v >= 1000000 ? `${(v / 1000000).toFixed(1)}jt` : v >= 1000 ? `${Math.round(v / 1000)}rb` : v} />
              <Tooltip formatter={(v) => rupiah(v)} cursor={{ fill: "hsl(var(--secondary))" }} contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
              <Bar dataKey="total" name="Omzet" fill="#2563EB" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display font-semibold">Tren Laba Bersih &amp; Pengeluaran {year}</h3>
          <span className="text-xs text-muted-foreground">Laba Bersih setahun: {rupiah(trendData.reduce((a, m) => a + (m.net || 0), 0))}</span>
        </div>
        <div className="h-72" data-testid="net-profit-trend-chart">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={trendData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={70} tickFormatter={(v) => Math.abs(v) >= 1000000 ? `${(v / 1000000).toFixed(1)}jt` : Math.abs(v) >= 1000 ? `${Math.round(v / 1000)}rb` : v} />
              <Tooltip formatter={(v, name) => [rupiah(v), name]} cursor={{ fill: "hsl(var(--secondary))" }} contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="net" name="Laba Bersih" fill="#10B981" radius={[6, 6, 0, 0]} />
              <Bar dataKey="expense" name="Pengeluaran" fill="#EF4444" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">Laba Bersih = Total Penjualan + Pendapatan Lain-lain − Total Pengeluaran per bulan.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-5">
          <h3 className="font-display font-semibold">Metode Pembayaran</h3>
          <div className="mt-2 h-56">
            {rep.by_method.length === 0 ? <p className="text-sm text-muted-foreground">Belum ada data.</p> : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={rep.by_method} dataKey="total" nameKey="method" cx="50%" cy="50%" outerRadius={70} label={(e) => e.method}>
                    {rep.by_method.map((_, i) => <Cell key={i} fill={PIE[i % PIE.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v) => rupiah(v)} contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-5 lg:col-span-2">
          <h3 className="mb-3 font-display font-semibold">Riwayat Transaksi</h3>
          <div className="max-h-[50vh] overflow-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="sticky top-0 bg-card text-xs uppercase text-muted-foreground">
                <tr><th className="py-2 text-left">Invoice</th><th className="py-2 text-left">Metode</th><th className="py-2 text-right">Total</th><th className="py-2 text-right">Waktu</th><th></th></tr>
              </thead>
              <tbody>
                {rep.sales.map((s) => (
                  <tr key={s.id} className="cursor-pointer border-t border-border transition-colors hover:bg-secondary/50" data-testid={`sale-row-${s.id}`} onClick={() => setDetailSale(s)}>
                    <td className="py-2 font-medium">{s.invoice}</td>
                    <td className="py-2 text-muted-foreground">{s.payment_method}</td>
                    <td className="py-2 text-right font-semibold">{rupiah(s.total)}</td>
                    <td className="py-2 text-right text-xs text-muted-foreground">{new Date(s.created_at).toLocaleString("id-ID")}</td>
                    <td className="py-2 text-right">
                      {canRefund && !s.refunded && (
                        <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); refund(s.id); }} data-testid={`refund-${s.id}`} title="Refund"><Undo2 className="h-4 w-4 text-destructive" /></Button>
                      )}
                      {s.refunded && <span className="text-xs text-destructive">Refunded</span>}
                    </td>
                  </tr>
                ))}
                {rep.sales.length === 0 && <tr><td colSpan={5} className="py-8 text-center text-muted-foreground">Belum ada transaksi.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Dialog open={!!detailSale} onOpenChange={(o) => { if (!o) { setDetailSale(null); setTimeout(() => { document.body.style.pointerEvents = ""; }, 100); } }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg" data-testid="sale-detail-dialog">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <Receipt className="h-5 w-5 text-primary" /> Detail Transaksi
            </DialogTitle>
          </DialogHeader>
          {detailSale && (
            <div className="space-y-4 text-sm" data-testid="sale-detail-content">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-display text-lg font-bold">{detailSale.invoice}</p>
                  <p className="text-xs text-muted-foreground">{new Date(detailSale.created_at).toLocaleString("id-ID")}</p>
                </div>
                {detailSale.refunded
                  ? <span className="rounded-full bg-destructive/10 px-3 py-1 text-xs font-semibold text-destructive">Refunded</span>
                  : <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600">Lunas</span>}
              </div>

              <div className="grid grid-cols-2 gap-2 rounded-md bg-secondary/40 p-3 text-xs">
                <div><span className="text-muted-foreground">Kasir</span><p className="font-medium">{detailSale.cashier || "-"}</p></div>
                <div><span className="text-muted-foreground">Metode</span><p className="font-medium">{detailSale.payment_method}</p></div>
                <div><span className="text-muted-foreground">Sumber</span><p className="font-medium">{detailSale.channel || "Toko"}</p></div>
                <div><span className="text-muted-foreground">Pelanggan</span><p className="font-medium">{detailSale.customer_name || "Umum"}</p></div>
                <div><span className="text-muted-foreground">No. HP</span><p className="font-medium">{detailSale.customer_phone || "-"}</p></div>
              </div>

              <div className="overflow-hidden rounded-md border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-secondary/60 text-xs uppercase text-muted-foreground">
                    <tr><th className="px-3 py-2 text-left">Item</th><th className="px-3 py-2 text-center">Qty</th><th className="px-3 py-2 text-right">Harga</th><th className="px-3 py-2 text-right">Subtotal</th></tr>
                  </thead>
                  <tbody>
                    {(detailSale.items || []).map((it, idx) => (
                      <tr key={idx} className="border-t border-border" data-testid={`sale-detail-item-${idx}`}>
                        <td className="px-3 py-2">
                          <p className="font-medium">{it.name}</p>
                          {it.note && <p className="text-xs text-muted-foreground">{it.note}</p>}
                        </td>
                        <td className="px-3 py-2 text-center">{it.qty}</td>
                        <td className="px-3 py-2 text-right">{rupiah(it.price)}</td>
                        <td className="px-3 py-2 text-right font-semibold">{rupiah((it.price || 0) * (it.qty || 0))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{rupiah(detailSale.subtotal || 0)}</span></div>
                {(detailSale.discount || 0) > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Diskon</span><span className="text-destructive">- {rupiah(detailSale.discount)}</span></div>}
                {(detailSale.tax || 0) > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Pajak ({detailSale.tax_rate || 0}%)</span><span>{rupiah(detailSale.tax)}</span></div>}
                <div className="flex justify-between border-t border-border pt-2 text-base font-bold"><span>Total</span><span data-testid="sale-detail-total">{rupiah(detailSale.total)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Dibayar</span><span>{rupiah(detailSale.paid_amount || 0)}</span></div>
                {(detailSale.change || 0) > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Kembalian</span><span>{rupiah(detailSale.change)}</span></div>}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={reprint} disabled={printing} className="w-full gap-2" data-testid="reprint-receipt-button">
              <Printer className="h-4 w-4" /> {printing ? "Mencetak..." : "Cetak Ulang Struk"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
