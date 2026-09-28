import { useCallback, useEffect, useMemo, useState } from "react";
import api, { formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Store, Plug, PlugZap, RefreshCw, ShieldCheck, Copy, Link2, AlertTriangle,
  CheckCircle2, ClipboardList, PackageSearch, KeyRound, Loader2, Unplug,
} from "lucide-react";

const TABS = [
  { key: "connection", label: "Koneksi", icon: Plug },
  { key: "mapping", label: "Mapping Produk", icon: PackageSearch },
  { key: "logs", label: "Log Sinkronisasi", icon: ClipboardList },
];

const SYNC_RANGES = [
  { value: "3", label: "3 hari terakhir" },
  { value: "7", label: "7 hari terakhir" },
  { value: "15", label: "15 hari terakhir" },
  { value: "30", label: "30 hari terakhir" },
  { value: "90", label: "90 hari terakhir" },
];

const fmtTime = (iso) => (iso ? new Date(iso).toLocaleString("id-ID") : "—");

function StatusPill({ status }) {
  const map = {
    connected: { tint: "bg-emerald-500/15 text-emerald-600", label: "Terhubung", Icon: CheckCircle2 },
    disconnected: { tint: "bg-secondary text-muted-foreground", label: "Belum terhubung", Icon: Unplug },
    error: { tint: "bg-red-500/15 text-red-600", label: "Bermasalah", Icon: AlertTriangle },
  };
  const s = map[status] || map.disconnected;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${s.tint}`} data-testid="shopee-status-pill">
      <s.Icon className="h-3.5 w-3.5" /> {s.label}
    </span>
  );
}

function CopyField({ label, value, testid }) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value || "");
      toast.success(`${label} disalin`);
    } catch {
      toast.error("Tidak bisa menyalin otomatis — salin manual");
    }
  };
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="flex items-center gap-2">
        <Input readOnly value={value || ""} className="h-9 font-mono text-xs" data-testid={testid} />
        <Button type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={copy} data-testid={`${testid}-copy`}>
          <Copy className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export default function SalesChannels() {
  const [tab, setTab] = useState("connection");
  const [ch, setCh] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [partnerId, setPartnerId] = useState("");
  const [partnerKey, setPartnerKey] = useState("");
  const [environment, setEnvironment] = useState("sandbox");
  const [days, setDays] = useState("7");
  const [mapRows, setMapRows] = useState([]);
  const [unmapped, setUnmapped] = useState(0);
  const [logs, setLogs] = useState([]);
  const [products, setProducts] = useState([]);
  const [customTypes, setCustomTypes] = useState([]);

  const loadChannel = useCallback(async () => {
    const { data } = await api.get("/channels/shopee");
    setCh(data);
    setPartnerId(data.partner_id || "");
    setEnvironment(data.environment || "sandbox");
    return data;
  }, []);

  const loadMapping = useCallback(async () => {
    const { data } = await api.get("/channels/shopee/products");
    setMapRows(data.items || []);
    setUnmapped(data.unmapped_count || 0);
  }, []);

  const loadLogs = useCallback(async () => {
    const { data } = await api.get("/channels/shopee/logs?limit=30");
    setLogs(Array.isArray(data) ? data : []);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await Promise.all([loadChannel(), loadMapping(), loadLogs()]);
        const [p, c] = await Promise.all([
          api.get("/products").catch(() => ({ data: [] })),
          api.get("/custom-products?limit=100").catch(() => ({ data: { items: [] } })),
        ]);
        setProducts(Array.isArray(p.data) ? p.data : []);
        setCustomTypes(c.data?.items || []);
      } catch (e) {
        toast.error(formatApiError(e.response?.data?.detail));
      } finally {
        setLoading(false);
      }
    })();
  }, [loadChannel, loadMapping, loadLogs]);

  // Pesan hasil OAuth dari query string (?connected=1 / ?error=...)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    if (sp.get("connected") === "1") toast.success("Akun Shopee berhasil terhubung");
    const err = sp.get("error");
    if (err) {
      const msg = {
        no_partner: "Isi Partner ID & Partner Key dulu sebelum menghubungkan",
        invalid_callback: "Callback Shopee tidak valid (state/code tidak cocok). Coba hubungkan ulang.",
        no_tenant: "Tenant tidak ditemukan",
      }[err] || `Gagal menghubungkan Shopee (${err})`;
      toast.error(sp.get("message") ? `${msg}: ${sp.get("message")}` : msg);
    }
    if (sp.get("connected") || err) {
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const saveConfig = async () => {
    setBusy("save");
    try {
      const payload = { partner_id: partnerId.trim(), environment };
      if (partnerKey.trim()) payload.partner_key = partnerKey.trim();
      const { data } = await api.post("/channels/shopee", payload);
      setCh((prev) => ({ ...prev, ...data }));
      setPartnerKey("");
      toast.success("Konfigurasi Shopee disimpan (Partner Key tersimpan terenkripsi di server)");
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    } finally {
      setBusy("");
    }
  };

  const toggleAutoSync = async (value) => {
    try {
      const { data } = await api.post("/channels/shopee", { auto_sync: value });
      setCh((prev) => ({ ...prev, ...data }));
      toast.success(value ? "Sinkronisasi otomatis aktif" : "Sinkronisasi otomatis dimatikan");
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    }
  };

  const connect = () => {
    if (!partnerId.trim() || (!ch?.has_partner_key && !partnerKey.trim())) {
      toast.error("Isi & simpan Partner ID + Partner Key dulu");
      return;
    }
    window.location.href = "/api/channels/shopee/oauth/start";
  };

  const testConnection = async () => {
    setBusy("test");
    try {
      const { data } = await api.post("/channels/shopee/test", {});
      toast.success(`Koneksi OK — ${data.shop_name || data.shop_id} (${data.environment})`);
      await loadChannel();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
      await loadChannel();
    } finally {
      setBusy("");
    }
  };

  const syncNow = async () => {
    setBusy("sync");
    try {
      const { data } = await api.post("/channels/shopee/sync", { days: Number(days) });
      if (data.status === "failed") toast.error(`Sinkron gagal: ${data.message}`);
      else {
        toast.success(
          `Sinkron ${data.status} — dicek ${data.orders_checked}, baru ${data.orders_created}, diperbarui ${data.orders_updated}`,
        );
      }
      await Promise.all([loadChannel(), loadLogs(), loadMapping()]);
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    } finally {
      setBusy("");
    }
  };

  const disconnect = async () => {
    if (!window.confirm("Putuskan koneksi Shopee? Token dihapus, tapi pesanan yang sudah masuk TIDAK dihapus.")) return;
    setBusy("disconnect");
    try {
      const { data } = await api.delete("/channels/shopee");
      setCh((prev) => ({ ...prev, ...data }));
      toast.success("Koneksi Shopee diputus");
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    } finally {
      setBusy("");
    }
  };

  const setMapping = async (row, value) => {
    const payload = { id: row.id, internal_product_id: null, custom_product_key: null, is_custom: false };
    if (value === "__none__") payload.mapping_status = "UNMAPPED";
    else if (value === "__ignore__") payload.mapping_status = "IGNORED";
    else if (value.startsWith("custom:")) {
      payload.custom_product_key = value.slice(7);
      payload.is_custom = true;
    } else payload.internal_product_id = value;
    try {
      await api.put("/channels/shopee/products", payload);
      await loadMapping();
      toast.success("Mapping produk disimpan");
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    }
  };

  const mappingValue = (row) => {
    if (row.custom_product_key) return `custom:${row.custom_product_key}`;
    if (row.internal_product_id) return row.internal_product_id;
    if (row.mapping_status === "IGNORED") return "__ignore__";
    return "__none__";
  };

  const lastSuccess = useMemo(() => (logs || []).find((l) => l.status === "success"), [logs]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="channels-loading">
        <Loader2 className="h-4 w-4 animate-spin" /> Memuat kanal penjualan...
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="sales-channels-page">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Pengaturan · Sales Channels</p>
        <h1 className="font-display text-3xl font-bold tracking-tight">Kanal Penjualan</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Hubungkan marketplace supaya semua pesanannya masuk ke sistem pesanan yang sama — bukan cuma Custom Tees.
          Token disimpan terenkripsi di server dan tidak pernah dikirim ke browser.
        </p>
      </div>

      {/* Ringkasan kanal */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-border bg-card p-4" data-testid="card-shopee-summary">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 font-semibold"><Store className="h-4 w-4 text-orange-500" /> Shopee</span>
            <StatusPill status={ch?.status} />
          </div>
          <p className="mt-2 truncate text-sm text-muted-foreground" data-testid="shopee-shop-name">
            {ch?.shop_name || "Belum ada toko"}
          </p>
          <p className="text-xs text-muted-foreground">Shop ID: {ch?.external_shop_id || "—"}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Terhubung sejak</p>
          <p className="mt-1 text-sm font-semibold">{fmtTime(ch?.connected_at)}</p>
          <p className="mt-2 text-xs uppercase tracking-wide text-muted-foreground">Environment</p>
          <p className="text-sm font-semibold uppercase">{ch?.environment}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Sinkron terakhir</p>
          <p className="mt-1 text-sm font-semibold" data-testid="shopee-last-sync">{fmtTime(ch?.last_sync_at)}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Status: <span className="font-semibold uppercase">{ch?.last_sync_status || "—"}</span>
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Produk belum dipetakan</p>
          <p className="mt-1 text-2xl font-bold" data-testid="unmapped-count">{unmapped}</p>
          <p className="text-xs text-muted-foreground">Pesanan tetap masuk walau belum dipetakan.</p>
        </div>
      </div>

      {ch?.last_error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300" data-testid="shopee-error-banner">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">Sinkronisasi Shopee sempat gagal.</p>
            <p className="break-words text-xs">{ch.last_error}</p>
            <p className="mt-1 text-xs">
              Sinkron sukses terakhir: {lastSuccess ? fmtTime(lastSuccess.started_at) : "belum ada"}
            </p>
            <Button size="sm" variant="outline" className="mt-2 gap-1" onClick={syncNow} disabled={busy === "sync"} data-testid="retry-sync-button">
              <RefreshCw className={`h-4 w-4 ${busy === "sync" ? "animate-spin" : ""}`} /> Coba Sinkron Lagi
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-1 border-b border-border" data-testid="channel-tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors duration-200 ${
              tab === t.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            data-testid={`channel-tab-${t.key}`}
          >
            <t.icon className="h-4 w-4" /> {t.label}
            {t.key === "mapping" && unmapped > 0 && (
              <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-600">{unmapped}</span>
            )}
          </button>
        ))}
      </div>

      {tab === "connection" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="space-y-4 rounded-lg border border-border bg-card p-5">
            <div className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-primary" />
              <h2 className="font-display text-lg font-semibold">Kredensial Shopee Open Platform</h2>
            </div>
            <p className="text-xs text-muted-foreground">
              Ambil di open.shopee.com/console → App details. Partner Key hanya dikirim sekali ke server, disimpan
              terenkripsi, dan tidak pernah ditampilkan lagi.
            </p>
            <div className="space-y-1">
              <Label>Environment</Label>
              <Select value={environment} onValueChange={setEnvironment}>
                <SelectTrigger data-testid="shopee-env-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sandbox" data-testid="shopee-env-sandbox">Sandbox / Test</SelectItem>
                  <SelectItem value="live" data-testid="shopee-env-live">Live / Production</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Partner ID</Label>
              <Input value={partnerId} onChange={(e) => setPartnerId(e.target.value)} placeholder="contoh: 1027xxx" data-testid="shopee-partner-id" />
            </div>
            <div className="space-y-1">
              <Label>Partner Key</Label>
              <Input
                type="password"
                value={partnerKey}
                onChange={(e) => setPartnerKey(e.target.value)}
                placeholder={ch?.has_partner_key ? "•••••• sudah tersimpan (isi untuk mengganti)" : "tempel Partner Key"}
                autoComplete="new-password"
                data-testid="shopee-partner-key"
              />
            </div>
            <Button onClick={saveConfig} disabled={busy === "save"} className="w-full gap-2" data-testid="shopee-save-config">
              <ShieldCheck className="h-4 w-4" /> {busy === "save" ? "Menyimpan..." : "Simpan Kredensial"}
            </Button>

            <div className="space-y-3 rounded-md bg-secondary/40 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Daftarkan URL ini di Shopee Console
              </p>
              <CopyField label="Redirect URL" value={ch?.redirect_uri} testid="shopee-redirect-uri" />
              <CopyField label="Push / Webhook URL (order_status_push)" value={ch?.webhook_url} testid="shopee-webhook-url" />
            </div>
          </div>

          <div className="space-y-4 rounded-lg border border-border bg-card p-5">
            <div className="flex items-center gap-2">
              <Link2 className="h-4 w-4 text-primary" />
              <h2 className="font-display text-lg font-semibold">Koneksi Akun Seller</h2>
            </div>
            <p className="text-xs text-muted-foreground">
              Otorisasi lewat halaman resmi Shopee — aplikasi ini tidak pernah meminta password Shopee kakak.
            </p>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-xs text-muted-foreground">Nama Toko</p><p className="font-semibold">{ch?.shop_name || "—"}</p></div>
              <div><p className="text-xs text-muted-foreground">Shop ID</p><p className="font-semibold">{ch?.external_shop_id || "—"}</p></div>
              <div><p className="text-xs text-muted-foreground">Token aktif</p><p className="font-semibold">{ch?.has_token ? "Ya" : "Tidak"}</p></div>
              <div><p className="text-xs text-muted-foreground">Token berlaku s/d</p><p className="font-semibold">{fmtTime(ch?.token_expires_at)}</p></div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={connect} className="gap-2" data-testid="shopee-connect-button">
                <PlugZap className="h-4 w-4" /> {ch?.status === "connected" ? "Hubungkan Ulang" : "Hubungkan Akun Shopee"}
              </Button>
              <Button variant="outline" onClick={testConnection} disabled={busy === "test"} className="gap-2" data-testid="shopee-test-button">
                <ShieldCheck className="h-4 w-4" /> {busy === "test" ? "Menguji..." : "Test Koneksi"}
              </Button>
              <Button variant="outline" onClick={disconnect} disabled={busy === "disconnect"} className="gap-2 text-destructive" data-testid="shopee-disconnect-button">
                <Unplug className="h-4 w-4" /> Putuskan
              </Button>
            </div>

            <div className="space-y-2 rounded-md bg-secondary/40 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">Sinkronisasi otomatis</p>
                  <p className="text-xs text-muted-foreground">Webhook Shopee + rekonsiliasi berkala (inkremental).</p>
                </div>
                <Switch checked={!!ch?.auto_sync} onCheckedChange={toggleAutoSync} data-testid="shopee-auto-sync" />
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-[180px] flex-1 space-y-1">
                  <Label className="text-xs">Rentang sinkron manual</Label>
                  <Select value={days} onValueChange={setDays}>
                    <SelectTrigger data-testid="shopee-sync-range"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SYNC_RANGES.map((r) => (
                        <SelectItem key={r.value} value={r.value} data-testid={`shopee-sync-range-${r.value}`}>{r.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={syncNow} disabled={busy === "sync"} className="gap-2" data-testid="shopee-sync-button">
                  <RefreshCw className={`h-4 w-4 ${busy === "sync" ? "animate-spin" : ""}`} /> Sinkron Sekarang
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "mapping" && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Petakan produk Shopee ke produk internal atau ke jenis produk Custom Tees. Produk custom otomatis masuk alur
            Custom Tees yang sudah ada. Yang belum dipetakan tetap diimpor, hanya ditandai UNMAPPED.
          </p>
          {mapRows.length === 0 && (
            <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground" data-testid="mapping-empty">
              Belum ada produk Shopee terdeteksi. Produk akan muncul otomatis setelah sinkronisasi pesanan pertama.
            </p>
          )}
          {mapRows.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm" data-testid="mapping-table">
                <thead className="bg-secondary/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="p-3">Produk Shopee</th>
                    <th className="p-3">SKU / Varian</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Produk Internal</th>
                  </tr>
                </thead>
                <tbody>
                  {mapRows.map((r) => (
                    <tr key={r.id} className="border-t border-border" data-testid={`mapping-row-${r.id}`}>
                      <td className="p-3">
                        <p className="font-medium">{r.external_name || "(tanpa nama)"}</p>
                        <p className="text-xs text-muted-foreground">ID {r.external_product_id} · Var {r.external_variation_id}</p>
                      </td>
                      <td className="p-3">
                        <p className="font-mono text-xs">{r.external_sku || "—"}</p>
                        <p className="text-xs text-muted-foreground">{r.external_variation || "—"}</p>
                      </td>
                      <td className="p-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                            r.mapping_status === "MAPPED"
                              ? "bg-emerald-500/15 text-emerald-600"
                              : r.mapping_status === "IGNORED"
                                ? "bg-secondary text-muted-foreground"
                                : "bg-amber-500/15 text-amber-600"
                          }`}
                        >
                          {r.mapping_status}
                        </span>
                        {r.is_custom && (
                          <span className="ml-1 rounded-full bg-blue-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-blue-600">Custom Tees</span>
                        )}
                      </td>
                      <td className="p-3">
                        <Select value={mappingValue(r)} onValueChange={(v) => setMapping(r, v)}>
                          <SelectTrigger className="h-9 min-w-[220px]" data-testid={`mapping-select-${r.id}`}><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__" data-testid={`mapping-none-${r.id}`}>— Belum dipetakan —</SelectItem>
                            <SelectItem value="__ignore__">Abaikan produk ini</SelectItem>
                            {customTypes.map((c) => (
                              <SelectItem key={c.product_key} value={`custom:${c.product_key}`}>Custom Tees · {c.title}</SelectItem>
                            ))}
                            {products.map((p) => (
                              <SelectItem key={p.id} value={p.id}>{p.name}{p.sku ? ` (${p.sku})` : ""}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === "logs" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Riwayat 30 sinkronisasi terakhir (manual, cron, dan webhook).</p>
            <Button variant="outline" size="sm" className="gap-1" onClick={loadLogs} data-testid="logs-refresh">
              <RefreshCw className="h-4 w-4" /> Muat ulang
            </Button>
          </div>
          {logs.length === 0 && (
            <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground" data-testid="logs-empty">
              Belum ada log sinkronisasi.
            </p>
          )}
          {logs.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm" data-testid="logs-table">
                <thead className="bg-secondary/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="p-3">Waktu</th>
                    <th className="p-3">Tipe</th>
                    <th className="p-3">Dicek</th>
                    <th className="p-3">Baru</th>
                    <th className="p-3">Update</th>
                    <th className="p-3">Skip</th>
                    <th className="p-3">Error</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Keterangan</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((l) => (
                    <tr key={l.id} className="border-t border-border" data-testid={`log-row-${l.id}`}>
                      <td className="p-3 whitespace-nowrap">{fmtTime(l.started_at)}</td>
                      <td className="p-3 uppercase text-xs font-semibold">{l.sync_type}</td>
                      <td className="p-3">{l.orders_checked}</td>
                      <td className="p-3 font-semibold text-emerald-600">{l.orders_created}</td>
                      <td className="p-3 font-semibold text-blue-600">{l.orders_updated}</td>
                      <td className="p-3">{l.orders_skipped}</td>
                      <td className="p-3">{l.errors_count}</td>
                      <td className="p-3">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                          l.status === "success" ? "bg-emerald-500/15 text-emerald-600"
                            : l.status === "partial" ? "bg-amber-500/15 text-amber-600"
                              : "bg-red-500/15 text-red-600"
                        }`}>{l.status}</span>
                      </td>
                      <td className="max-w-[320px] p-3 text-xs text-muted-foreground">
                        <span className="break-words">{l.message}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
