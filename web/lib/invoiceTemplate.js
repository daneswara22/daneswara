/**
 * Template invoice Daneswara — SATU sumber untuk dua keluaran:
 *   1. Print Desktop/PC  -> A6 Portrait 105 x 148 mm (lib/printer.js)
 *   2. Bagikan sebagai Gambar -> dipakai di semua perangkat
 *      (components/ReceiptShareCard.jsx)
 *
 * Print dari HP/tablet TIDAK memakai berkas ini; jalur itu tetap memakai struk
 * lama `buildLegacyReceiptHtml()` di lib/printer.js tanpa perubahan.
 *
 * Catatan teknis penting:
 *   Seluruh selector CSS di bawah diawali `.dnsw-inv`, jadi saat markup ini
 *   dipasang di dalam aplikasi (untuk dirender menjadi gambar) tidak ada satu
 *   pun style global yang bocor dan mengubah tampilan halaman lain.
 *
 *   Ukuran memakai satuan pt/mm. Di layar 1mm dirender ~3.78px, sehingga
 *   proporsi gambar hasil share identik dengan hasil cetak A6.
 *
 * Modul ini TIDAK menghitung apa pun. Semua angka (subtotal, deposit, total,
 * harga, qty) dan teks (nomor invoice, pelanggan, kasir, status, catatan)
 * dipakai apa adanya dari objek transaksi yang sudah ada.
 */

/** Lebar area isi = A6 (105mm) dikurangi margin cetak 5mm kiri+kanan. */
export const INVOICE_CONTENT_WIDTH_MM = 95;

/** Identitas & rekening toko (konstanta merek, bukan data transaksi). */
const BRAND = {
  address: 'Jl. Gunung Shangyang 156, Denpasar - Bali',
  phone: '+62 858 8810 2930',
  website: 'www.daneswara.com',
  banks: [
    { name: 'BCA', no: '6115123231', logo: '/assets/banks/bca.webp' },
    { name: 'BRI', no: '055601029054502', logo: '/assets/banks/bri.webp' },
  ],
  holder: 'Made Surya Darma',
  /**
   * QRIS statis milik toko. Berkasnya dibuat ulang dari payload EMVCo asli
   * (merchant DANESWARA HO, acquirer BCA, Denpasar 80117, mata uang IDR)
   * supaya modulnya tajam saat dicetak kecil. 41 modul + quiet zone 4 modul.
   */
  qris: { image: '/assets/qris/daneswara-qris.png', label: 'QRIS' },
};

const QUOTE_NOTE =
  'Pesanan akan mulai diproses/dikerjakan setelah <b>pembayaran penuh (payment) atau deposit</b> diterima dan dikonfirmasi.';

/* ------------------------------------------------------------------ */
/* Anggaran tinggi halaman untuk baris kosong tabel order              */
/* ------------------------------------------------------------------ */

/**
 * Tabel order diisi baris kosong supaya invoice tidak menggantung saat ordernya
 * sedikit. Jumlahnya DINAMIS: dihitung dari sisa ruang vertikal A6 setelah
 * semua blok lain (header, info pelanggan, tanggal/invoice, baris order,
 * pembayaran, ringkasan, status, catatan, catatan penawaran, footer) diukur.
 *
 * Semua angka di bawah diturunkan dari nilai yang dipakai `buildInvoiceCss()`
 * di atas. Kalau CSS-nya diubah, konstanta di sini ikut disesuaikan.
 */
const MM_PER_PT = 0.3527777778;
/** A6 portrait 148mm dikurangi margin cetak @page 5mm atas + bawah. */
const PAGE_CONTENT_HEIGHT_MM = 138;
/** Sisa ruang yang sengaja tidak dipakai, bantalan untuk pembulatan browser. */
const FIT_SAFETY_MM = 2;

/** Tinggi satu baris teks dalam mm. */
const lineMm = (sizePt, lineHeight = 1.3) => sizePt * lineHeight * MM_PER_PT;

/**
 * Tinggi logo = dari batas atas tulisan "INVOICE" sampai batas bawah baris
 * telepon/website, jadi logo persis sejajar dengan blok teks di sebelahnya.
 * Dihitung dari nilai font yang sama dengan `.ihead`, bukan angka tetap, supaya
 * ikut menyesuaikan kalau ukuran fontnya diubah.
 */
const HEAD_LOGO_HEIGHT_MM = 17 * 0.92 * MM_PER_PT + 1 + lineMm(7.6) + lineMm(6.6, 1.28) * 2;

/**
 * Sisi QRIS di kotak pembayaran. 14mm membuat area modulnya ~11,7mm untuk 41
 * modul (~0,29mm per modul), masih nyaman dipindai tapi tidak mendominasi
 * kotak pembayaran yang lebarnya 45mm.
 */
const QRIS_SIZE_MM = 14;
/** Ukuran teks label "QRIS" di samping kode. */
const QRIS_CAPTION_PT = 5.2;

/**
 * Perkiraan jumlah baris setelah teks membungkus.
 * Lebar karakter rata-rata Arial diambil sedikit lebih lebar dari aslinya,
 * supaya hasilnya cenderung melebihkan tinggi — lebih aman daripada kurang.
 */
function wrapLines(text, sizePt, widthMm, bold = false) {
  const len = String(text == null ? '' : text).length;
  if (!len) return 1;
  const charMm = sizePt * (bold ? 0.58 : 0.54) * MM_PER_PT;
  return Math.max(1, Math.ceil((len * charMm) / widthMm));
}

/** Lebar kolom KETERANGAN = lebar isi - kolom harga/jml/total, dikurangi padding. */
const DESC_COL_WIDTH_MM = INVOICE_CONTENT_WIDTH_MM - 20 - 9 - 21 - 1.2 * 2;
/** Dua kolom .iinfo berbagi lebar isi dengan gap 3mm. */
const INFO_COL_WIDTH_MM = (INVOICE_CONTENT_WIDTH_MM - 3) / 2;
/** Lebar teks .iquote = lebar isi - padding kiri/kanan - ikon - gap. */
const QUOTE_TEXT_WIDTH_MM = INVOICE_CONTENT_WIDTH_MM - 1.6 * 2 - 3.4 - 1.5;

/** Tinggi satu baris order, termasuk baris catatan/diskon di bawah namanya. */
function itemRowHeightMm(nameLines, subLines) {
  return 1.3 * 2 + lineMm(7.2) * nameLines + (subLines ? lineMm(6.4) * subLines : 0);
}

/** Tinggi baris kosong = tinggi baris order satu baris, agar tabel terlihat natural. */
const EMPTY_ROW_HEIGHT_MM = itemRowHeightMm(1, 0);

/**
 * Hitung berapa baris kosong yang masih muat di bawah baris order terakhir.
 *
 * Mengembalikan 0 kalau ordernya sudah memenuhi area tabel, sehingga invoice
 * tetap satu lembar A6 dan tidak ada blok yang terpotong.
 */
function countFillerRows({ itemRows, hasCashier, docNo, customerName, note, summaryRowCount, address }) {
  // Header: kolom teks di kiri, logo rata kanan dengan tinggi yang sama.
  const headTextMm =
    17 * 0.92 * MM_PER_PT +
    1 +
    lineMm(7.6) +
    lineMm(6.6, 1.28) * wrapLines(address, 6.6, 70) +
    lineMm(6.6, 1.28);
  const headMm = Math.max(headTextMm, HEAD_LOGO_HEIGHT_MM);

  const ruleMm = 1.8 + 1.1 * MM_PER_PT + 2;

  // Info transaksi: tinggi kolom yang paling panjang.
  const infoLeftMm =
    lineMm(6.8) +
    lineMm(7.2) * wrapLines(customerName, 7.2, INFO_COL_WIDTH_MM) +
    (hasCashier ? 1.3 + lineMm(6.8) + lineMm(7.2) : 0);
  const infoRightMm =
    lineMm(6.8) +
    lineMm(7.2) * 2 +
    1.3 +
    lineMm(6.8) +
    lineMm(7.2) * wrapLines(docNo, 7.2, INFO_COL_WIDTH_MM);
  const infoMm = Math.max(infoLeftMm, infoRightMm);

  // Tabel: margin atas + kepala tabel + garis penutup di baris terakhir.
  const tableChromeMm = 2.4 + 1.1 * MM_PER_PT * 2 + 1 * 2 + lineMm(6.8) + 1.1 * MM_PER_PT;

  // Pembayaran: kotak rekening vs tabel ringkasan, diambil yang lebih tinggi.
  // Baris terakhir kotak rekening setinggi QRIS, atau dua baris nama rekening
  // kalau namanya panjang - diambil yang lebih besar. Label "QRIS" berada di
  // samping kodenya, jadi tidak menambah tinggi.
  const bankFootMm = Math.max(lineMm(6.6) * 2, QRIS_SIZE_MM);
  const bankMm =
    0.8 * MM_PER_PT * 2 +
    1.5 * 2 +
    lineMm(7) +
    BRAND.banks.length * (1 + Math.max(3.2, lineMm(7))) +
    (1.3 + 0.6 * MM_PER_PT + 1) +
    bankFootMm;
  const sumNormalMm = 0.5 * 2 + lineMm(7.2);
  const sumGrandMm = 1.1 * MM_PER_PT + 1.4 + 0.5 + lineMm(10.5);
  const sumMm = (summaryRowCount - 1) * sumNormalMm + 0.9 + sumGrandMm;
  const payMm = 2.4 + Math.max(bankMm, sumMm);

  const statMm = 2.4 + 1 * MM_PER_PT * 2 + 1.3 * 2 + lineMm(8.2);

  const noteMm = note ? 1.8 + lineMm(6.8) * wrapLines(note, 6.8, INVOICE_CONTENT_WIDTH_MM) : 0;

  const quoteTextMm =
    lineMm(6.2) * wrapLines(QUOTE_NOTE.replace(/<[^>]*>/g, ''), 6.2, QUOTE_TEXT_WIDTH_MM);
  const quoteMm = 1.8 + 1.4 * 2 + Math.max(3.4, quoteTextMm);

  // Penutup kini hanya satu baris ucapan terima kasih.
  const footMm = 3 + lineMm(7.2);

  const itemsMm = itemRows.reduce((s, h) => s + h, 0);

  const usedMm =
    headMm + ruleMm + infoMm + tableChromeMm + itemsMm + payMm + statMm + noteMm + quoteMm + footMm;

  const freeMm = PAGE_CONTENT_HEIGHT_MM - usedMm - FIT_SAFETY_MM;
  if (freeMm < EMPTY_ROW_HEIGHT_MM) return 0;
  return Math.floor(freeMm / EMPTY_ROW_HEIGHT_MM);
}

export const esc = (v) =>
  String(v == null ? '' : v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** Deteksi Desktop/PC untuk memilih template cetak. */
export function isDesktopPrintDevice() {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') return false;
  const ua = navigator.userAgent || '';

  const hints = navigator.userAgentData;
  if (hints && typeof hints.mobile === 'boolean' && hints.mobile) return false;

  if (
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|BB10|IEMobile|Opera Mini|Mobile|Tablet|Silk|Kindle|PlayBook|Windows Phone/i.test(
      ua,
    )
  ) {
    return false;
  }

  // iPadOS 13+ menyamar sebagai macOS desktop; dikenali dari titik sentuh.
  if (/Macintosh/i.test(ua) && Number(navigator.maxTouchPoints) > 1) return false;

  return true;
}

/* ------------------------------------------------------------------ */
/* CSS (ter-scope ke .dnsw-inv)                                        */
/* ------------------------------------------------------------------ */

/**
 * Konversi satuan.
 *
 * Mesin cetak menangani mm/pt dengan presisi tinggi, tapi html2canvas (dipakai
 * untuk "Bagikan sebagai Gambar") membulatkan mm/pt per elemen sehingga garis
 * tabel bergeser dan spacing melonggar. Karena itu untuk mode 'image' semua
 * ukuran dihitung dulu menjadi px bulat memakai faktor tetap, agar hasil gambar
 * identik dengan hasil cetak.
 *
 * 1mm = 3.7795275591px, 1pt = 1.3333333px pada 96dpi.
 */
const PX_PER_MM = 3.7795275591;
const PX_PER_PT = 1.3333333;
/** Pengali resolusi mode gambar (2x) — dipadu scale html2canvas = gambar tajam. */
export const IMAGE_UNIT_SCALE = 2;

function units(mode) {
  if (mode === 'image') {
    const r = (v) => `${Math.round(v * 100) / 100}px`;
    return {
      m: (x) => r(x * PX_PER_MM * IMAGE_UNIT_SCALE),
      p: (x) => r(x * PX_PER_PT * IMAGE_UNIT_SCALE),
    };
  }
  return { m: (x) => `${x}mm`, p: (x) => `${x}pt` };
}

/**
 * Bangun CSS invoice.
 * @param {'print'|'image'} mode 'print' -> mm/pt, 'image' -> px (html2canvas)
 */
export function buildInvoiceCss(mode = 'print') {
  const { m, p } = units(mode);
  return `
.dnsw-inv, .dnsw-inv * { box-sizing: border-box; margin: 0; padding: 0; }
.dnsw-inv {
  width: ${m(INVOICE_CONTENT_WIDTH_MM)};
  background: #fff; color: #000;
  font-family: Arial, Helvetica, "Liberation Sans", sans-serif;
  font-size: ${p(7.2)}; line-height: 1.3;
  -webkit-print-color-adjust: exact; print-color-adjust: exact;
}
/* border-collapse: separate + spacing 0 dipakai sengaja: dengan 'collapse',
   html2canvas menggabung garis yang bersebelahan dan menggesernya. */
.dnsw-inv table { width: 100%; border-collapse: separate; border-spacing: 0; }

/* ---- Header: INVOICE besar di kiri, logo rata kanan ---- */
.dnsw-inv .ihead { display: flex; align-items: flex-start; justify-content: space-between; gap: ${m(2.5)}; }
.dnsw-inv .ihead-l { flex: 1 1 auto; min-width: 0; }
.dnsw-inv .ihead h1 {
  font-size: ${p(17)}; font-weight: 800; letter-spacing: ${p(-0.6)}; line-height: 0.92;
}
.dnsw-inv .ihead .biz { margin-top: ${m(1)}; font-size: ${p(7.6)}; font-weight: 700; }
.dnsw-inv .ihead .ct { font-size: ${p(6.6)}; line-height: 1.28; }
.dnsw-inv .ihead .ct b { font-weight: 700; }
.dnsw-inv .ihead-logo { flex: 0 0 auto; margin-left: auto; }
/* Tinggi logo dipatok eksplisit (bukan max-height) karena html2canvas
   mengabaikan max-height + object-fit dan logo jadi kebesaran.
   Nilainya = tinggi blok teks di sebelah kiri, dari batas atas "INVOICE"
   sampai batas bawah baris website. Logo usaha yang sudah ada, hanya
   di-mirror horizontal. */
.dnsw-inv .ihead-logo img {
  display: block; height: ${m(HEAD_LOGO_HEIGHT_MM)}; width: auto; object-fit: contain;
  transform: scaleX(-1);
}
.dnsw-inv .rule { border-top: ${p(1.1)} solid #000; margin: ${m(1.8)} 0 ${m(2)}; }

/* ---- Informasi transaksi: dua sisi ---- */
.dnsw-inv .iinfo { display: flex; gap: ${m(3)}; }
.dnsw-inv .iinfo .c { flex: 1 1 0; min-width: 0; }
.dnsw-inv .iinfo .c.r { text-align: right; }
.dnsw-inv .lbl { font-size: ${p(6.8)}; font-weight: 800; letter-spacing: ${p(0.2)}; }
.dnsw-inv .val { font-size: ${p(7.2)}; word-break: break-word; }
.dnsw-inv .sp { margin-top: ${m(1.3)}; }

/* ---- Tabel produk: KETERANGAN | HARGA / UNIT | JML | TOTAL ---- */
.dnsw-inv .iitems { margin-top: ${m(2.4)}; }
.dnsw-inv .iitems th {
  font-size: ${p(6.8)}; font-weight: 800; letter-spacing: ${p(0.2)}; background: #f0f0f0;
  border-top: ${p(1.1)} solid #000; border-bottom: ${p(1.1)} solid #000;
  padding: ${m(1)} ${m(1.2)}; text-align: left; vertical-align: bottom;
}
.dnsw-inv .iitems th.u, .dnsw-inv .iitems td.u { width: ${m(20)}; text-align: right; }
.dnsw-inv .iitems th.q, .dnsw-inv .iitems td.q { width: ${m(9)}; text-align: center; }
.dnsw-inv .iitems th.t, .dnsw-inv .iitems td.t { width: ${m(21)}; text-align: right; }
.dnsw-inv .iitems td { padding: ${m(1.3)} ${m(1.2)}; vertical-align: middle; }
.dnsw-inv .iitems td.u, .dnsw-inv .iitems td.t { white-space: nowrap; }
.dnsw-inv .iitems tbody tr:last-child td { border-bottom: ${p(1.1)} solid #000; }
.dnsw-inv .iitems .nm { display: block; font-weight: 700; }
.dnsw-inv .iitems .nt { display: block; font-size: ${p(6.4)}; }
.dnsw-inv .iitems tr { page-break-inside: avoid; break-inside: avoid; }
.dnsw-inv .iitems thead { display: table-header-group; }

/* ---- Pembayaran (kiri) + ringkasan (kanan) ---- */
.dnsw-inv .ipay { display: flex; align-items: flex-start; gap: ${m(3)}; margin-top: ${m(2.4)}; }
.dnsw-inv .ibank {
  flex: 0 0 ${m(45)}; border: ${p(0.8)} solid #000; border-radius: ${m(1.2)};
  padding: ${m(1.5)} ${m(1.8)};
}
.dnsw-inv .ibank .bt { font-size: ${p(7)}; font-weight: 800; }
.dnsw-inv .ibank .br { display: flex; align-items: baseline; gap: ${m(1.5)}; margin-top: ${m(1)}; }
.dnsw-inv .ibank .br { align-items: center; }
/* Kolom logo bank berlebar tetap supaya nomor rekening tetap sejajar. */
.dnsw-inv .ibank .bn {
  flex: 0 0 ${m(11)}; display: flex; align-items: center;
  font-size: ${p(7.4)}; font-weight: 800;
}
.dnsw-inv .ibank .bn img { display: block; height: ${m(3.2)}; width: auto; }
.dnsw-inv .ibank .bn i { font-style: italic; }
.dnsw-inv .ibank .bv { font-size: ${p(7)}; word-break: break-all; }
.dnsw-inv .ibank .bd { border-top: ${p(0.6)} solid #000; margin: ${m(1.3)} 0 ${m(1)}; }
.dnsw-inv .ibank .bh { font-size: ${p(6.6)}; }
.dnsw-inv .ibank .bh b { font-weight: 700; }
/* Baris bawah kotak pembayaran: nama rekening di kiri, QRIS kecil di kanan.
   Sengaja dibuat tidak mencolok - tanpa bingkai, label kecil abu-abu di samping
   kodenya (bukan di bawah, supaya tidak menambah tinggi halaman), dan
   diletakkan di sudut supaya tidak bersaing dengan nomor rekening. */
.dnsw-inv .ibank .bfoot {
  display: flex; align-items: center; justify-content: space-between; gap: ${m(1.5)};
}
.dnsw-inv .ibank .bfoot .bh { flex: 1 1 auto; min-width: 0; }
.dnsw-inv .ibank .bqr { flex: 0 0 auto; display: flex; align-items: center; gap: ${m(1)}; }
.dnsw-inv .ibank .bqr img {
  display: block; height: ${m(QRIS_SIZE_MM)}; width: ${m(QRIS_SIZE_MM)};
}
.dnsw-inv .ibank .bqr span {
  font-size: ${p(QRIS_CAPTION_PT)}; font-weight: 700; letter-spacing: ${p(0.3)}; color: #555;
}

.dnsw-inv .isum { flex: 1 1 auto; }
.dnsw-inv .isum td { padding: ${m(0.5)} 0; font-size: ${p(7.2)}; border: 0; }
.dnsw-inv .isum tr.prelast td { padding-bottom: ${m(1.4)}; }
.dnsw-inv .isum td.l { text-align: left; white-space: nowrap; }
.dnsw-inv .isum td.v { text-align: right; white-space: nowrap; }
.dnsw-inv .isum tr.grand td {
  border-top: ${p(1.1)} solid #000; padding-top: ${m(1.4)}; font-weight: 800;
  font-size: ${p(10.5)};
}
/* Sisa pembayaran setelah dikurangi DP: hanya tampil pada invoice deposit. */
.dnsw-inv .isum tr.due td {
  padding-top: ${m(1)}; font-weight: 800; font-size: ${p(8.2)};
}

/* ---- Status pembayaran (dinamis) ---- */
.dnsw-inv .istat {
  margin-top: ${m(2.4)}; border: ${p(1)} solid #000; padding: ${m(1.3)};
  text-align: center; font-size: ${p(8.2)}; font-weight: 800; letter-spacing: ${p(0.4)};
}

/* ---- Catatan transaksi + catatan penawaran ---- */
.dnsw-inv .inote { margin-top: ${m(1.8)}; font-size: ${p(6.8)}; }
.dnsw-inv .inote b { font-weight: 700; }
.dnsw-inv .iquote {
  display: flex; align-items: center; gap: ${m(1.5)}; margin-top: ${m(1.8)};
  background: #f2f2f2; border-radius: ${m(1.2)}; padding: ${m(1.4)} ${m(1.6)};
  font-size: ${p(6.2)}; line-height: 1.3;
}
.dnsw-inv .iquote .ic {
  flex: 0 0 auto; width: ${m(3.4)}; height: ${m(3.4)}; border-radius: 50%;
  background: #000; color: #fff; font-size: ${p(5.6)}; font-weight: 800;
  text-align: center; line-height: ${m(3.4)};
}
.dnsw-inv .iquote b { font-weight: 700; }

/* ---- Penutup: hanya satu baris ucapan terima kasih ---- */
.dnsw-inv .ithanks {
  margin-top: ${m(3)}; text-align: center;
  font-size: ${p(7.2)}; font-weight: 700;
  page-break-inside: avoid; break-inside: avoid;
}
`;
}

/** CSS untuk print A6 (mm/pt). Dipakai lib/printer.js. */
export const INVOICE_CSS = buildInvoiceCss('print');

/** CSS untuk share gambar (px) agar html2canvas tidak menggeser garis/spacing. */
export const INVOICE_CSS_IMAGE = buildInvoiceCss('image');

/** Padding tepi kartu gambar, setara margin cetak A6 5mm. */
export const IMAGE_PADDING_PX = Math.round(5 * PX_PER_MM * IMAGE_UNIT_SCALE * 100) / 100;

/* ------------------------------------------------------------------ */
/* Markup                                                              */
/* ------------------------------------------------------------------ */

/**
 * Bangun isi invoice (tanpa <html>), memakai kelas ber-scope `.dnsw-inv`.
 *
 * @param {object} r        transaksi/order existing — TIDAK dimodifikasi
 * @param {object} settings pengaturan toko existing
 * @param {object} helpers  { rp, paymentStatus, logo }
 */
export function buildInvoiceBody(r = {}, settings = {}, helpers = {}) {
  const rp =
    helpers.rp || ((n) => 'Rp' + Number(n || 0).toLocaleString('id-ID', { maximumFractionDigits: 0 }));
  const statusOf = helpers.paymentStatus || (() => '');
  const logo = helpers.logo || '';

  // Aset lokal dipanggil dengan URL absolut supaya tetap termuat di dalam
  // iframe cetak (about:blank) maupun saat dirender html2canvas.
  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  const address = settings.address || BRAND.address;
  const phone = settings.phone || BRAND.phone;

  const docNo = r.invoice || r.order_number || '-';
  const created = r.created_at ? new Date(r.created_at) : new Date();
  const tanggal = created.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
  const jam = created.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

  const items = r.items || [];

  // Baris produk: nama di baris utama, catatan per item tepat di bawahnya.
  // Tinggi tiap baris ikut dicatat, dipakai menghitung sisa ruang halaman.
  const itemRowHeights = [];
  const rows = items
    .map((i) => {
      const qty = Number(i.qty) || 0;
      const price = Number(i.price) || 0;
      const disc = Number(i.disc) || 0;
      const sub = [];
      if (i.note) sub.push(esc(i.note));
      if (disc > 0) sub.push(`Diskon ${rp(disc * qty)}`);
      const subText = sub.join(' - ');
      itemRowHeights.push(
        itemRowHeightMm(
          wrapLines(i.name, 7.2, DESC_COL_WIDTH_MM, true),
          subText ? wrapLines(subText, 6.4, DESC_COL_WIDTH_MM) : 0,
        ),
      );
      return `<tr>
        <td><span class="nm">${esc(i.name)}</span>${sub.length ? `<span class="nt">${sub.join(' &middot; ')}</span>` : ''}</td>
        <td class="u">${rp(price)}</td>
        <td class="q">${qty}</td>
        <td class="t">${rp(price * qty)}</td>
      </tr>`;
    })
    .join('');

  // JUMLAH ITEM hanya menjumlahkan qty yang sudah ada (bukan perhitungan baru).
  const jumlahItem = items.reduce((s, i) => s + (Number(i.qty) || 0), 0);

  const sum = [['JUMLAH ITEM', String(jumlahItem), false], ['SUB TOTAL', rp(r.subtotal), false]];
  if (r.discount) sum.push(['DISKON', '-' + rp(r.discount), false]);
  if (r.tax) sum.push([`PAJAK (${esc(r.tax_rate)}%)`, rp(r.tax), false]);
  const depositAmount = Number(r.deposit_amount) || 0;
  sum.push(['DEPOSIT (DP)', rp(depositAmount), false]);
  sum.push(['TOTAL', rp(r.total), true]);
  // Invoice deposit: tampilkan sisa pembayaran supaya pelanggan tahu nominal
  // pelunasan. Angkanya memakai `remaining` dari transaksi; bila field itu
  // belum ada (data lama), dipakai TOTAL dikurangi DP sebagai penggantinya.
  if (depositAmount > 0) {
    const remaining = Number.isFinite(Number(r.remaining))
      ? Math.max(0, Number(r.remaining))
      : Math.max(0, (Number(r.total) || 0) - depositAmount);
    sum.push(['SISA PEMBAYARAN', rp(remaining), false, 'due']);
  }
  const grandIdx = sum.findIndex(([, , g]) => g);
  const sumRows = sum
    .map(([l, v, g, extra], i) => {
      // Baris tepat sebelum TOTAL diberi jarak bawah agar teksnya tidak
      // menyentuh garis pemisah di atas TOTAL.
      const cls = [g ? 'grand' : '', i === grandIdx - 1 ? 'prelast' : '', extra || '']
        .filter(Boolean)
        .join(' ');
      return `<tr class="${cls}"><td class="l">${l}</td><td class="v">${v}</td></tr>`;
    })
    .join('');

  // Baris kosong dinamis: mengisi sisa ruang A6 di bawah baris order terakhir,
  // supaya tabel tidak menggantung saat ordernya sedikit. Bila order sudah
  // memenuhi area tabel, hasilnya 0 dan tidak ada baris tambahan.
  const fillerCount = countFillerRows({
    itemRows: itemRowHeights,
    hasCashier: Boolean(r.cashier),
    docNo,
    customerName: r.customer_name || 'Pelanggan',
    note: r.note,
    summaryRowCount: sum.length,
    address,
  });
  const fillerRows = '<tr><td><span class="nm">&nbsp;</span></td><td class="u"></td><td class="q"></td><td class="t"></td></tr>'.repeat(
    fillerCount,
  );

  // Logo bank dipakai menggantikan teks. Bila berkasnya gagal dimuat, teks nama
  // bank tetap muncul sebagai pengganti supaya nomor rekening tidak kehilangan
  // keterangan.
  const bankRows = BRAND.banks
    .map(
      (b) => `<div class="br">
        <span class="bn">
          <img src="${esc(origin + b.logo)}" alt="${esc(b.name)}" crossorigin="anonymous"
               onerror="this.insertAdjacentHTML('afterend','<i>${esc(b.name)}</i>');this.remove()"/>
        </span>
        <span class="bv">${esc(b.no)}</span>
      </div>`,
    )
    .join('');

  return `<div class="dnsw-inv">
  <div class="ihead">
    <div class="ihead-l">
      <h1>INVOICE</h1>
      <div class="biz">${esc(settings.business_name || 'Daneswara Print')}</div>
      <div class="ct">${esc(address)}</div>
      <div class="ct">${esc(phone)} | <b>${esc(BRAND.website)}</b></div>
    </div>
    <div class="ihead-logo">
      ${logo ? `<img src="${esc(logo)}" alt="" crossorigin="anonymous" onerror="this.style.display='none'"/>` : ''}
    </div>
  </div>
  <div class="rule"></div>

  <div class="iinfo">
    <div class="c">
      <div class="lbl">KEPADA :</div>
      <div class="val">${esc(r.customer_name || 'Pelanggan')}</div>
      ${r.cashier ? `<div class="lbl sp">KASIR :</div><div class="val">${esc(r.cashier)}</div>` : ''}
    </div>
    <div class="c r">
      <div class="lbl">TANGGAL :</div>
      <div class="val">${esc(tanggal)}</div>
      <div class="val">${esc(jam)}</div>
      <div class="lbl sp">NO INVOICE :</div>
      <div class="val">${esc(docNo)}</div>
    </div>
  </div>

  <table class="iitems">
    <thead><tr><th>KETERANGAN</th><th class="u">HARGA / UNIT</th><th class="q">JML</th><th class="t">TOTAL</th></tr></thead>
    <tbody>${rows}${fillerRows}</tbody>
  </table>

  <div class="ipay">
    <div class="ibank">
      <div class="bt">PEMBAYARAN :</div>
      ${bankRows}
      <div class="bd"></div>
      <div class="bfoot">
        <div class="bh">Rekening An: <b>${esc(BRAND.holder)}</b></div>
        <div class="bqr">
          <span>${esc(BRAND.qris.label)}</span>
          <img src="${esc(origin + BRAND.qris.image)}" alt="QRIS" crossorigin="anonymous"
               onerror="this.parentNode.style.display='none'"/>
        </div>
      </div>
    </div>
    <table class="isum">${sumRows}</table>
  </div>

  <div class="istat">${esc(statusOf(r))}</div>

  ${r.note ? `<div class="inote"><b>Catatan :</b> ${esc(r.note)}</div>` : ''}

  <div class="iquote"><span class="ic">i</span><span>${QUOTE_NOTE}</span></div>

  <div class="ithanks">${esc(settings.receipt_footer || 'Terima kasih telah berbelanja!')}</div>
</div>`;
}

/**
 * Dokumen HTML lengkap untuk print Desktop/PC (A6 Portrait 105 x 148 mm).
 * @page hanya ada di sini, jadi tidak mungkin memengaruhi print perangkat lain.
 */
export function buildDesktopInvoiceHtml(r, settings = {}, helpers = {}) {
  const docNo = (r && (r.invoice || r.order_number)) || 'Invoice';
  return `<!DOCTYPE html>
<html lang="id"><head><meta charset="utf-8"><title>${esc(docNo)}</title>
<style>
@page { size: 105mm 148mm portrait; margin: 5mm; }
html, body { margin: 0; padding: 0; background: #fff; }
${INVOICE_CSS}
/* Saat dicetak, lebar diatur oleh margin @page, bukan lebar tetap. */
.dnsw-inv { width: auto; }
</style></head>
<body>${buildInvoiceBody(r, settings, helpers)}</body></html>`;
}
