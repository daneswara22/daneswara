import { useEffect, useState } from "react";
import api, { rupiah, formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { NumberInput } from "@/components/NumberInput";
import { CategoryManager } from "@/components/CategoryManager";
import { VoucherDialog } from "@/components/VoucherDialog";
import { toast } from "sonner";
import { Plus, Trash2, Wallet, Receipt, Search, Tags, Printer } from "lucide-react";

const today = () => new Date().toISOString().slice(0, 10);
const EMPTY = { category: "", amount: "", note: "", date: today() };

export default function Expenses() {
  const [list, setList] = useState([]);
  const [cats, setCats] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState("");
  const [manageOpen, setManageOpen] = useState(false);
  const [settings, setSettings] = useState({});
  const [voucherTrx, setVoucherTrx] = useState(null);

  const loadCats = () => api.get("/expense-categories").then((r) => setCats(r.data));
  const load = () => { api.get("/expenses").then((r) => setList(r.data)); };
  useEffect(() => {
    load();
    loadCats();
    api.get("/settings").then((r) => setSettings(r.data)).catch(() => {});
  }, []);

  const term = q.trim().toLowerCase();
  const filtered = term
    ? list.filter((e) => `${e.category} ${e.note || ""} ${e.date}`.toLowerCase().includes(term))
    : list;
  const total = filtered.reduce((a, e) => a + e.amount, 0);

  const save = async () => {
    if (!form.category) return toast.error("Pilih kategori");
    if (!form.amount || Number(form.amount) <= 0) return toast.error("Isi nominal");
    setSaving(true);
    try {
      await api.post("/expenses", { category: form.category, amount: Number(form.amount), note: form.note, date: form.date });
      toast.success("Pengeluaran dicatat");
      setOpen(false); setForm(EMPTY); load();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    } finally { setSaving(false); }
  };

  const del = async (id) => {
    await api.delete(`/expenses/${id}`);
    toast.success("Pengeluaran dihapus");
    load();
  };

  const printReport = () => {
    const rows = [...filtered].sort((a, b) => (a.date < b.date ? 1 : -1));
    if (rows.length === 0) return toast.error("Tidak ada data untuk dicetak");
    const fmt = (n) => "Rp" + Number(n || 0).toLocaleString("id-ID");
    const byCat = {};
    rows.forEach((e) => { byCat[e.category] = (byCat[e.category] || 0) + e.amount; });
    const dates = rows.map((r) => r.date).sort();
    const periode = dates.length ? (dates[0] === dates[dates.length - 1] ? dates[0] : `${dates[0]} s/d ${dates[dates.length - 1]}`) : "-";
    const biz = settings.business_name || "Daneswara POS";
    const logo = settings.logo || "/logo.png";
    const now = new Date().toLocaleString("id-ID");
    const rowsHtml = rows.map((e, i) => `
      <tr>
        <td style="text-align:center">${i + 1}</td>
        <td>${e.date}</td>
        <td>${e.category}</td>
        <td>${(e.note || "-").replace(/</g, "&lt;")}</td>
        <td style="text-align:right">${fmt(e.amount)}</td>
      </tr>`).join("");
    const catHtml = Object.entries(byCat).sort((a, b) => b[1] - a[1]).map(([c, v]) => `
      <tr><td>${c}</td><td style="text-align:right">${fmt(v)}</td></tr>`).join("");
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Laporan Pengeluaran</title>
      <style>
        *{font-family:Arial,Helvetica,sans-serif;box-sizing:border-box}
        body{margin:24px;color:#15171c}
        .head{display:flex;align-items:center;gap:14px;border-bottom:2px solid #15171c;padding-bottom:12px;margin-bottom:16px}
        .head img{width:56px;height:56px;object-fit:contain}
        .head h1{margin:0;font-size:20px}
        .head p{margin:2px 0 0;font-size:12px;color:#555}
        h2{font-size:15px;margin:18px 0 8px}
        table{width:100%;border-collapse:collapse;font-size:12px}
        th,td{border:1px solid #ccc;padding:6px 8px}
        th{background:#f2f2f2;text-align:left}
        .total{font-size:15px;font-weight:bold;text-align:right;margin-top:8px}
        .sum{width:60%;margin-top:6px}
        .meta{font-size:12px;color:#555;margin-bottom:10px}
        @media print{body{margin:12mm}}
      </style></head><body>
      <div class="head">
        <img src="${logo}" onerror="this.style.display='none'"/>
        <div><h1>${biz}</h1><p>Laporan Pengeluaran</p></div>
      </div>
      <div class="meta">Periode: <b>${periode}</b> &nbsp;·&nbsp; Dicetak: ${now} &nbsp;·&nbsp; Jumlah catatan: ${rows.length}${term ? ` &nbsp;·&nbsp; Filter: "${term}"` : ""}</div>
      <table>
        <thead><tr><th style="width:32px;text-align:center">No</th><th style="width:90px">Tanggal</th><th>Kategori</th><th>Catatan</th><th style="width:120px;text-align:right">Nominal</th></tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
      <div class="total">Total Pengeluaran: ${fmt(total)}</div>
      <h2>Ringkasan per Kategori</h2>
      <table class="sum"><thead><tr><th>Kategori</th><th style="text-align:right;width:140px">Total</th></tr></thead><tbody>${catHtml}
        <tr><td style="font-weight:bold">TOTAL</td><td style="text-align:right;font-weight:bold">${fmt(total)}</td></tr></tbody></table>
      <script>window.onload=function(){setTimeout(function(){window.print();},300);}</script>
      </body></html>`;
    const w = window.open("", "_blank");
    if (!w) return toast.error("Popup diblokir browser. Izinkan popup untuk mencetak.");
    w.document.open(); w.document.write(html); w.document.close();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Keuangan</p>
          <h1 className="font-display text-3xl font-bold tracking-tight">Pengeluaran</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={printReport} className="gap-2" data-testid="print-expenses-button">
            <Printer className="h-4 w-4" /> Cetak
          </Button>
          <Button variant="outline" onClick={() => setManageOpen(true)} className="gap-2" data-testid="manage-expense-categories-button">
            <Tags className="h-4 w-4" /> Kelola Jenis
          </Button>
          <Button onClick={() => { setForm(EMPTY); setOpen(true); }} className="gap-2" data-testid="add-expense-button">
            <Plus className="h-4 w-4" /> Tambah Pengeluaran
          </Button>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari kategori, catatan, atau tanggal..." className="pl-10" data-testid="expense-search" />
      </div>

      <div className="rounded-lg border border-border bg-card p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-md bg-destructive/10 text-destructive"><Wallet className="h-5 w-5" /></div>
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Total Pengeluaran ({list.length} catatan)</p>
            <p className="font-display text-2xl font-bold" data-testid="expense-total">{rupiah(total)}</p>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Tanggal</th>
              <th className="px-4 py-3">Kategori</th>
              <th className="px-4 py-3">Catatan</th>
              <th className="px-4 py-3 text-right">Nominal</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {list.map((e) => (
              <tr key={e.id} className="border-t border-border" data-testid={`expense-${e.id}`}>
                <td className="px-4 py-3 whitespace-nowrap">{e.date}</td>
                <td className="px-4 py-3"><span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium">{e.category}</span></td>
                <td className="px-4 py-3 text-muted-foreground">{e.note || "-"}</td>
                <td className="px-4 py-3 text-right font-semibold">{rupiah(e.amount)}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-3">
                    <button onClick={() => setVoucherTrx(e)} className="text-muted-foreground hover:text-foreground" title="Cetak / Buat gambar bukti" data-testid={`print-expense-${e.id}`}><Printer className="h-4 w-4" /></button>
                    <button onClick={() => del(e.id)} className="text-destructive" data-testid={`delete-expense-${e.id}`}><Trash2 className="h-4 w-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">{term ? "Tidak ada pengeluaran cocok." : "Belum ada pengeluaran."}</td></tr>}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent data-testid="expense-dialog">
          <DialogHeader><DialogTitle>Tambah Pengeluaran</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label>Kategori / Jenis <span className="text-destructive">*</span></Label>
                <button type="button" onClick={() => setManageOpen(true)} className="text-xs font-medium text-primary hover:underline" data-testid="expense-add-category-link">+ Tambah jenis baru</button>
              </div>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger data-testid="expense-category-select"><SelectValue placeholder="Pilih kategori" /></SelectTrigger>
                <SelectContent>
                  {cats.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1"><Label>Nominal (Rp) <span className="text-destructive">*</span></Label><NumberInput value={form.amount} onValueChange={(v) => setForm({ ...form, amount: v })} data-testid="expense-amount-input" /></div>
              <div className="space-y-1"><Label>Tanggal <span className="text-destructive">*</span></Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} data-testid="expense-date-input" /></div>
            </div>
            <div className="space-y-1"><Label>Catatan (opsional)</Label><Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="cth: Beli tinta DTF 1L" data-testid="expense-note-input" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
            <Button onClick={save} disabled={saving} data-testid="save-expense-button">{saving ? "Menyimpan..." : "Simpan"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CategoryManager open={manageOpen} onOpenChange={setManageOpen} type="expense" onChanged={loadCats} />
      <VoucherDialog trx={voucherTrx} kind="expense" settings={settings} onClose={() => setVoucherTrx(null)} />
    </div>
  );
}
