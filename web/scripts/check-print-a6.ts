/**
 * Validasi minimal template invoice (tanpa browser, tanpa test agent):
 *   1. Print Desktop/PC  -> invoice A6 baru (105x148mm).
 *   2. Print mobile/device -> tetap struk lama (isDesktopPrintDevice = false).
 *   3. Share gambar      -> memakai markup invoice yang sama.
 *   4. Data & perhitungan transaksi tetap identik dengan sumber.
 * Jalankan: npx tsx scripts/check-print-a6.ts
 */
import {
  buildDesktopInvoiceHtml,
  buildInvoiceBody,
  isDesktopPrintDevice,
  INVOICE_CSS,
} from '../lib/invoiceTemplate.js';

const rp = (n: any) => 'Rp' + Number(n || 0).toLocaleString('id-ID', { maximumFractionDigits: 0 });
const paymentStatus = (r: any) =>
  r.__draft || r.status === 'Draft' ? 'BELUM DIBAYAR' : r.deposit_amount ? 'DEPOSIT' : 'LUNAS';

// Data sesuai contoh pada gambar referensi "FORMAT INVOICE".
const order = {
  order_number: 'ORD-261003-101',
  created_at: '2026-10-03T22:26:00',
  customer_name: 'Gili Surf Shop',
  cashier: 'Budi Kasir',
  items: [{ qty: 2, name: 'DTF Print A5', price: 13000, note: 'Pesanan sample sandbox' }],
  subtotal: 26000,
  total: 26000,
  deposit_amount: 0,
  note: 'Pesanan sample sandbox',
  status: 'Draft',
  __draft: true,
};
const settings = {
  business_name: 'Daneswara Print',
  address: 'Jl. Gunung Shangyang 156, Denpasar - Bali',
  phone: '+62 858 8810 2930',
};
const helpers = { rp, paymentStatus, logo: '/logo.png' };

let fail = 0;
const ok = (cond: boolean, label: string) => {
  console.log(`${cond ? 'OK  ' : 'GAGAL'} ${label}`);
  if (!cond) fail++;
};

const printHtml = buildDesktopInvoiceHtml(order, settings, helpers);
const shareBody = buildInvoiceBody(order, settings, helpers);

console.log('--- 1. Print Desktop/PC: invoice A6 baru ---');
ok(printHtml.includes('size: 105mm 148mm portrait'), 'Kertas A6 Portrait 105x148mm');
ok(printHtml.includes('margin: 5mm'), 'Margin cetak 5mm');

console.log('\n--- 2. Header mengikuti referensi ---');
ok(/font-size: 17pt/.test(INVOICE_CSS), 'INVOICE lebih kecil dari versi sebelumnya (17pt, dulu 21pt)');
ok(shareBody.includes('<h1>INVOICE</h1>'), 'INVOICE besar di kiri');
ok(/\.ihead \{ display: flex/.test(INVOICE_CSS), 'Logo berdekatan horizontal dengan INVOICE');
ok(/transform: scaleX\(-1\)/.test(INVOICE_CSS), 'Logo mirror horizontal, bentuk lain tidak diubah');
ok(shareBody.includes('Daneswara Print'), 'Nama usaha di bawah INVOICE');
ok(shareBody.includes('Jl. Gunung Shangyang 156, Denpasar - Bali'), 'Alamat');
ok(shareBody.includes('+62 858 8810 2930') && shareBody.includes('www.daneswara.com'), 'Telepon | website');
ok(shareBody.includes('class="rule"'), 'Garis horizontal penuh di bawah header');

console.log('\n--- 3. Informasi, tabel 4 kolom, ringkasan ---');
ok(shareBody.includes('KEPADA :') && shareBody.includes('Gili Surf Shop'), 'KEPADA + customer');
ok(shareBody.includes('KASIR :') && shareBody.includes('Budi Kasir'), 'KASIR + nama kasir');
ok(shareBody.includes('TANGGAL :') && shareBody.includes('Oktober 2026') && shareBody.includes('22.26'), 'TANGGAL + waktu');
ok(shareBody.includes('NO INVOICE :') && shareBody.includes('ORD-261003-101'), 'NO INVOICE tidak berubah');
ok(
  ['KETERANGAN', 'HARGA / UNIT', 'JML', 'TOTAL'].every((h) => shareBody.includes(h)),
  '4 kolom: KETERANGAN | HARGA / UNIT | JML | TOTAL',
);
ok(shareBody.includes('>DTF Print A5<'), 'Nama produk di baris utama');
ok(shareBody.includes('class="nt">Pesanan sample sandbox'), 'Catatan per item tepat di bawah nama produk');
ok(shareBody.includes('class="u">Rp13.000'), 'Harga satuan di kolom HARGA / UNIT');
ok(shareBody.includes('class="q">2'), 'Quantity di kolom JML');
ok(shareBody.includes('class="t">Rp26.000'), 'Total item di kolom TOTAL');

console.log('\n--- 4. Pembayaran + ringkasan + status ---');
ok(shareBody.includes('PEMBAYARAN :'), 'Box PEMBAYARAN');
ok(
  shareBody.includes('6115123231') && shareBody.includes('055601029054502'),
  'Nomor rekening BCA & BRI terbaru (tanpa sensor)',
);
ok(!shareBody.includes('**'), 'Tidak ada sisa angka tersensor');
ok(
  shareBody.includes('/assets/banks/bca.webp') && shareBody.includes('/assets/banks/bri.webp'),
  'Logo bank BCA & BRI dipakai sesuai nama bank',
);
ok(/onerror="[^"]*<i>BCA<\/i>/.test(shareBody), 'Ada fallback teks bila logo bank gagal dimuat');
ok(shareBody.includes('Made Surya Darma'), 'Rekening An');
ok(/flex: 0 0 45mm/.test(INVOICE_CSS), 'Box pembayaran compact (45mm), tidak terlalu besar');
ok(shareBody.includes('JUMLAH ITEM') && shareBody.includes('>2<'), 'JUMLAH ITEM');
ok(shareBody.includes('SUB TOTAL') && shareBody.includes(rp(order.subtotal)), 'SUB TOTAL identik');
ok(shareBody.includes('DEPOSIT (DP)'), 'DEPOSIT (DP)');
ok(shareBody.includes('class="grand"') && shareBody.includes('>TOTAL<'), 'TOTAL bold & menonjol');
ok(shareBody.includes('class="istat">BELUM DIBAYAR'), 'Status pembayaran dinamis (bukan hard-code)');
ok(shareBody.includes('Catatan :'), 'Catatan transaksi');
ok(shareBody.includes('pembayaran penuh (payment)'), 'Catatan penawaran');
ok(shareBody.includes('Terima kasih telah berbelanja!'), 'Footer');

console.log('\n--- 5. Status dinamis & nominal pada varian lain ---');
const paid = {
  ...order,
  __draft: false,
  status: 'Proses',
  deposit_amount: 10000,
  remaining: Number(order.total || 0) - 10000,
  note: '',
};
const h2 = buildInvoiceBody(paid, settings, helpers);
ok(h2.includes('class="istat">DEPOSIT'), 'Status berubah mengikuti transaksi');
ok(h2.includes('DEPOSIT (DP)') && h2.includes(rp(10000)), 'Nominal DP identik dengan sumber');
ok(
  h2.includes('>SISA PEMBAYARAN<') && h2.includes(rp(Number(order.total || 0) - 10000)),
  'Invoice deposit menampilkan SISA PEMBAYARAN setelah dikurangi DP',
);
ok(!shareBody.includes('>SISA PEMBAYARAN<'), 'Tanpa DP -> baris sisa pembayaran tidak dirender');
ok(!h2.includes('Catatan :'), 'Tanpa catatan -> area catatan tidak dirender');

console.log('\n--- 6. Pemisahan jalur cetak & kebocoran style ---');
ok(isDesktopPrintDevice() === false, 'Tanpa navigator (non-desktop) -> fallback struk lama');
const selectors = INVOICE_CSS.split('\n').filter((l) => /^[.@a-z]/i.test(l.trim()) && l.includes('{'));
ok(
  selectors.every((l) => l.trim().startsWith('.dnsw-inv')),
  `Semua ${selectors.length} selector ter-scope .dnsw-inv (tidak ada CSS global)`,
);
ok(!INVOICE_CSS.includes('@page'), '@page hanya di dokumen print, bukan di CSS bersama');
ok(printHtml.includes('@page'), '@page ada di dokumen print Desktop/PC');


/* ------------------------------------------------------------------ */
/* 7. Share gambar harus IDENTIK dengan hasil cetak                    */
/* ------------------------------------------------------------------ */
import { INVOICE_CSS_IMAGE, buildInvoiceCss, IMAGE_UNIT_SCALE } from '../lib/invoiceTemplate.js';

console.log('\n--- 7. Kesetaraan CSS cetak vs gambar ---');
{
  const PX_MM = 3.7795275591;
  const PX_PT = 1.3333333;
  const printCss = buildInvoiceCss('print');
  const imgCss = INVOICE_CSS_IMAGE;

  const strip = (s: string) => s.replace(/-?[\d.]+(mm|pt|px)/g, 'U');
  let f2 = 0;
  const ok2 = (c: boolean, l: string) => {
    console.log(`${c ? 'OK  ' : 'GAGAL'} ${l}`);
    if (!c) f2++;
  };

  // Struktur (selector, properti, urutan) harus sama persis.
  ok2(strip(printCss) === strip(imgCss), 'Struktur & properti CSS identik, hanya satuannya beda');

  // Mode gambar tidak boleh menyisakan mm/pt yang dibulatkan html2canvas.
  ok2(!/\d(mm|pt)\b/.test(imgCss), 'CSS gambar murni px (tanpa mm/pt)');
  ok2(/\d+mm/.test(printCss) && /\d+(\.\d+)?pt/.test(printCss), 'CSS cetak tetap memakai mm/pt');

  // Setiap nilai px harus = nilai cetak x faktor konversi x skala.
  const pv = [...printCss.matchAll(/(-?[\d.]+)(mm|pt)/g)];
  const iv = [...imgCss.matchAll(/(-?[\d.]+)px/g)];
  ok2(pv.length === iv.length, `Jumlah nilai ukuran sama (${pv.length} vs ${iv.length})`);
  let bad = 0;
  for (let i = 0; i < Math.min(pv.length, iv.length); i++) {
    const raw = parseFloat(pv[i][1]);
    const expect = raw * (pv[i][2] === 'mm' ? PX_MM : PX_PT) * IMAGE_UNIT_SCALE;
    if (Math.abs(expect - parseFloat(iv[i][1])) > 0.02) bad++;
  }
  ok2(bad === 0, `Semua ${pv.length} ukuran terkonversi tepat (selisih > 0.02px: ${bad})`);

  // Perbaikan khusus penyebab garis meleset & logo kebesaran.
  ok2(/border-collapse: separate/.test(imgCss), 'border-collapse: separate (garis tabel tidak bergeser)');
  ok2(!/border-collapse: collapse/.test(imgCss), 'Tidak ada border-collapse: collapse');
  ok2(/\.ihead-logo img \{[^}]*height:/.test(imgCss), 'Tinggi logo eksplisit (bukan max-height)');

  // Tiga perbaikan kerapian yang dilaporkan pada hasil share gambar.
  ok2(/\.iitems td \{[^}]*vertical-align: middle/.test(imgCss), 'Baris pesanan rata tengah vertikal');
  ok2(/\.isum tr\.prelast td \{ padding-bottom/.test(imgCss), 'Baris sebelum TOTAL diberi jarak dari garis');
  ok2(shareBody.includes('class="prelast"'), 'Baris DEPOSIT (DP) ditandai prelast');
  ok2(/\.iquote \{[^}]*align-items: center/.test(imgCss), 'Ikon "i" rata tengah terhadap teks');
  ok2(!/\.iquote \.ic \{[^}]*font-style: italic/.test(imgCss), 'Glyph "i" tidak italic agar pas di tengah bulatan');
  ok2(/\.ibank \.bn img \{[^}]*height:/.test(imgCss), 'Tinggi logo bank dipatok eksplisit');
  ok2(!/max-height:/.test(imgCss), 'Tidak ada deklarasi max-height (logo tidak kebesaran)');

  if (f2) {
    console.log(`\n${f2} pemeriksaan bagian 7 GAGAL.`);
    process.exit(1);
  }
}

console.log(fail === 0 ? '\nSemua pemeriksaan lolos.' : `\n${fail} pemeriksaan GAGAL.`);
process.exit(fail === 0 ? 0 : 1);
