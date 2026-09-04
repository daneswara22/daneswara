import { useEffect, useState } from "react";
import api, { formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, UserCog, Search } from "lucide-react";

const ROLES = ["Owner", "Manager", "Kasir", "Gudang"];
const roleTint = {
  Owner: "bg-violet-500/15 text-violet-600",
  Manager: "bg-blue-500/15 text-blue-600",
  Kasir: "bg-emerald-500/15 text-emerald-600",
  Gudang: "bg-orange-500/15 text-orange-600",
};

export default function Users() {
  const { user } = useAuth();
  const isOwner = user?.role === "Owner";
  const [users, setUsers] = useState([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ username: "", password: "", name: "", role: "Kasir", active: true });
  const [editId, setEditId] = useState(null);

  const load = () => { api.get("/users").then((r) => setUsers(r.data)); };
  useEffect(load, []);

  const openNew = () => { setForm({ username: "", password: "", name: "", role: "Kasir", active: true }); setEditId(null); setOpen(true); };
  const openEdit = (u) => { setForm({ ...u, password: "" }); setEditId(u.id); setOpen(true); };

  const save = async () => {
    try {
      if (editId) {
        const payload = { name: form.name, role: form.role, active: form.active };
        if (form.password) payload.password = form.password;
        await api.put(`/users/${editId}`, payload);
      } else {
        if (!form.username || !form.password || !form.name) return toast.error("Lengkapi semua data");
        await api.post("/users", { username: form.username, password: form.password, name: form.name, role: form.role });
      }
      toast.success("Pengguna disimpan");
      setOpen(false);
      load();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    }
  };

  const del = async (id) => {
    if (!window.confirm("Hapus pengguna ini?")) return;
    try {
      await api.delete(`/users/${id}`);
      load();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    }
  };

  const term = q.trim().toLowerCase();
  const filtered = term
    ? users.filter((u) => `${u.name} ${u.username} ${u.role}`.toLowerCase().includes(term))
    : users;


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Karyawan & Hak Akses</p>
          <h1 className="font-display text-3xl font-bold tracking-tight">Pengguna</h1>
        </div>
        <Button onClick={openNew} className="gap-2" data-testid="add-user-button"><Plus className="h-4 w-4" /> Tambah Pengguna</Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama, username, atau peran..." className="pl-10" data-testid="user-search" />
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-secondary text-xs uppercase text-muted-foreground">
            <tr><th className="px-4 py-3 text-left">Nama</th><th className="px-4 py-3 text-left">Username</th><th className="px-4 py-3 text-left">Peran</th><th className="px-4 py-3 text-left">Status</th><th></th></tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.id} className="border-t border-border" data-testid={`user-row-${u.id}`}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-md bg-secondary"><UserCog className="h-4 w-4" /></div>
                    <span className="font-medium">{u.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{u.username}</td>
                <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${roleTint[u.role]}`}>{u.role}</span></td>
                <td className="px-4 py-3">{u.active !== false ? <span className="text-emerald-600">Aktif</span> : <span className="text-muted-foreground">Nonaktif</span>}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(u)} data-testid={`edit-user-${u.id}`}><Pencil className="h-4 w-4" /></Button>
                    {isOwner && u.id !== user.id && <Button variant="ghost" size="icon" onClick={() => del(u.id)} data-testid={`delete-user-${u.id}`}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent data-testid="user-dialog">
          <DialogHeader><DialogTitle className="font-display">{editId ? "Edit Pengguna" : "Tambah Pengguna"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1"><Label>Nama Lengkap</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="user-name-input" /></div>
            {!editId && <div className="space-y-1"><Label>Username</Label><Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} data-testid="user-username-input" /></div>}
            <div className="space-y-1"><Label>{editId ? "Password baru (kosongkan jika tetap)" : "Password"}</Label><Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} data-testid="user-password-input" /></div>
            <div className="space-y-1">
              <Label>Peran</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger data-testid="user-role-select"><SelectValue /></SelectTrigger>
                <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {editId && <div className="flex items-center justify-between"><Label>Akun Aktif</Label><Switch checked={form.active !== false} onCheckedChange={(v) => setForm({ ...form, active: v })} data-testid="user-active-switch" /></div>}
          </div>
          <DialogFooter><Button onClick={save} className="w-full" data-testid="save-user-button">Simpan</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
