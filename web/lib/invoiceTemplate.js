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
    { name: 'BCA', no: '6115123**231**' },
    { name: 'BRI', no: '0556010290545**02' },
  ],
  holder: 'Made Surya Darma',
};

const QUOTE_NOTE =
  'Pesanan akan mulai diproses/dikerjakan setelah <b>pembayaran penuh (payment) atau deposit</b> diterima dan dikonfirmasi.';

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

/* ---- Header: INVOICE besar di kiri, logo berdekatan di kanannya ---- */
.dnsw-inv .ihead { display: flex; align-items: flex-start; gap: ${m(2.5)}; }
.dnsw-inv .ihead-l { flex: 0 1 auto; min-width: 0; }
.dnsw-inv .ihead h1 {
  font-size: ${p(17)}; font-weight: 800; letter-spacing: ${p(-0.6)}; line-height: 0.92;
}
.dnsw-inv .ihead .biz { margin-top: ${m(1)}; font-size: ${p(7.6)}; font-weight: 700; }
.dnsw-inv .ihead .ct { font-size: ${p(6.6)}; line-height: 1.28; }
.dnsw-inv .ihead .ct b { font-weight: 700; }
.dnsw-inv .ihead-logo { flex: 0 0 auto; }
/* Tinggi logo dipatok eksplisit (bukan max-height) karena html2canvas
   mengabaikan max-height + object-fit dan logo jadi kebesaran.
   Logo usaha yang sudah ada, hanya di-mirror horizontal. */
.dnsw-inv .ihead-logo img {
  display: block; height: ${m(13)}; width: auto; object-fit: contain;
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
.dnsw-inv .iitems td { padding: ${m(1.1)} ${m(1.2)}; vertical-align: top; }
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
.dnsw-inv .ibank .bn { flex: 0 0 ${m(9)}; font-size: ${p(7.4)}; font-weight: 800; font-style: italic; }
.dnsw-inv .ibank .bv { font-size: ${p(7)}; word-break: break-all; }
.dnsw-inv .ibank .bd { border-top: ${p(0.6)} solid #000; margin: ${m(1.3)} 0 ${m(1)}; }
.dnsw-inv .ibank .bh { font-size: ${p(6.6)}; }
.dnsw-inv .ibank .bh b { font-weight: 700; }

.dnsw-inv .isum { flex: 1 1 auto; }
.dnsw-inv .isum td { padding: ${m(0.5)} 0; font-size: ${p(7.2)}; border: 0; }
.dnsw-inv .isum td.l { text-align: left; white-space: nowrap; }
.dnsw-inv .isum td.v { text-align: right; white-space: nowrap; }
.dnsw-inv .isum tr.grand td {
  border-top: ${p(1.1)} solid #000; padding-top: ${m(1.1)}; font-weight: 800;
  font-size: ${p(10.5)};
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
  display: flex; align-items: flex-start; gap: ${m(1.5)}; margin-top: ${m(1.8)};
  background: #f2f2f2; border-radius: ${m(1.2)}; padding: ${m(1.4)} ${m(1.6)};
  font-size: ${p(6.2)}; line-height: 1.3;
}
.dnsw-inv .iquote .ic {
  flex: 0 0 auto; width: ${m(3.4)}; height: ${m(3.4)}; border-radius: 50%;
  background: #000; color: #fff; font-size: ${p(5.6)}; font-weight: 800;
  text-align: center; line-height: ${m(3.4)}; font-style: italic;
}
.dnsw-inv .iquote b { font-weight: 700; }

/* ---- Footer ---- */
.dnsw-inv .ifoot {
  margin-top: ${m(3)}; text-align: center;
  page-break-inside: avoid; break-inside: avoid;
}
.dnsw-inv .ifoot .tk { font-size: ${p(13)}; font-weight: 800; letter-spacing: ${p(0.6)}; }
.dnsw-inv .ifoot .fs { font-size: ${p(6.8)}; margin-top: ${m(0.4)}; }
.dnsw-inv .ifoot .fc { font-size: ${p(6.4)}; }
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
  const rows = items
    .map((i) => {
      const qty = Number(i.qty) || 0;
      const price = Number(i.price) || 0;
      const disc = Number(i.disc) || 0;
      const sub = [];
      if (i.note) sub.push(esc(i.note));
      if (disc > 0) sub.push(`Diskon ${rp(disc * qty)}`);
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
  sum.push(['DEPOSIT (DP)', rp(r.deposit_amount || 0), false]);
  sum.push(['TOTAL', rp(r.total), true]);
  const sumRows = sum
    .map(
      ([l, v, g]) =>
        `<tr class="${g ? 'grand' : ''}"><td class="l">${l}</td><td class="v">${v}</td></tr>`,
    )
    .join('');

  const bankRows = BRAND.banks
    .map((b) => `<div class="br"><span class="bn">${esc(b.name)}</span><span class="bv">${esc(b.no)}</span></div>`)
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
    <tbody>${rows}</tbody>
  </table>

  <div class="ipay">
    <div class="ibank">
      <div class="bt">PEMBAYARAN :</div>
      ${bankRows}
      <div class="bd"></div>
      <div class="bh">Rekening An: <b>${esc(BRAND.holder)}</b></div>
    </div>
    <table class="isum">${sumRows}</table>
  </div>

  <div class="istat">${esc(statusOf(r))}</div>

  ${r.note ? `<div class="inote"><b>Catatan :</b> ${esc(r.note)}</div>` : ''}

  <div class="iquote"><span class="ic">i</span><span>${QUOTE_NOTE}</span></div>

  <div class="ifoot">
    <div class="tk">TERIMA KASIH</div>
    <div class="fs">${esc(settings.receipt_footer || 'Terima kasih telah berbelanja!')}</div>
    <div class="fc">${esc(address)}</div>
    <div class="fc">${esc(phone)} | ${esc(BRAND.website)}</div>
  </div>
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
