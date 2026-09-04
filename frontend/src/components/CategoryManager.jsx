import { useEffect, useState } from "react";
import api, { formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Trash2, Lock } from "lucide-react";

// Manage (add/delete) expense/income categories. Adding a category never breaks
// the P&L — reports group entries by category name.
export function CategoryManager({ open, onOpenChange, type, onChanged }) {
  const [cats, setCats] = useState([]);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const label = type === "expense" ? "Jenis Pengeluaran" : "Kategori Pendapatan";

  const load = () => api.get("/finance-categories", { params: { type } }).then((r) => setCats(r.data));
  useEffect(() => { if (open) { load(); setName(""); } /* eslint-disable-next-line */ }, [open, type]);

  const add = async () => {
    if (!name.trim()) return toast.error("Isi nama kategori");
    setSaving(true);
    try {
      await api.post("/finance-categories", { name: name.trim(), type });
      toast.success("Kategori ditambahkan");
      setName(""); await load(); onChanged && onChanged();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
    finally { setSaving(false); }
  };
  const del = async (id) => {
    await api.delete(`/finance-categories/${id}`);
    toast.success("Kategori dihapus");
    await load(); onChanged && onChanged();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setTimeout(() => { document.body.style.pointerEvents = ""; }, 100); }}>
      <DialogContent data-testid="category-manager-dialog">
        <DialogHeader><DialogTitle className="font-display">Kelola {label}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="flex gap-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder={`Nama ${label.toLowerCase()} baru`} data-testid="new-category-input" />
            <Button onClick={add} disabled={saving} className="gap-1 shrink-0" data-testid="add-category-button"><Plus className="h-4 w-4" /> Tambah</Button>
          </div>
          <div className="max-h-[50vh] space-y-1.5 overflow-y-auto">
            {cats.map((c, i) => (
              <div key={c.id || `def-${i}`} className="flex items-center justify-between rounded-md bg-secondary px-3 py-2 text-sm" data-testid={`category-row-${c.id || "default"}`}>
                <span>{c.name}</span>
                {c.is_default ? (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground"><Lock className="h-3 w-3" /> Bawaan</span>
                ) : (
                  <button onClick={() => del(c.id)} className="text-destructive" data-testid={`delete-category-${c.id}`}><Trash2 className="h-4 w-4" /></button>
                )}
              </div>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">Kategori bawaan tidak bisa dihapus. Menambah kategori tidak mengganggu laporan Laba Rugi — data tetap terhitung berdasarkan nama kategori.</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
