import { useEffect, useState } from "react";
import api, { formatApiError, uploadImage } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Store, Save, Printer, Bluetooth, Trash2, AlertTriangle, Monitor, TestTube2, Plus, Pencil, Database, RefreshCw, PackageX } from "lucide-react";
import {
  connectBluetoothPrinter, disconnectPrinter, isPrinterConnected, getPrinterName,
  bluetoothSupported, printReceiptSmart, getDevicePrinterConfig, setDevicePrinterConfig,
  setPrinterStatusCallback, restorePrinterConnection,
} from "@/lib/printer";

export default function Settings() {
  const { user } = useAuth();
  const [form, setForm] = useState({ business_name: "", address: "", phone: "", currency: "Rp", tax_rate: 0, receipt_footer: "", print_mode: "desktop", paper_width: "58", printers: [], active_printer: "" });
  const [btName, setBtName] = useState(getPrinterName());
  const [btStatus, setBtStatus] = useState(isPrinterConnected() ? "connected" : "disconnected");
  const [connecting, setConnecting] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [catalogBusy, setCatalogBusy] = useState(false);
  const [stockBusy, setStockBusy] = useState(false);
  const [printerDialog, setPrinterDialog] = useState(false);
  const [editingPrinter, setEditingPrinter] = useState(null);
  const [pForm, setPForm] = useState({ name: "", connection: "desktop", paper_width: "80" });

  useEffect(() => {
    api.get("/settings").then((r) => {
      const dev = getDevicePrinterConfig();
      setForm((f) => ({
        ...f, ...r.data,
        // Printer fields come from THIS device (localStorage), not the account.
        print_mode: dev.print_mode || "desktop",
        paper_width: dev.paper_width || "58",
        printers: dev.printers || [],
        active_printer: dev.active_printer || "",
      }));
    });
    // eslint-disable-next-line
  }, []);

  // Reflect live Bluetooth status (auto-reconnect) + restore printer after reload.
  useEffect(() => {
    setPrinterStatusCallback((status, name) => {
      setBtStatus(status);
      if (status === "connected") setBtName(name || getPrinterName());
      if (status === "disconnected") setBtName("");
    });
    restorePrinterConnection().then((name) => {
      if (name) { setBtName(name); setBtStatus("connected"); }
    });
    return () => setPrinterStatusCallback(null);
  }, []);

  const openAddPrinter = () => { setEditingPrinter(null); setPForm({ name: "", connection: "desktop", paper_width: "80" }); setPrinterDialog(true); };
  const openEditPrinter = (p) => { setEditingPrinter(p.id); setPForm({ name: p.name, connection: p.connection, paper_width: p.paper_width }); setPrinterDialog(true); };
  const savePrinter = () => {
    if (!pForm.name.trim()) return toast.error("Nama printer wajib diisi");
    setForm((f) => {
      const list = [...(f.printers || [])];
      let next;
      if (editingPrinter) {
        next = list.map((x) => (x.id === editingPrinter ? { ...x, ...pForm, name: pForm.name.trim() } : x));
      } else {
        const id = (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now());
        next = [...list, { id, ...pForm, name: pForm.name.trim() }];
      }
      const patch = { ...f, printers: next };
      // auto-activate the first printer or the edited-active one
      const activeId = editingPrinter || (next.length === 1 ? next[next.length - 1].id : f.active_printer);
      const activeP = (next || []).find((x) => x.id === activeId);
      if (activeP) { patch.active_printer = activeP.id; patch.print_mode = activeP.connection; patch.paper_width = activeP.paper_width; }
      return patch;
    });
    setPrinterDialog(false);
    toast.success(editingPrinter ? "Printer diperbarui — klik Simpan untuk menyimpan" : "Printer ditambahkan — klik Simpan untuk menyimpan");
  };
  const activatePrinter = (p) => {
    setForm((f) => ({ ...f, active_printer: p.id, print_mode: p.connection, paper_width: p.paper_width }));
    toast.info(`Printer aktif: ${p.name} — klik Simpan untuk menyimpan`);
  };
  const deletePrinter = (id) => {
    setForm((f) => {
      const next = (f.printers || []).filter((x) => x.id !== id);
      const patch = { ...f, printers: next };
      if (f.active_printer === id) {
        const fallback = next[0];
        patch.active_printer = fallback ? fallback.id : "";
        if (fallback) { patch.print_mode = fallback.connection; patch.paper_width = fallback.paper_width; }
      }
      return patch;
    });
  };

  const save = async () => {
    // Printer config is saved to THIS device only (independent per device).
    setDevicePrinterConfig({ print_mode: form.print_mode, paper_width: form.paper_width, printers: form.printers, active_printer: form.active_printer });
    try {
      const canEditBusiness = user?.role === "Owner" || user?.role === "Manager";
      if (canEditBusiness) {
        await api.put("/settings", {
          business_name: form.business_name, address: form.address, phone: form.phone,
          currency: form.currency, tax_rate: Number(form.tax_rate), receipt_footer: form.receipt_footer,
          logo: form.logo,
        });
      }
      toast.success("Pengaturan printer disimpan di perangkat ini");
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    }
  };

  const connectBt = async () => {
    setConnecting(true);
    try {
      const name = await connectBluetoothPrinter();
      setBtName(name);
      setBtStatus("connected");
      toast.success(`Terhubung ke ${name}`);
    } catch (e) {
      if (e.name !== "NotFoundError") toast.error(e.message || "Gagal menghubungkan printer");
    } finally {
      setConnecting(false);
    }
  };

  const disconnectBt = () => { disconnectPrinter(); setBtName(""); setBtStatus("disconnected"); toast.info("Printer diputus"); };

  const handleLogo = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("File harus berupa gambar");
    try {
      const { url } = await uploadImage(file, "logo");
      setForm((f) => ({ ...f, logo: url }));
      toast.success("Logo struk diunggah");
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail) || "Upload gambar gagal");
    }
  };

  const testPrint = async () => {
    const sample = {
      invoice: "TEST-0001",
      created_at: new Date().toISOString(),
      cashier: user?.name || "Kasir",
      items: [
        { name: "Contoh Produk A", qty: 1, price: 25000 },
        { name: "Contoh Produk B", qty: 2, price: 15000 },
      ],
      subtotal: 55000, discount: 5000, tax_rate: 0, tax: 0, total: 50000,
      payment_method: "Tunai", paid_amount: 50000, change: 0,
    };
    try {
      await printReceiptSmart(sample, form);
      toast.success("Tes cetak dikirim");
    } catch (e) {
      toast.error(e.message || "Gagal mencetak");
    }
  };

  const doReprice = async () => {
    if (!window.confirm("Cocokkan harga & biaya SEMUA produk dari file katalog (via SKU)? Harga jual & harga modal akan ditimpa. Harga 'variable' → 0 (manual di POS).")) return;
    setCatalogBusy(true);
    try {
      const r = await api.post("/admin/reprice-catalog");
      const d = r.data || {};
      toast.success(`Selesai: ${d.matched} produk diperbarui dari ${d.catalog_rows} baris katalog. Tidak cocok: ${d.unmatched_count}.`);
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    } finally {
      setCatalogBusy(false);
    }
  };
  const doResetStock = async () => {
    if (!window.confirm("Reset stok SEMUA produk menjadi 0? Tindakan ini tidak dapat dibatalkan.")) return;
    setStockBusy(true);
    try {
      const r = await api.post("/admin/reset-stock");
      toast.success(`Stok ${r.data.reset} produk di-reset ke 0`);
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    } finally {
      setStockBusy(false);
    }
  };

  const doReset = async () => {
    setResetting(true);
    try {
      const r = await api.post("/admin/clear-transactions");
      const d = r.data.deleted || {};
      toast.success(`Data transaksi dihapus (${d.sales || 0} penjualan, ${d.orders || 0} pesanan)`);
      setConfirmReset(false);
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Konfigurasi</p>
        <h1 className="font-display text-3xl font-bold tracking-tight">Pengaturan</h1>
      </div>

      {/* Outlet info — Owner/Manager only */}
      {(user?.role === "Owner" || user?.role === "Manager") && (
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="mb-4 flex items-center gap-2">
          <Store className="h-5 w-5 text-primary" />
          <h3 className="font-display text-lg font-semibold">Informasi Outlet</h3>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2"><Label>Nama Bisnis</Label><Input value={form.business_name || ""} onChange={(e) => setForm({ ...form, business_name: e.target.value })} data-testid="settings-business-input" /></div>
          <div className="space-y-1 sm:col-span-2"><Label>Alamat</Label><Input data-testid="settings-input-1" value={form.address || ""} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
          <div className="space-y-1"><Label>Telepon</Label><Input data-testid="settings-input-2" value={form.phone || ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          <div className="space-y-1"><Label>Mata Uang</Label><Input data-testid="settings-input-3" value={form.currency || ""} onChange={(e) => setForm({ ...form, currency: e.target.value })} /></div>
          <div className="space-y-1"><Label>Pajak Default (%)</Label><Input type="number" value={form.tax_rate ?? 0} onChange={(e) => setForm({ ...form, tax_rate: e.target.value })} data-testid="settings-tax-input" /></div>
          <div className="space-y-1 sm:col-span-2"><Label>Footer Struk</Label><Input data-testid="settings-input-4" value={form.receipt_footer || ""} onChange={(e) => setForm({ ...form, receipt_footer: e.target.value })} /></div>
        </div>
        <Button onClick={save} className="mt-6 gap-2" data-testid="save-settings-button"><Save className="h-4 w-4" /> Simpan Perubahan</Button>
      </div>
      )}

      {/* Printer settings */}
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="mb-2 flex items-center gap-2">
          <Printer className="h-5 w-5 text-primary" />
          <h3 className="font-display text-lg font-semibold">Pengaturan Printer</h3>
        </div>
        <p className="mb-4 rounded-md bg-primary/5 px-3 py-2 text-xs text-muted-foreground" data-testid="printer-per-user-note">
          Pengaturan printer bersifat <b>per perangkat</b>. Daftar printer, mode cetak, printer aktif & lebar kertas disimpan di HP/komputer ini saja — mengubahnya <b>tidak memengaruhi perangkat lain</b>, meski memakai akun yang sama.
          <br />Catatan: printer Bluetooth thermal hanya bisa terhubung ke <b>satu perangkat dalam satu waktu</b>. Agar 1 printer dipakai banyak perangkat bergantian, gunakan mode <b>USB/Desktop</b>.
        </p>

        <div className="space-y-4">
          {(user?.role === "Owner" || user?.role === "Manager") && (
          <div className="space-y-2">
            <Label>Logo Struk <span className="text-muted-foreground">(tampil di struk cetak & thermal — berlaku untuk seluruh toko)</span></Label>
            <div className="flex items-center gap-3">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-white">
                <img src={form.logo || "/logo.png"} alt="Logo struk" className="h-full w-full object-contain" data-testid="receipt-logo-preview" />
              </div>
              <div className="flex-1 space-y-1">
                <Input type="file" accept="image/*" onChange={handleLogo} data-testid="receipt-logo-input" />
                <p className="text-xs text-muted-foreground">Kosongkan untuk pakai logo aplikasi default.</p>
                {form.logo && <button type="button" onClick={() => setForm({ ...form, logo: "" })} className="text-xs text-destructive" data-testid="remove-receipt-logo">Hapus logo kustom</button>}
              </div>
            </div>
          </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Daftar Printer (Jenis Printer)</Label>
              <Button size="sm" variant="outline" className="gap-1" onClick={openAddPrinter} data-testid="add-printer-button"><Plus className="h-4 w-4" /> Tambah Printer</Button>
            </div>
            {(form.printers || []).length === 0 && (
              <p className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground" data-testid="printer-empty">
                Belum ada printer tersimpan. Tambahkan printer Anda (mis. <b>VSC TM-80D</b>, koneksi USB/Desktop atau Bluetooth, kertas <b>80mm</b>) lalu jadikan aktif.
              </p>
            )}
            <div className="space-y-2">
              {(form.printers || []).map((p) => {
                const active = form.active_printer === p.id;
                return (
                  <div key={p.id} className={`flex items-center justify-between gap-2 rounded-md border p-3 ${active ? "border-primary bg-accent/40" : "border-border"}`} data-testid={`printer-item-${p.id}`}>
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-sm font-semibold">
                        {p.connection === "bluetooth" ? <Bluetooth className="h-4 w-4 shrink-0" /> : <Monitor className="h-4 w-4 shrink-0" />}
                        <span className="truncate">{p.name}</span>
                        {active && <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">AKTIF</span>}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{p.connection === "bluetooth" ? "Bluetooth Thermal" : "USB / Desktop"} · Kertas {p.paper_width}mm</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {!active && <Button size="sm" variant="outline" onClick={() => activatePrinter(p)} data-testid={`printer-activate-${p.id}`}>Jadikan Aktif</Button>}
                      <Button size="icon" variant="ghost" onClick={() => openEditPrinter(p)} data-testid={`printer-edit-${p.id}`}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" className="text-destructive" onClick={() => deletePrinter(p.id)} data-testid={`printer-delete-${p.id}`}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              Printer <b>aktif</b> dipakai untuk mencetak struk di seluruh aplikasi. Untuk <b>VSC TM-80D</b>: koneksi <b>USB/Desktop</b> paling andal (cetak lewat dialog browser), atau <b>Bluetooth</b> bila printer mendukung BLE. Lebar kertas <b>80mm</b>.
            </p>
          </div>

          {form.print_mode === "bluetooth" && (
            <div className="rounded-md border border-border bg-secondary/40 p-4">
              {!bluetoothSupported() ? (
                <p className="flex items-center gap-2 text-sm text-amber-600" data-testid="bt-unsupported">
                  <AlertTriangle className="h-4 w-4" /> Browser ini tidak mendukung Web Bluetooth. Gunakan Google Chrome (Android/Windows).
                </p>
              ) : (
                <>
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-sm">Status printer Bluetooth:</span>
                    <span className={`text-sm font-semibold ${btStatus === "connected" ? "text-emerald-600" : btStatus === "reconnecting" ? "text-amber-600" : btStatus === "lost" ? "text-destructive" : "text-muted-foreground"}`} data-testid="bt-status">
                      {btStatus === "connected" ? `Terhubung · ${btName}`
                        : btStatus === "reconnecting" ? `Menyambung ulang… · ${btName}`
                        : btStatus === "lost" ? `Koneksi terputus · ${btName} (menyambung ulang otomatis saat printer aktif)`
                        : "Belum terhubung"}
                    </span>
                  </div>
                  <p className="mb-3 text-xs text-muted-foreground">Koneksi dijaga otomatis (keep-alive) dan akan tersambung ulang sendiri jika printer sempat terputus — tanpa perlu buka menu ini lagi.</p>
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={connectBt} disabled={connecting} className="gap-2" data-testid="bt-connect-button">
                      <Bluetooth className="h-4 w-4" /> {connecting ? "Menghubungkan..." : btName ? "Hubungkan Ulang" : "Hubungkan Printer"}
                    </Button>
                    {btName && <Button variant="outline" onClick={disconnectBt} data-testid="bt-disconnect-button">Putuskan</Button>}
                  </div>
                </>
              )}
            </div>
          )}

          <Button variant="outline" onClick={testPrint} className="gap-2" data-testid="test-print-button">
            <TestTube2 className="h-4 w-4" /> Cetak Tes
          </Button>
          <p className="text-xs text-muted-foreground">Simpan perubahan agar mode cetak dipakai di seluruh aplikasi.</p>
          <Button onClick={save} className="gap-2" data-testid="save-printer-button"><Save className="h-4 w-4" /> Simpan Mode Cetak</Button>
        </div>
      </div>

      {/* Katalog & Stok — Owner only */}
      {user?.role === "Owner" && (
        <div className="rounded-lg border border-border bg-card p-6" data-testid="catalog-tools">
          <div className="mb-2 flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            <h3 className="font-display text-lg font-semibold">Katalog & Stok</h3>
          </div>
          <p className="mb-4 text-sm text-muted-foreground">
            Cocokkan <b>harga jual</b> & <b>harga pokok</b> semua produk dengan file katalog (dicocokkan via SKU). Harga bertanda <b>variable</b> di file akan di-set 0 (harga manual di POS). Atau reset stok semua produk ke 0.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={doReprice} disabled={catalogBusy} className="gap-2" data-testid="reprice-catalog-button">
              <RefreshCw className="h-4 w-4" /> {catalogBusy ? "Memproses..." : "Cocokkan Harga & Biaya dari Katalog"}
            </Button>
            <Button variant="outline" onClick={doResetStock} disabled={stockBusy} className="gap-2" data-testid="reset-stock-button">
              <PackageX className="h-4 w-4" /> {stockBusy ? "Memproses..." : "Reset Semua Stok = 0"}
            </Button>
          </div>
        </div>
      )}

      {/* Danger zone — Owner only */}
      {user?.role === "Owner" && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-6" data-testid="danger-zone">
          <div className="mb-2 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <h3 className="font-display text-lg font-semibold text-destructive">Zona Berbahaya</h3>
          </div>
          <p className="mb-4 text-sm text-muted-foreground">
            Hapus semua data transaksi percobaan (penjualan, pesanan, hold order, riwayat aktivitas & mutasi stok). Data produk & pelanggan tidak dihapus. Tindakan ini tidak dapat dibatalkan.
          </p>
          <Button variant="destructive" onClick={() => setConfirmReset(true)} className="gap-2" data-testid="reset-transactions-button">
            <Trash2 className="h-4 w-4" /> Reset Data Transaksi
          </Button>
        </div>
      )}

      <Dialog open={printerDialog} onOpenChange={setPrinterDialog}>
        <DialogContent data-testid="printer-dialog">
          <DialogHeader>
            <DialogTitle>{editingPrinter ? "Ubah Printer" : "Tambah Printer"}</DialogTitle>
            <DialogDescription>Simpan jenis printer beserta koneksi & lebar kertasnya. Printer aktif dipakai untuk mencetak struk.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Nama Printer</Label>
              <Input value={pForm.name} onChange={(e) => setPForm({ ...pForm, name: e.target.value })} placeholder="cth: VSC TM-80D Kasir" data-testid="printer-name-input" />
            </div>
            <div className="space-y-1">
              <Label>Koneksi</Label>
              <Select data-testid="settings-select-1" value={pForm.connection} onValueChange={(v) => setPForm({ ...pForm, connection: v })}>
                <SelectTrigger data-testid="printer-connection-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem data-testid="settings-select-item-1" value="desktop"><span className="flex items-center gap-2"><Monitor className="h-4 w-4" /> USB / Desktop (dialog print)</span></SelectItem>
                  <SelectItem data-testid="settings-select-item-2" value="bluetooth"><span className="flex items-center gap-2"><Bluetooth className="h-4 w-4" /> Bluetooth Thermal (BLE)</span></SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Lebar Kertas</Label>
              <Select data-testid="settings-select-2" value={pForm.paper_width} onValueChange={(v) => setPForm({ ...pForm, paper_width: v })}>
                <SelectTrigger data-testid="printer-paper-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem data-testid="settings-select-item-3" value="58">58mm (kecil)</SelectItem>
                  <SelectItem data-testid="settings-select-item-4" value="80">80mm (VSC TM-80D)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button data-testid="settings-button-1" variant="outline" onClick={() => setPrinterDialog(false)}>Batal</Button>
            <Button onClick={savePrinter} data-testid="printer-save-button">Simpan Printer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmReset} onOpenChange={setConfirmReset}>
        <DialogContent data-testid="reset-confirm-dialog">
          <DialogHeader>
            <DialogTitle>Hapus semua transaksi percobaan?</DialogTitle>
            <DialogDescription>
              Semua penjualan, pesanan, hold order, aktivitas, dan mutasi stok akan dihapus permanen. Produk & pelanggan tetap aman.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button data-testid="settings-button-2" variant="outline" onClick={() => setConfirmReset(false)}>Batal</Button>
            <Button variant="destructive" onClick={doReset} disabled={resetting} data-testid="reset-confirm-button">
              {resetting ? "Menghapus..." : "Ya, Hapus Semua"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
