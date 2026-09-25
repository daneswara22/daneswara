/**
 * Google Fonts tanpa mengunduh berkas.
 * ---------------------------------------------------------------------------
 * Admin bisa menambah font langsung dari katalog Google Fonts. Yang disimpan
 * di database hanya *nama family* dan *URL CSS* resmi Google
 * (https://fonts.googleapis.com/css2?family=...), jadi tidak ada berkas font
 * yang diunggah maupun disimpan di R2. Browser pelanggan memuat berkasnya
 * langsung dari CDN Google lewat <link>/@import.
 *
 * Kenapa aman untuk canvas/struk: yang bikin canvas "tercemar" hanya gambar
 * lintas-domain, bukan font. Google juga menyajikan font dengan header CORS.
 *
 * Catatan: format disimpan sebagai 'google' supaya baris ini gampang dibedakan
 * dari font unggahan tanpa perlu mengubah skema tabel `custom_fonts`.
 */

export const GOOGLE_FONT_FORMAT = 'google';
export const GOOGLE_CSS_BASE = 'https://fonts.googleapis.com/css2';

/** Ketebalan yang diminta ke Google (dicoba dulu, lalu jatuh ke reguler). */
export const GOOGLE_PREFERRED_WEIGHTS = [400, 700];

/**
 * Katalog pilihan populer supaya admin tidak perlu API key Google.
 * Admin tetap bisa mengetik nama family apa pun; nama itu diverifikasi
 * langsung ke Google sebelum disimpan.
 */
export const GOOGLE_FONT_CATALOG: { family: string; category: string }[] = [
  { family: 'Inter', category: 'Sans Serif' },
  { family: 'Roboto', category: 'Sans Serif' },
  { family: 'Open Sans', category: 'Sans Serif' },
  { family: 'Montserrat', category: 'Sans Serif' },
  { family: 'Poppins', category: 'Sans Serif' },
  { family: 'Lato', category: 'Sans Serif' },
  { family: 'Nunito', category: 'Sans Serif' },
  { family: 'Raleway', category: 'Sans Serif' },
  { family: 'Work Sans', category: 'Sans Serif' },
  { family: 'DM Sans', category: 'Sans Serif' },
  { family: 'Manrope', category: 'Sans Serif' },
  { family: 'Outfit', category: 'Sans Serif' },
  { family: 'Plus Jakarta Sans', category: 'Sans Serif' },
  { family: 'Oswald', category: 'Display' },
  { family: 'Bebas Neue', category: 'Display' },
  { family: 'Anton', category: 'Display' },
  { family: 'Archivo Black', category: 'Display' },
  { family: 'Alfa Slab One', category: 'Display' },
  { family: 'Bungee', category: 'Display' },
  { family: 'Titan One', category: 'Display' },
  { family: 'Righteous', category: 'Display' },
  { family: 'Fredoka', category: 'Display' },
  { family: 'Luckiest Guy', category: 'Display' },
  { family: 'Bangers', category: 'Display' },
  { family: 'Permanent Marker', category: 'Tulisan Tangan' },
  { family: 'Caveat', category: 'Tulisan Tangan' },
  { family: 'Pacifico', category: 'Tulisan Tangan' },
  { family: 'Lobster', category: 'Tulisan Tangan' },
  { family: 'Dancing Script', category: 'Tulisan Tangan' },
  { family: 'Great Vibes', category: 'Tulisan Tangan' },
  { family: 'Satisfy', category: 'Tulisan Tangan' },
  { family: 'Shadows Into Light', category: 'Tulisan Tangan' },
  { family: 'Indie Flower', category: 'Tulisan Tangan' },
  { family: 'Playfair Display', category: 'Serif' },
  { family: 'Merriweather', category: 'Serif' },
  { family: 'Lora', category: 'Serif' },
  { family: 'PT Serif', category: 'Serif' },
  { family: 'Bitter', category: 'Serif' },
  { family: 'Abril Fatface', category: 'Serif' },
  { family: 'Cinzel', category: 'Serif' },
  { family: 'Space Mono', category: 'Monospace' },
  { family: 'JetBrains Mono', category: 'Monospace' },
  { family: 'Roboto Mono', category: 'Monospace' },
  { family: 'Press Start 2P', category: 'Retro / Piksel' },
  { family: 'VT323', category: 'Retro / Piksel' },
  { family: 'Silkscreen', category: 'Retro / Piksel' },
  { family: 'Monoton', category: 'Retro / Piksel' },
  { family: 'Rubik Mono One', category: 'Retro / Piksel' },
];

export const GOOGLE_FONT_CATEGORIES = Array.from(
  new Set(GOOGLE_FONT_CATALOG.map((f) => f.category)),
);

/* ---------------------------------------------------------------------------
 * Katalog LENGKAP Google Fonts (±1.900 family) tanpa API key.
 *
 * Google menyajikan metadata katalognya di /metadata/fonts sebagai JSON
 * (diawali penjaga ")]}'" yang harus dibuang). Isinya nama family, kategori,
 * dan peringkat popularitas — persis yang dipakai situs fonts.google.com untuk
 * urutan "Popular". Hasilnya di-cache di memori 24 jam supaya tidak menembak
 * Google tiap kali admin mengetik. Kalau jaringan gagal, otomatis jatuh ke
 * katalog pilihan di atas sehingga menu Kelola Font tetap bisa dipakai.
 * ------------------------------------------------------------------------- */
export const GOOGLE_METADATA_URL = 'https://fonts.google.com/metadata/fonts';

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

/** Kategori Google (Inggris) -> label Indonesia untuk tampilan admin. */
const CATEGORY_LABELS: Record<string, string> = {
  'Sans Serif': 'Sans Serif',
  Serif: 'Serif',
  Display: 'Display',
  Handwriting: 'Tulisan Tangan',
  Monospace: 'Monospace',
};
export const localizeCategory = (c: string) => CATEGORY_LABELS[c] || c || 'Lainnya';

export type GoogleFamily = { family: string; category: string; popularity: number };

const CATALOG_TTL_MS = 24 * 60 * 60 * 1000;
let catalogCache: { at: number; items: GoogleFamily[] } | null = null;

const fallbackFamilies = (): GoogleFamily[] =>
  GOOGLE_FONT_CATALOG.map((f, i) => ({ ...f, popularity: i + 1 }));

export async function fetchGoogleFamilies(): Promise<{ items: GoogleFamily[]; source: 'google' | 'fallback' }> {
  if (catalogCache && Date.now() - catalogCache.at < CATALOG_TTL_MS) {
    return { items: catalogCache.items, source: 'google' };
  }
  try {
    const res = await fetch(GOOGLE_METADATA_URL, {
      headers: { 'User-Agent': BROWSER_UA },
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    let text = await res.text();
    if (text.startsWith(")]}'")) text = text.slice(text.indexOf('\n') + 1);
    const list = JSON.parse(text)?.familyMetadataList;
    if (!Array.isArray(list) || !list.length) throw new Error('metadata kosong');
    const items: GoogleFamily[] = list
      .map((f: any) => ({
        family: String(f?.family || '').trim(),
        category: localizeCategory(String(f?.category || '')),
        popularity: Number(f?.popularity) || 99999,
      }))
      .filter((f: GoogleFamily) => f.family.length >= 2)
      .sort((a: GoogleFamily, b: GoogleFamily) => a.popularity - b.popularity);
    catalogCache = { at: Date.now(), items };
    return { items, source: 'google' };
  } catch {
    return { items: fallbackFamilies(), source: 'fallback' };
  }
}

/**
 * Pencarian ala situs Google Fonts: tidak peduli huruf besar/kecil maupun
 * spasi ("bebasneue" tetap menemukan "Bebas Neue"), dan yang namanya diawali
 * kata pencarian ditampilkan lebih dulu, sisanya menurut popularitas.
 */
export function searchGoogleFamilies(
  all: GoogleFamily[],
  { q = '', category = '' }: { q?: string; category?: string },
): GoogleFamily[] {
  let list = all;
  if (category) list = list.filter((f) => f.category === category);
  const needle = q.trim().toLowerCase();
  if (!needle) return list;
  const squished = needle.replace(/\s+/g, '');
  const scored = list
    .map((f) => {
      const low = f.family.toLowerCase();
      const flat = low.replace(/\s+/g, '');
      if (!flat.includes(squished)) return null;
      return { f, rank: low.startsWith(needle) ? 0 : flat.startsWith(squished) ? 1 : 2 };
    })
    .filter(Boolean) as { f: GoogleFamily; rank: number }[];
  scored.sort((a, b) => a.rank - b.rank || a.f.popularity - b.f.popularity);
  return scored.map((s) => s.f);
}

/** Rapikan input admin: "  bebas   neue " -> "Bebas Neue". */
export function normalizeGoogleFamily(raw: string): string {
  return String(raw || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60)
    .split(' ')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}

/** URL CSS resmi Google untuk satu atau beberapa family. */
export function googleCssUrl(families: string[], weights: number[] = GOOGLE_PREFERRED_WEIGHTS) {
  const parts = (families || [])
    .filter(Boolean)
    .map((f) => {
      const name = f.replace(/ /g, '+');
      return weights && weights.length
        ? `family=${name}:wght@${weights.join(';')}`
        : `family=${name}`;
    });
  return `${GOOGLE_CSS_BASE}?${parts.join('&')}&display=swap`;
}

export type GoogleFontCheck = {
  ok: boolean;
  family: string;
  css_url: string;
  weights: number[];
};

/**
 * Pastikan family-nya benar-benar ada di Google Fonts.
 * Google mengembalikan 400 kalau nama family atau ketebalannya tidak dikenal,
 * jadi kita coba dulu dengan 400;700 lalu jatuh ke reguler saja.
 */
export async function verifyGoogleFamily(familyRaw: string): Promise<GoogleFontCheck> {
  const family = normalizeGoogleFamily(familyRaw);
  if (family.length < 2) return { ok: false, family, css_url: '', weights: [] };

  const attempts: number[][] = [GOOGLE_PREFERRED_WEIGHTS, []];
  for (const weights of attempts) {
    const url = googleCssUrl([family], weights);
    try {
      const res = await fetch(url, {
        // UA modern supaya Google mengembalikan CSS woff2
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
        },
        cache: 'no-store',
      });
      if (!res.ok) continue;
      const css = await res.text();
      if (!/@font-face/i.test(css)) continue;
      return { ok: true, family, css_url: url, weights };
    } catch {
      /* coba percobaan berikutnya */
    }
  }
  return { ok: false, family, css_url: '', weights: [] };
}

export const GOOGLE_FONT_GUIDE = {
  intro:
    'Font Google dipakai langsung dari CDN Google — tidak ada berkas yang perlu diunduh atau diunggah.',
  tips: [
    'Cukup pilih dari daftar atau ketik nama family-nya, misalnya "Bebas Neue".',
    'Ketebalan Regular (400) dan Bold (700) diambil otomatis bila tersedia.',
    'Font Google gratis dipakai untuk keperluan komersial (lisensi OFL/Apache).',
    'Karena dimuat dari CDN Google, tidak menambah beban penyimpanan R2.',
  ],
};
