'use client';
/** Tab Settings — konten teks & gambar tiap section halaman HP. */
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Smartphone } from 'lucide-react';
import ImagePicker from '@/components/mobilecms/ImagePicker';

function Field({ label, value, onChange, testId, placeholder, hint }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input value={value || ''} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} data-testid={testId} />
      {!!hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Group({ title, children }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="mt-3 space-y-3">{children}</div>
    </div>
  );
}

export default function SettingsPanel({ settings, setSettings, media, onMediaAdded }) {
  const set = (k) => (v) => setSettings({ ...settings, [k]: v });

  return (
    <div className="space-y-4" data-testid="cms-settings-panel">
      <div className="flex items-start gap-3 rounded-lg border border-border bg-card p-4">
        <Smartphone className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold">Aktifkan Storefront CMS di HP</div>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Selama MATI, halaman HP pelanggan tetap memakai tampilan lama dan fitur ini tidak mengubah apa pun.
            Saat NYALA, halaman HP memakai produk, kategori, dan urutan section dari CMS ini (setelah Publish).
          </p>
        </div>
        <Switch
          checked={!!settings.storefront_enabled}
          onCheckedChange={set('storefront_enabled')}
          data-testid="cms-settings-enabled"
        />
      </div>

      <Group title="Header">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nama Toko" value={settings.store_name} onChange={set('store_name')} testId="cms-settings-store-name" />
          <Field label="Tagline" value={settings.tagline} onChange={set('tagline')} testId="cms-settings-tagline" />
          <Field
            label="Placeholder Pencarian"
            value={settings.search_placeholder}
            onChange={set('search_placeholder')}
            testId="cms-settings-search-placeholder"
          />
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Warna Tema</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={settings.theme_color || '#1d4ed8'}
                onChange={(e) => set('theme_color')(e.target.value)}
                className="h-9 w-12 cursor-pointer rounded-md border border-input bg-background"
                data-testid="cms-settings-theme-color"
              />
              <Input
                value={settings.theme_color || ''}
                onChange={(e) => set('theme_color')(e.target.value)}
                data-testid="cms-settings-theme-color-text"
              />
            </div>
          </div>
        </div>
        <ImagePicker
          label="Logo Toko"
          value={settings.logo_url}
          onChange={set('logo_url')}
          media={media}
          onMediaAdded={onMediaAdded}
          kind="logo"
          testId="cms-settings-logo"
        />
      </Group>

      <Group title="Hero Banner">
        <ImagePicker
          label="Gambar Hero"
          value={settings.hero_image}
          onChange={set('hero_image')}
          media={media}
          onMediaAdded={onMediaAdded}
          kind="gallery"
          testId="cms-settings-hero-image"
          aspect="aspect-video"
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Judul Hero" value={settings.hero_title} onChange={set('hero_title')} testId="cms-settings-hero-title" />
          <Field
            label="Subjudul Hero"
            value={settings.hero_subtitle}
            onChange={set('hero_subtitle')}
            testId="cms-settings-hero-subtitle"
          />
          <Field
            label="Label Tombol"
            value={settings.hero_cta_label}
            onChange={set('hero_cta_label')}
            testId="cms-settings-hero-cta-label"
          />
          <Field
            label="Tautan Tombol"
            value={settings.hero_cta_href}
            onChange={set('hero_cta_href')}
            placeholder="/belanja"
            testId="cms-settings-hero-cta-href"
          />
        </div>
      </Group>

      <Group title="Kategori & Produk">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field
            label="Judul Section Kategori"
            value={settings.category_title}
            onChange={set('category_title')}
            testId="cms-settings-category-title"
          />
          <Field
            label="Judul Featured Products"
            value={settings.featured_title}
            onChange={set('featured_title')}
            testId="cms-settings-featured-title"
          />
          <Field
            label="Jumlah Featured (1-24)"
            value={settings.featured_limit}
            onChange={(v) => set('featured_limit')(Number(String(v).replace(/[^0-9]/g, '')) || 1)}
            testId="cms-settings-featured-limit"
          />
          <Field
            label="Judul All Products"
            value={settings.products_title}
            onChange={set('products_title')}
            testId="cms-settings-products-title"
          />
        </div>
      </Group>

      <Group title="Promo">
        <ImagePicker
          label="Gambar Promo"
          value={settings.promo_image}
          onChange={set('promo_image')}
          media={media}
          onMediaAdded={onMediaAdded}
          kind="gallery"
          testId="cms-settings-promo-image"
          aspect="aspect-video"
        />
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Judul Promo" value={settings.promo_title} onChange={set('promo_title')} testId="cms-settings-promo-title" />
          <Field
            label="Subjudul Promo"
            value={settings.promo_subtitle}
            onChange={set('promo_subtitle')}
            testId="cms-settings-promo-subtitle"
          />
          <Field label="Tautan Promo" value={settings.promo_href} onChange={set('promo_href')} testId="cms-settings-promo-href" />
        </div>
      </Group>

      <Group title="Custom Tees & Banner">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field
            label="Judul Custom Tees"
            value={settings.custom_tees_title}
            onChange={set('custom_tees_title')}
            testId="cms-settings-tees-title"
          />
          <Field
            label="Subjudul Custom Tees"
            value={settings.custom_tees_subtitle}
            onChange={set('custom_tees_subtitle')}
            testId="cms-settings-tees-subtitle"
          />
          <Field
            label="Tautan Custom Tees"
            value={settings.custom_tees_href}
            onChange={set('custom_tees_href')}
            testId="cms-settings-tees-href"
          />
        </div>
        <ImagePicker
          label="Gambar Banner Bawah"
          value={settings.banner_image}
          onChange={set('banner_image')}
          media={media}
          onMediaAdded={onMediaAdded}
          kind="gallery"
          testId="cms-settings-banner-image"
          aspect="aspect-video"
        />
        <Field label="Tautan Banner" value={settings.banner_href} onChange={set('banner_href')} testId="cms-settings-banner-href" />
      </Group>

      <Group title="Footer">
        <Field
          label="Nomor WhatsApp CS"
          value={settings.whatsapp}
          onChange={set('whatsapp')}
          placeholder="6285888102930"
          testId="cms-settings-whatsapp"
          hint="Kosongkan untuk menyembunyikan tombol Hubungi CS."
        />
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Catatan Penutup</Label>
          <Textarea
            value={settings.footer_note || ''}
            rows={2}
            onChange={(e) => set('footer_note')(e.target.value)}
            data-testid="cms-settings-footer-note"
          />
        </div>
      </Group>
    </div>
  );
}
