/**
 * Pemecah palet warna dari satu gambar (browser only).
 *
 * Dipakai di halaman admin "Jenis Produk" -> Kelola Warna, supaya admin bisa
 * mengunggah SATU gambar yang berisi banyak lingkaran/kotak warna (seperti
 * lembar katalog warna dari supplier) lalu otomatis dipecah menjadi satu
 * varian warna per warna yang terdeteksi.
 *
 * Cara kerjanya sederhana dan seluruhnya di sisi klien (tanpa upload):
 *   1. gambar digambar ke <canvas> dan diperkecil supaya ringan
 *   2. piksel latar (putih / abu sangat terang) dibuang
 *   3. sisa piksel dikelompokkan sebagai "blob" bersambung (connected component)
 *   4. tiap blob yang cukup besar diambil warna modusnya (bukan rata-rata,
 *      supaya tidak tercampur garis tepi anti-alias)
 *   5. blob diurutkan baris-per-baris (atas ke bawah, kiri ke kanan)
 *
 * Kalau gambarnya bukan lembar palet (mis. foto produk) dan blob-nya tidak
 * masuk akal, dipakai jalur cadangan: klaster berdasarkan frekuensi warna.
 */

const MAX_EDGE = 480; // cukup untuk mendeteksi puluhan swatch, tetap ringan

/* ------------------------------------------------------------------ utils */

export function rgbToHex(r, g, b) {
  const h = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`.toUpperCase();
}

function dist(a, b) {
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

/** Latar dianggap putih / abu sangat terang (termasuk cincin tepi swatch). */
function isBackground(r, g, b, a) {
  if (a < 128) return true;
  if (r > 222 && g > 222 && b > 222) return true;
  return false;
}

async function loadImageData(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Gambar tidak bisa dibaca"));
      el.src = url;
    });
    const scale = Math.min(1, MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, w, h);
    return { data: ctx.getImageData(0, 0, w, h).data, width: w, height: h, preview: canvas.toDataURL("image/png") };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/* ------------------------------------------------- warna modus dalam blob */

function modeColor(pixels) {
  // Kelompokkan ke bucket 4-bit/kanal lalu ambil bucket terbanyak, dan
  // rata-ratakan piksel asli di bucket itu. Ini menahan efek tepi anti-alias.
  const buckets = new Map();
  for (const p of pixels) {
    const key = ((p[0] >> 4) << 8) | ((p[1] >> 4) << 4) | (p[2] >> 4);
    let b = buckets.get(key);
    if (!b) { b = { n: 0, r: 0, g: 0, b: 0 }; buckets.set(key, b); }
    b.n += 1; b.r += p[0]; b.g += p[1]; b.b += p[2];
  }
  let best = null;
  for (const b of buckets.values()) if (!best || b.n > best.n) best = b;
  if (!best) return [0, 0, 0];
  return [best.r / best.n, best.g / best.n, best.b / best.n];
}

/* -------------------------------------------------------- blob extraction */

function blobSwatches({ data, width, height }) {
  const total = width * height;
  const labels = new Int32Array(total).fill(-1);
  const minArea = Math.max(24, Math.round(total * 0.0006));
  const stack = new Int32Array(total);
  const blobs = [];

  for (let start = 0; start < total; start += 1) {
    if (labels[start] !== -1) continue;
    const o = start * 4;
    if (isBackground(data[o], data[o + 1], data[o + 2], data[o + 3])) { labels[start] = -2; continue; }

    // flood fill 4-arah
    let sp = 0;
    stack[sp++] = start;
    labels[start] = blobs.length;
    const pixels = [];
    let sx = 0;
    let sy = 0;
    while (sp > 0) {
      const idx = stack[--sp];
      const x = idx % width;
      const y = (idx - x) / width;
      const off = idx * 4;
      pixels.push([data[off], data[off + 1], data[off + 2]]);
      sx += x; sy += y;

      const neighbours = [
        x > 0 ? idx - 1 : -1,
        x < width - 1 ? idx + 1 : -1,
        y > 0 ? idx - width : -1,
        y < height - 1 ? idx + width : -1,
      ];
      for (const n of neighbours) {
        if (n < 0 || labels[n] !== -1) continue;
        const no = n * 4;
        if (isBackground(data[no], data[no + 1], data[no + 2], data[no + 3])) { labels[n] = -2; continue; }
        labels[n] = blobs.length;
        stack[sp++] = n;
      }
    }

    if (pixels.length >= minArea) {
      blobs.push({ rgb: modeColor(pixels), area: pixels.length, x: sx / pixels.length, y: sy / pixels.length });
    } else {
      blobs.push(null); // tetap jaga penomoran label
    }
  }

  return blobs.filter(Boolean);
}

/* ------------------------------------------- cadangan: klaster frekuensi */

function frequencySwatches({ data, width, height }) {
  const buckets = new Map();
  let sampled = 0;
  for (let i = 0; i < width * height; i += 1) {
    const o = i * 4;
    if (isBackground(data[o], data[o + 1], data[o + 2], data[o + 3])) continue;
    sampled += 1;
    const key = ((data[o] >> 3) << 10) | ((data[o + 1] >> 3) << 5) | (data[o + 2] >> 3);
    let b = buckets.get(key);
    if (!b) { b = { n: 0, r: 0, g: 0, b: 0, x: 0, y: 0 }; buckets.set(key, b); }
    const x = i % width;
    b.n += 1; b.r += data[o]; b.g += data[o + 1]; b.b += data[o + 2];
    b.x += x; b.y += (i - x) / width;
  }
  if (!sampled) return [];
  const floor = Math.max(20, sampled * 0.004);
  return [...buckets.values()]
    .filter((b) => b.n >= floor)
    .sort((a, b) => b.n - a.n)
    .slice(0, 60)
    .map((b) => ({ rgb: [b.r / b.n, b.g / b.n, b.b / b.n], area: b.n, x: b.x / b.n, y: b.y / b.n }));
}

/* ------------------------------------------------------------ penamaan ID */

const NAMED = [
  ["Putih", [255, 255, 255]], ["Hitam", [17, 17, 17]], ["Abu Muda", [203, 208, 214]],
  ["Abu", [128, 128, 128]], ["Abu Tua", [85, 85, 85]], ["Navy", [43, 58, 103]],
  ["Biru Tua", [23, 43, 92]], ["Biru", [30, 100, 190]], ["Biru Muda", [110, 160, 220]],
  ["Biru Langit", [0, 130, 175]], ["Teal", [110, 160, 175]], ["Maroon", [91, 31, 31]],
  ["Merah", [225, 29, 36]], ["Merah Bata", [190, 70, 65]], ["Oranye", [247, 148, 29]],
  ["Oranye Tua", [252, 76, 2]], ["Kuning", [241, 196, 15]], ["Mustard", [175, 140, 45]],
  ["Hijau Daun", [39, 174, 96]], ["Hijau Tua", [30, 70, 55]], ["Hijau Army", [95, 110, 50]],
  ["Hijau Sage", [125, 165, 130]], ["Hijau Stabilo", [140, 200, 30]], ["Coklat", [110, 70, 45]],
  ["Coklat Tua", [60, 45, 40]], ["Krem", [200, 175, 150]], ["Baby Pink", [244, 184, 207]],
  ["Pink", [215, 30, 150]], ["Ungu", [110, 55, 150]], ["Lavender", [145, 135, 175]],
  ["Dusty Rose", [185, 130, 130]], ["Wine", [95, 60, 70]],
];

function suggestName(rgb) {
  let best = NAMED[0];
  let bestD = Infinity;
  for (const entry of NAMED) {
    const d = dist(rgb, entry[1]);
    if (d < bestD) { bestD = d; best = entry; }
  }
  return best[0];
}

function uniqueNames(items) {
  const used = new Map();
  return items.map((it) => {
    const base = suggestName(it.rgb);
    const n = (used.get(base) || 0) + 1;
    used.set(base, n);
    return { ...it, name: n === 1 ? base : `${base} ${n}` };
  });
}

/* -------------------------------------------------------------- pipeline */

/**
 * Inti algoritma: terima piksel RGBA mentah, kembalikan daftar warna terurut.
 * Dipisah dari canvas supaya bisa diuji di Node (lihat scripts/test-palette.ts).
 *
 * @param {{data: Uint8Array|Uint8ClampedArray|number[], width: number, height: number}} img
 * @returns {Array<{hex: string, name: string}>}
 */
export function splitPaletteFromPixels(img) {
  let swatches = blobSwatches(img);
  if (swatches.length < 2 || swatches.length > 300) swatches = frequencySwatches(img);

  // Gabungkan warna yang praktis kembar supaya tidak jadi varian ganda.
  const merged = [];
  for (const s of swatches.slice().sort((a, b) => b.area - a.area)) {
    if (merged.some((m) => dist(m.rgb, s.rgb) < 10)) continue;
    merged.push(s);
  }

  // Urutkan seperti orang membaca: baris atas dulu, lalu kiri ke kanan.
  const rowSize = Math.max(12, img.height / 24);
  merged.sort((a, b) => {
    const ra = Math.round(a.y / rowSize);
    const rb = Math.round(b.y / rowSize);
    if (ra !== rb) return ra - rb;
    return a.x - b.x;
  });

  return uniqueNames(merged).map((it) => ({
    hex: rgbToHex(it.rgb[0], it.rgb[1], it.rgb[2]),
    name: it.name,
  }));
}

/**
 * @param {File} file gambar berisi beberapa warna
 * @returns {Promise<{preview: string, colors: Array<{hex:string,name:string}>}>}
 */
export async function extractPaletteFromFile(file) {
  const img = await loadImageData(file);
  return { preview: img.preview, colors: splitPaletteFromPixels(img) };
}
