/**
 * Mobile Platform Management — CMS untuk tampilan & konten website versi HP.
 *
 * Letak menu: Sales Channel › Mobile Platform Management (lihat components/Layout.jsx).
 *
 * Alur kerja:
 *   1. Admin menyunting Products / Categories / Media (tersimpan langsung ke
 *      tabel draft `mobile_cms_*`).
 *   2. Mobile Layout & Settings disimpan lewat tombol "Save Draft".
 *   3. "Publish Changes" menyalin seluruh draft menjadi snapshot yang dibaca
 *      halaman HP pelanggan. Jadi draft tidak pernah bocor sebelum dipublikasi.
 *
 * Fitur ini TIDAK mengubah tabel, halaman, atau komponen existing. Storefront
 * HP hanya memakai data CMS kalau tombol "Aktifkan Storefront CMS" dinyalakan.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Smartphone,
  LayoutDashboard,
  Package,
  Tags,
  Images,
  LayoutList,
  Settings as SettingsIcon,
  Save,
  UploadCloud,
  Loader2,
  ExternalLink,
} from "lucide-react";
import api, { formatApiError } from "@/lib/api";
import DashboardPanel from "@/components/mobilecms/DashboardPanel";
import ProductsPanel from "@/components/mobilecms/ProductsPanel";
import CategoriesPanel from "@/components/mobilecms/CategoriesPanel";
import MediaPanel from "@/components/mobilecms/MediaPanel";
import LayoutPanel from "@/components/mobilecms/LayoutPanel";
import SettingsPanel from "@/components/mobilecms/SettingsPanel";
import MobilePreview from "@/components/mobilecms/MobilePreview";

const TABS = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "products", label: "Products", icon: Package },
  { key: "categories", label: "Categories", icon: Tags },
  { key: "media", label: "Media", icon: Images },
  { key: "layout", label: "Mobile Layout", icon: LayoutList },
  { key: "settings", label: "Settings", icon: SettingsIcon },
];

export default function MobilePlatform() {
  const [tab, setTab] = useState("dashboard");
  const [server, setServer] = useState(null); // data draft dari server
  const [sections, setSections] = useState([]); // draft lokal (belum di-save)
  const [settings, setSettings] = useState({}); // draft lokal (belum di-save)
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);

  const load = useCallback(
    async (keepLocal = false) => {
      try {
        const { data } = await api.get("/mobile-cms/layout");
        setServer(data);
        if (!keepLocal) {
          setSections(data.sections || []);
          setSettings(data.settings || {});
        }
      } catch (e) {
        toast.error(formatApiError(e.response?.data?.detail) || "Gagal memuat data Mobile Platform");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    load();
  }, [load]);

  /** Draft gabungan: data server + perubahan layout/settings yang belum disimpan. */
  const draft = useMemo(
    () => ({ ...(server || {}), sections, settings }),
    [server, sections, settings],
  );

  const dirty = useMemo(() => {
    if (!server) return false;
    return (
      JSON.stringify(server.sections || []) !== JSON.stringify(sections) ||
      JSON.stringify(server.settings || {}) !== JSON.stringify(settings)
    );
  }, [server, sections, settings]);

  const saveDraft = async () => {
    setSaving(true);
    try {
      const { data } = await api.put("/mobile-cms/layout", { sections, settings });
      setServer(data);
      setSections(data.sections || []);
      setSettings(data.settings || {});
      toast.success("Draft disimpan. Belum tampil ke pelanggan sampai di-Publish.");
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || "Gagal menyimpan draft");
    } finally {
      setSaving(false);
    }
  };

  const publish = async () => {
    setPublishing(true);
    try {
      // Simpan dulu perubahan layout/settings supaya snapshot ikut terbaru.
      if (dirty) await api.put("/mobile-cms/layout", { sections, settings });
      const { data } = await api.post("/mobile-cms/publish");
      toast.success(
        data.enabled
          ? `Perubahan dipublikasikan (${data.product_count} produk tampil di HP).`
          : "Snapshot dipublikasikan. Storefront CMS masih mati — nyalakan di tab Settings.",
      );
      setPublishOpen(false);
      await load();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || "Gagal mempublikasikan perubahan");
    } finally {
      setPublishing(false);
    }
  };

  // Gambar baru hasil upload dari panel mana pun langsung masuk daftar Media.
  const onMediaAdded = (items) => {
    if (!items?.length) return;
    setServer((s) => (s ? { ...s, media: items } : s));
  };

  const reload = () => load(true);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center" data-testid="mobile-platform-loading">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="-m-4 space-y-5 bg-zinc-100 p-4 dark:bg-zinc-900 sm:-m-6 sm:p-6" data-testid="mobile-platform-page">
      {/* Judul + aksi utama */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Sales Channel · Mobile Platform Management
          </p>
          <h1 className="font-display text-3xl font-bold tracking-tight">Mobile Store Management</h1>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            <Smartphone className="h-3.5 w-3.5" /> Atur produk, harga, gambar, dan susunan halaman versi HP tanpa
            mengubah kode.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href="/belanja"
            target="_blank"
            rel="noreferrer"
            data-testid="mobile-platform-open-storefront"
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-xs font-semibold transition hover:bg-secondary"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Buka Halaman HP
          </a>
          <Button variant="outline" onClick={saveDraft} disabled={saving} data-testid="mobile-platform-save-draft">
            {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}
            Save Draft{dirty ? " *" : ""}
          </Button>
          <Button onClick={() => setPublishOpen(true)} data-testid="mobile-platform-publish">
            <UploadCloud className="mr-1 h-4 w-4" /> Publish Changes
          </Button>
        </div>
      </div>

      {/* Submenu halaman */}
      <div className="flex gap-1.5 overflow-x-auto rounded-lg border border-border bg-card p-1.5">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            data-testid={`mobile-platform-tab-${key}`}
            className={`flex shrink-0 items-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold transition ${
              tab === key
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
          >
            <Icon className="h-3.5 w-3.5" /> {label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0">
          {tab === "dashboard" && <DashboardPanel draft={draft} />}
          {tab === "products" && (
            <ProductsPanel draft={draft} reload={reload} onMediaAdded={onMediaAdded} />
          )}
          {tab === "categories" && (
            <CategoriesPanel draft={draft} reload={reload} onMediaAdded={onMediaAdded} />
          )}
          {tab === "media" && <MediaPanel draft={draft} reload={reload} />}
          {tab === "layout" && <LayoutPanel sections={sections} setSections={setSections} />}
          {tab === "settings" && (
            <SettingsPanel
              settings={settings}
              setSettings={setSettings}
              media={draft.media || []}
              onMediaAdded={onMediaAdded}
            />
          )}
        </div>

        <div className="xl:sticky xl:top-4">
          <MobilePreview draft={draft} onRefresh={reload} publishedAt={server?.published_at} />
        </div>
      </div>

      {/* Konfirmasi publish */}
      <Dialog open={publishOpen} onOpenChange={setPublishOpen}>
        <DialogContent className="max-w-md" data-testid="mobile-platform-publish-dialog">
          <DialogHeader>
            <DialogTitle>Publish these changes to the mobile storefront?</DialogTitle>
            <DialogDescription>
              Seluruh produk berstatus <b>Active</b> / <b>Out of Stock</b>, kategori aktif, urutan section, dan
              pengaturan konten akan diterapkan ke halaman HP pelanggan.
              {!settings.storefront_enabled && (
                <>
                  {" "}
                  Catatan: tombol <b>Aktifkan Storefront CMS</b> di tab Settings masih mati, jadi pelanggan tetap
                  melihat tampilan lama.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPublishOpen(false)} data-testid="mobile-platform-publish-cancel">
              Batal
            </Button>
            <Button onClick={publish} disabled={publishing} data-testid="mobile-platform-publish-confirm">
              {publishing && <Loader2 className="mr-1 h-4 w-4 animate-spin" />} Ya, Publish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
