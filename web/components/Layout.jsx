import { useState, useEffect } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import api, { formatApiError } from "@/lib/api";
import { restorePrinterConnection } from "@/lib/printer";
import { toast } from "sonner";
import {
  LayoutDashboard, Package, Tags, Warehouse, BarChart3, Users as UsersIcon,
  Settings as SettingsIcon, ShoppingCart, Sun, Moon, LogOut, Menu, X, Store,
  UserCircle, Truck, ClipboardList, ShoppingBag, KeyRound, Wallet, DownloadCloud, HandCoins, ReceiptText, Images,
} from "lucide-react";

const NAV = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard, roles: ["Owner", "Manager", "Kasir", "Gudang"], end: true },
  { to: "/app/produk", label: "Produk", icon: Package, roles: ["Owner", "Manager", "Gudang"] },
  { to: "/app/kategori", label: "Kategori", icon: Tags, roles: ["Owner", "Manager", "Gudang"] },
  { to: "/app/inventory", label: "Inventory", icon: Warehouse, roles: ["Owner", "Manager", "Gudang"] },
  { to: "/app/pelanggan", label: "Pelanggan", icon: UserCircle, roles: ["Owner", "Manager", "Kasir"] },
  { to: "/app/pesanan", label: "Pesanan", icon: ShoppingBag, roles: ["Owner", "Manager", "Kasir"] },
  { to: "/app/riwayat", label: "Riwayat Transaksi", icon: ReceiptText, roles: ["Owner", "Manager", "Kasir"] },
  { to: "/app/supplier", label: "Supplier", icon: Truck, roles: ["Owner", "Manager", "Gudang"] },
  { to: "/app/pembelian", label: "Pembelian", icon: ClipboardList, roles: ["Owner", "Manager", "Gudang"] },
  { to: "/app/pengeluaran", label: "Pengeluaran", icon: Wallet, roles: ["Owner", "Manager"] },
  { to: "/app/pendapatan-lain", label: "Pendapatan Lain-lain", icon: HandCoins, roles: ["Owner", "Manager"] },
  { to: "/app/laporan", label: "Laporan", icon: BarChart3, roles: ["Owner", "Manager"] },
  { to: "/app/ekspor", label: "Ekspor Data", icon: DownloadCloud, roles: ["Owner"] },
  { to: "/app/galeri-web", label: "Galeri Website", icon: Images, roles: ["Owner", "Manager"] },
  { to: "/app/pengguna", label: "Pengguna", icon: UsersIcon, roles: ["Owner", "Manager"] },
  { to: "/app/pengaturan", label: "Pengaturan", icon: SettingsIcon, roles: ["Owner", "Manager", "Kasir"] },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [pw, setPw] = useState({ current_password: "", new_password: "", confirm: "" });
  const [pwLoading, setPwLoading] = useState(false);
  const items = NAV.filter((n) => n.roles.includes(user?.role));

  // Restore a previously-connected Bluetooth printer on ANY page/refresh so the
  // link stays alive for cashiers regardless of the landing route.
  useEffect(() => { restorePrinterConnection().catch(() => {}); }, []);

  const changePassword = async () => {
    if (pw.new_password !== pw.confirm) return toast.error("Konfirmasi password tidak cocok");
    if (pw.new_password.length < 6) return toast.error("Password baru minimal 6 karakter");
    setPwLoading(true);
    try {
      await api.post("/auth/change-password", { current_password: pw.current_password, new_password: pw.new_password });
      toast.success("Password berhasil diubah");
      setPwOpen(false);
      setPw({ current_password: "", new_password: "", confirm: "" });
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    } finally {
      setPwLoading(false);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside
        className={`fixed z-40 h-full w-64 shrink-0 border-r border-border bg-card transition-transform duration-300 lg:static lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        data-testid="sidebar"
      >
        <div className="flex h-16 items-center gap-2 border-b border-border px-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-neutral-900 p-1">
            <img src="/logo.png" alt="Daneswara POS" className="h-full w-full object-contain" />
          </div>
          <span className="font-display text-lg font-bold tracking-tight">Daneswara POS</span>
        </div>
        <nav className="flex flex-col gap-1 p-4">
          {items.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              onClick={() => setOpen(false)}
              data-testid={`nav-${n.label.toLowerCase()}`}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors duration-200 ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`
              }
            >
              <n.icon className="h-4.5 w-4.5" style={{ width: 18, height: 18 }} />
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="absolute bottom-0 w-full border-t border-border p-4">
          <Button
            onClick={() => navigate("/pos")}
            className="w-full gap-2 font-semibold"
            data-testid="open-pos-button"
          >
            <ShoppingCart className="h-4 w-4" /> Buka Kasir POS
          </Button>
        </div>
      </aside>

      {open && (
        <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setOpen(false)} />
      )}

      {/* Main */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-16 items-center justify-between border-b border-border bg-card/80 px-4 backdrop-blur-xl lg:px-8">
          <div className="flex items-center gap-3">
            <button className="lg:hidden" onClick={() => setOpen(!open)} data-testid="menu-toggle">
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Selamat datang</p>
              <p className="font-display text-sm font-semibold">{user?.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground sm:inline-block">
              {user?.role}
            </span>
            <Button variant="ghost" size="icon" onClick={toggle} data-testid="theme-toggle">
              {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setPwOpen(true)} data-testid="change-password-button" title="Ubah Password">
              <KeyRound className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={logout} data-testid="logout-button">
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 lg:p-8">
          <Outlet />
        </main>
      </div>

      <Dialog open={pwOpen} onOpenChange={setPwOpen}>
        <DialogContent data-testid="change-password-dialog">
          <DialogHeader><DialogTitle>Ubah Password</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Password Lama</Label>
              <Input type="password" value={pw.current_password} onChange={(e) => setPw({ ...pw, current_password: e.target.value })} data-testid="current-password-input" />
            </div>
            <div className="space-y-1">
              <Label>Password Baru</Label>
              <Input type="password" value={pw.new_password} onChange={(e) => setPw({ ...pw, new_password: e.target.value })} data-testid="new-password-input" />
            </div>
            <div className="space-y-1">
              <Label>Konfirmasi Password Baru</Label>
              <Input type="password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} data-testid="confirm-password-input" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPwOpen(false)}>Batal</Button>
            <Button onClick={changePassword} disabled={pwLoading} data-testid="submit-change-password">
              {pwLoading ? "Menyimpan..." : "Simpan Password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
