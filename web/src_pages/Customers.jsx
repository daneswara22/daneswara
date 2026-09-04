import { useEffect, useState } from "react";
import api, { rupiah, formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ViewToggle, useViewMode } from "@/components/ViewToggle";
import { NotaDialog } from "@/components/NotaDialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, History, User, Search, ChevronRight } from "lucide-react";

const EMPTY = { name: "", phone: "", email: "", address: "" };

export default function Customers() {
  const [list, setList] = useState([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [history, setHistory] = useState(null);
  const [nota, setNota] = useState(null);
  const [settings, setSettings] = useState({});
  const [view, setView] = useViewMode("view-customers", "besar");

  const load = () => { api.get("/customers").then((r) => setList(r.data)); };
  useEffect(() => {
    load();
    api.get("/settings").then((r) => setSettings(r.data || {}));
  }, []);

  const term = q.trim().toLowerCase();
  const filtered = term
    ? list.filter((c) => c.name.toLowerCase().includes(term) || (c.phone || "").toLowerCase().includes(term))
    : list;
  const shown = filtered.slice(0, 200);

  const save = async () => {
    if (!form.name) return toast.error("Nama wajib diisi");
    try {
      if (editId) await api.put(`/customers/${editId}`, form);
      else await api.post("/customers", form);
      toast.success("Pelanggan disimpan");
      setOpen(false); load();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
  };
  const del = async (id) => { if (!window.confirm("Hapus pelanggan?")) return; await api.delete(`/customers/${id}`); load(); };
  const showHistory = async (c) => {
    const { data } = await api.get(`/customers/${c.id}/history`);
    setHistory({ customer: c, sales: data });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Data Pelanggan</p>
          <h1 className="font-display text-3xl font-bold tracking-tight">Pelanggan</h1>
        </div>
        <Button onClick={() => { setForm(EMPTY); setEditId(null); setOpen(true); }} className="gap-2" data-testid="add-customer-button"><Plus className="h-4 w-4" /> Tambah</Button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama atau nomor telepon..." className="pl-10" data-testid="customer-search" />
        </div>
        <ViewToggle mode={view} onChange={setView} />
      </div>
      <p className="text-xs text-muted-foreground" data-testid="customer-count">
        {term ? `${filtered.length} hasil` : `${list.length} pelanggan`}{filtered.length > 200 ? " · menampilkan 200 teratas, persempit pencarian" : ""}
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((c) => (
          <div key={c.id} className="rounded-lg border border-border bg-card p-4" data-testid={`customer-${c.id}`}>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-accent text-accent-foreground"><User className="h-5 w-5" /></div>
                <div>
                  <p className="font-semibold">{c.name}</p>
                  <p className="text-xs text-muted-foreground">{c.phone || "—"}</p>
                </div>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" onClick={() => showHistory(c)} data-testid={`history-${c.id}`}><History className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => { setForm(c); setEditId(c.id); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => del(c.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between rounded-md bg-secondary px-3 py-2 text-sm">
              <span className="font-semibold">{rupiah(c.total_spent || 0)}</span>
              <span className="text-muted-foreground">{c.visits || 0}x transaksi</span>
            </div>
          </div>
        ))}
        {list.length === 0 && <p className="text-sm text-muted-foreground">Belum ada pelanggan.</p>}
        {list.length > 0 && filtered.length === 0 && <p className="text-sm text-muted-foreground">Tidak ada pelanggan cocok.</p>}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent data-testid="customer-dialog">
          <DialogHeader><DialogTitle className="font-display">{editId ? "Edit" : "Tambah"} Pelanggan</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>Nama</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="customer-name-input" /></div>
            <div className="space-y-1"><Label>Telepon</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} data-testid="customer-phone-input" /></div>
            <div className="space-y-1"><Label>Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div className="space-y-1"><Label>Alamat</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
          </div>
          <DialogFooter><Button onClick={save} className="w-full" data-testid="save-customer-button">Simpan</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!history} onOpenChange={() => setHistory(null)}>
        <DialogContent data-testid="customer-history-dialog">
          <DialogHeader><DialogTitle className="font-display">Riwayat — {history?.customer?.name}</DialogTitle></DialogHeader>
          <div className="max-h-[60vh] space-y-2 overflow-y-auto">
            {history?.sales?.length === 0 && <p className="text-sm text-muted-foreground">Belum ada pembelian.</p>}
            {history?.sales?.length > 0 && <p className="text-xs text-muted-foreground">Ketuk transaksi untuk melihat detail nota.</p>}
            {history?.sales?.map((s) => (
              <button
                key={s.id}
                onClick={() => setNota(s)}
                className="flex w-full items-center justify-between gap-2 rounded-md bg-secondary px-3 py-2 text-left text-sm transition-colors hover:bg-accent"
                data-testid={`history-item-${s.id}`}
              >
                <div><p className="font-medium">{s.invoice}</p><p className="text-xs text-muted-foreground">{new Date(s.created_at).toLocaleString("id-ID")}</p></div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{rupiah(s.total)}</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <NotaDialog nota={nota} onClose={() => setNota(null)} settings={settings} />
    </div>
  );
}
