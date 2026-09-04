import { useEffect, useState } from "react";
import api, { formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ViewToggle, useViewMode } from "@/components/ViewToggle";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Truck, Search } from "lucide-react";

const EMPTY = { name: "", phone: "", email: "", address: "" };

export default function Suppliers() {
  const [list, setList] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [q, setQ] = useState("");
  const [view, setView] = useViewMode("view-suppliers", "besar");

  const load = () => { api.get("/suppliers").then((r) => setList(r.data)); };
  useEffect(load, []);

  const save = async () => {
    if (!form.name) return toast.error("Nama wajib diisi");
    try {
      if (editId) await api.put(`/suppliers/${editId}`, form);
      else await api.post("/suppliers", form);
      toast.success("Supplier disimpan");
      setOpen(false); load();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
  };
  const del = async (id) => { if (!window.confirm("Hapus supplier?")) return; await api.delete(`/suppliers/${id}`); load(); };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Pembelian</p>
          <h1 className="font-display text-3xl font-bold tracking-tight">Supplier</h1>
        </div>
        <Button onClick={() => { setForm(EMPTY); setEditId(null); setOpen(true); }} className="gap-2" data-testid="add-supplier-button"><Plus className="h-4 w-4" /> Tambah</Button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari supplier atau telepon..." className="pl-10" data-testid="supplier-search" />
        </div>
        <ViewToggle mode={view} onChange={setView} />
      </div>

      <div className={
        view === "list" ? "space-y-2"
        : view === "kecil" ? "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
        : "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
      } data-testid="supplier-list">
        {list.filter((s) => `${s.name} ${s.phone || ""}`.toLowerCase().includes(q.trim().toLowerCase())).map((s) => (
          view === "list" ? (
            <div key={s.id} className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-2.5" data-testid={`supplier-${s.id}`}>
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-secondary"><Truck className="h-4 w-4" /></div>
                <div className="min-w-0"><p className="truncate font-medium">{s.name}</p><p className="truncate text-xs text-muted-foreground">{s.phone || "—"}{s.address ? ` · ${s.address}` : ""}</p></div>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button variant="ghost" size="icon" onClick={() => { setForm(s); setEditId(s.id); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => del(s.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            </div>
          ) : (
          <div key={s.id} className={`rounded-lg border border-border bg-card ${view === "kecil" ? "p-3" : "p-4"}`} data-testid={`supplier-${s.id}`}>
            <div className="flex items-start justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <div className={`flex shrink-0 items-center justify-center rounded-md bg-secondary ${view === "kecil" ? "h-8 w-8" : "h-10 w-10"}`}><Truck className={view === "kecil" ? "h-4 w-4" : "h-5 w-5"} /></div>
                <div className="min-w-0"><p className="truncate font-semibold">{s.name}</p><p className="truncate text-xs text-muted-foreground">{s.phone || "—"}</p></div>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button variant="ghost" size="icon" onClick={() => { setForm(s); setEditId(s.id); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => del(s.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            </div>
            {s.address && view !== "kecil" && <p className="mt-2 text-xs text-muted-foreground">{s.address}</p>}
          </div>
          )
        ))}
        {list.length === 0 && <p className="text-sm text-muted-foreground">Belum ada supplier.</p>}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent data-testid="supplier-dialog">
          <DialogHeader><DialogTitle className="font-display">{editId ? "Edit" : "Tambah"} Supplier</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>Nama</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="supplier-name-input" /></div>
            <div className="space-y-1"><Label>Telepon</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div className="space-y-1"><Label>Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div className="space-y-1"><Label>Alamat</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
          </div>
          <DialogFooter><Button onClick={save} className="w-full" data-testid="save-supplier-button">Simpan</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
