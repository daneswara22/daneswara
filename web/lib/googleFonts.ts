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
