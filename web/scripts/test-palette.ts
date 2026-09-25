/**
 * Tes pemecah palet warna (tanpa browser).
 *
 * Membuat "lembar palet" sintetis mirip gambar dari suplier: bulatan-bulatan
 * warna berjarak di atas latar putih, 3 baris. Lalu memastikan
 * splitPaletteFromPixels() mengembalikan tepat satu warna per bulatan,
 * urut baris-per-baris, dengan hex yang mendekati aslinya.
 *
 * Jalankan: npx tsx scripts/test-palette.ts   (dari folder web)
 */
// @ts-nocheck
import { splitPaletteFromPixels, rgbToHex } from '../lib/palette.js';

const ROWS: number[][][] = [
  [[34, 34, 34], [205, 208, 214], [128, 128, 128], [43, 58, 103], [91, 31, 31], [225, 29, 36]],
  [[30, 100, 190], [39, 174, 96], [241, 196, 15], [30, 70, 55], [85, 85, 85], [247, 148, 29]],
  [[244, 184, 207], [110, 55, 150], [110, 70, 45], [0, 130, 175], [215, 30, 150], [140, 200, 30]],
];

const R = 26;         // radius bulatan
const GAP = 18;       // jarak antar bulatan
const PAD = 20;

const cols = Math.max(...ROWS.map((r) => r.length));
const width = PAD * 2 + cols * (R * 2) + (cols - 1) * GAP;
const height = PAD * 2 + ROWS.length * (R * 2) + (ROWS.length - 1) * GAP;
const data = new Uint8ClampedArray(width * height * 4);

// latar putih
for (let i = 0; i < width * height; i += 1) {
  data[i * 4] = 255; data[i * 4 + 1] = 255; data[i * 4 + 2] = 255; data[i * 4 + 3] = 255;
}

const expected: string[] = [];
ROWS.forEach((row, ri) => {
  row.forEach((rgb, ci) => {
    expected.push(rgbToHex(rgb[0], rgb[1], rgb[2]));
    const cx = PAD + R + ci * (R * 2 + GAP);
    const cy = PAD + R + ri * (R * 2 + GAP);
    for (let y = cy - R; y <= cy + R; y += 1) {
      for (let x = cx - R; x <= cx + R; x += 1) {
        if ((x - cx) ** 2 + (y - cy) ** 2 > R * R) continue;
        const o = (y * width + x) * 4;
        data[o] = rgb[0]; data[o + 1] = rgb[1]; data[o + 2] = rgb[2]; data[o + 3] = 255;
      }
    }
  });
});

const found = splitPaletteFromPixels({ data, width, height });

let failures = 0;
const fail = (msg: string) => { failures += 1; console.log(`   ✗ ${msg}`); };

console.log(`▶ lembar palet ${width}x${height}, bulatan=${expected.length}`);
console.log(`   terdeteksi=${found.length}: ${found.map((c) => c.hex).join(' ')}`);

if (found.length !== expected.length) {
  fail(`jumlah warna: harap ${expected.length}, dapat ${found.length}`);
} else {
  found.forEach((c, i) => {
    const a = [parseInt(c.hex.slice(1, 3), 16), parseInt(c.hex.slice(3, 5), 16), parseInt(c.hex.slice(5, 7), 16)];
    const b = [parseInt(expected[i].slice(1, 3), 16), parseInt(expected[i].slice(3, 5), 16), parseInt(expected[i].slice(5, 7), 16)];
    const d = Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
    if (d > 12) fail(`urutan ${i + 1}: harap ~${expected[i]}, dapat ${c.hex} (jarak ${d.toFixed(1)})`);
  });
  if (found.some((c) => !c.name || !c.name.trim())) fail('ada warna tanpa nama');
  if (new Set(found.map((c) => c.name)).size !== found.length) fail('nama warna tidak unik');
}

if (failures) {
  console.log(`\n❌ ${failures} pemeriksaan gagal`);
  process.exit(1);
}
console.log('\n✅ Pemecah palet warna bekerja: 1 gambar -> banyak warna, urut & bernama unik.');
