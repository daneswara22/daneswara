# Development Plan — Daneswara v2 → Next.js 15 Fullstack (TS) + Prisma + MariaDB + R2

## 1) Objectives
- Migrasi fullstack dari **CRA React + FastAPI** menjadi **Next.js 15 App Router (TypeScript)**, tanpa mengubah skema DB yang sudah ada.
- Pertahankan **paritas UI** (Landing + DanesPOS) dan **paritas JSON response** (shape sama persis dengan backend Python) agar logic frontend POS tetap jalan.
- Pertahankan integrasi **Cloudflare R2**: upload → konversi **WebP** → simpan R2 (fallback disk `/data/uploads`).
- Siapkan **Docker build (Coolify)** dengan `output: "standalone"`.
- Atasi constraint preview Emergent: `/api/*` harus lewat **8001** sedangkan Next.js berjalan di **3000**.

---

## 2) Implementation Steps

### Phase 1 — Core POC (wajib stabil sebelum lanjut)
**Tujuan POC:** buktikan 3 hal paling risk: *Prisma read existing MariaDB*, *Route Handler /api parity*, *R2+WebP pipeline*, plus *bridge 8001→3000 di preview*.

User stories:
1. Sebagai dev, saya bisa menjalankan Next.js di preview dan tetap punya `/api/*` yang berfungsi lewat port 8001.
2. Sebagai dev, saya bisa melakukan `prisma db pull` dari MariaDB existing (18 tabel) tanpa migrate/reset.
3. Sebagai visitor, `GET /api/public/gallery` mengembalikan JSON identik dengan backend Python.
4. Sebagai visitor, halaman landing `/` bisa render (SSG/ISR) dan menampilkan data galeri dari API.
5. Sebagai admin, saya bisa upload gambar → otomatis jadi WebP → tersimpan di R2 dan dapat URL publik.

Langkah:
1. **Bootstrap Next.js** di `/app/web` (Next 15, TS, Tailwind).
2. **Prisma setup**: `prisma init` + `prisma db pull` (pakai `DATABASE_URL_PUBLIC`), generate client; buat `web/lib/db.ts` singleton.
3. **Core libs**:
   - `web/lib/storage.ts` (sharp→webp, R2 via `@aws-sdk/client-s3`, fallback disk)
   - `web/lib/tz.ts` (Asia/Makassar helper untuk reports nanti)
4. **POC APIs (Next Route Handlers)**:
   - `GET /api/health`
   - `GET /api/public/gallery` (urut `sort_order desc`, response shape sama dengan Python)
   - `POST /api/upload?kind=` (return public URL; gunakan storage module)
5. **POC Landing**:
   - `(landing)/page.tsx` ambil data dari `/api/public/gallery` (ISR `revalidate: 60`) + render minimal struktur.
6. **Preview bridge (wajib untuk sandbox)**:
   - Ubah `/app/frontend/package.json` → `yarn start` menjalankan `next dev -p 3000` dari `/app/web`.
   - Ganti `/app/backend/server.py` jadi **FastAPI proxy tipis** yang forward `/api/*` → `http://127.0.0.1:3000/api/*`.
7. **Script uji core** `web/scripts/test-core.ts`:
   - konek Prisma & query tabel `gallery_items`
   - upload sample image → verifikasi WebP & URL
   - hit `/api/public/gallery` dan validasi shape dasar
8. Fix sampai lulus: preview URL harus bisa buka `/` dan `/api/public/gallery`.

Checkpoint (keluar Phase 1):
- `db pull` sukses, API route jalan via ingress, upload WebP ke R2 jalan.

---

### Phase 2 — V1 App Development (paritas bertahap)
User stories:
1. Sebagai visitor, semua landing route (`/`, `/galeri`, `/gallery`, `/price-list`, `/order`) tampil identik dengan versi lama.
2. Sebagai staff, saya bisa login di `/login` dan masuk dashboard `/app` dengan guard yang konsisten.
3. Sebagai kasir, saya bisa membuat transaksi penjualan dan stok berkurang sesuai aturan.
4. Sebagai owner/manager, saya bisa kelola **Galeri Website** (CRUD + reorder + upload) dan landing ikut berubah.
5. Sebagai owner, saya bisa melihat laporan utama dengan timezone `Asia/Makassar`.

Langkah:
1. **Port UI framework**: pindahkan `frontend/src/components/ui` → `web/components/ui` (as-is) + Tailwind/shadcn config + font/CSS scoping `.dp-landing`.
2. **Port Landing pages** ke App Router group `(landing)/...` + metadata SEO + ISR.
3. **Port POS pages** (`/login`, `/pos`, `/app/*`) sebagai client components; adapt routing dari React Router.
4. **Auth & RBAC** (tetap cookie httpOnly + Bearer): port aturan role Owner/Manager/Kasir/Gudang.
5. **Port API handlers 1:1** mengikuti router Python (prioritas urutan):
   - auth, users
   - categories/products (+reorder)
   - stock movements
   - sales (+refund, invoice INV-yymmdd-####)
   - orders (DP, complete → sale from_order)
   - purchases (receive → add stock, delete received owner-only)
   - customers, suppliers
   - finance (expenses, other_income, categories)
   - settings + user_settings
   - reports (sales, monthly, P/L, cash-flow)
   - admin tools, export
   - gallery + public/gallery, uploads, files fallback
6. **Zod schemas**: port validasi dari `backend/app/schemas.py`.
7. **Parity testing incremental**: untuk setiap modul, lakukan curl compare vs FastAPI lama (di repo) sebelum lanjut modul berikutnya.

Checkpoint (keluar Phase 2):
- Semua menu inti POS jalan, landing paritas, gallery manager paritas.

---

### Phase 3 — Migration Tooling + Hardening
User stories:
1. Sebagai owner, saya bisa menjalankan migrasi Mongo→MariaDB dari UI `/app/migrasi` dan melihat progres.
2. Sebagai operator, saya bisa deploy 1 container via Docker di Coolify dan healthcheck lolos.
3. Sebagai operator, media tetap tersaji baik via R2 atau fallback disk.
4. Sebagai user, aplikasi tetap responsif saat data besar (customers 648, catalog 300 products).
5. Sebagai operator, seed tidak menimpa data produksi (idempoten hanya saat tabel kosong).

Langkah:
1. Port `scripts/migrate_mongo_to_mariadb.py` → `web/lib/migration/mongo.ts` + UI progress.
2. Port seed idempoten → `web/lib/seed.ts` (jalan di startup bila tabel kosong).
3. Tambahkan endpoint `GET /api/storage/status` untuk debug R2 vs disk.
4. Review caching (ISR landing), pagination/list performance, dan error handling API.

---

### Phase 4 — Docker + Cutover + Cleanup
User stories:
1. Sebagai operator, saya bisa build image `Dockerfile` root (standalone) dan deploy di Coolify.
2. Sebagai operator, `/api/health` always green dan logs jelas.
3. Sebagai user, tidak ada regresi pada flow POS utama.
4. Sebagai owner, Gallery website stabil setelah redeploy.
5. Sebagai dev, repo bersih tanpa secrets dan siap maintenance.

Langkah:
1. Buat **root Dockerfile** untuk Next standalone (node:20-alpine, port 3000/80 sesuai kebutuhan Coolify).
2. Update `DEPLOY.md` untuk Next.js.
3. Setelah paritas 100%: hapus `frontend/` + `backend/` lama (atau keep sementara sampai user setuju), rapikan.
4. Testing menyeluruh (lihat bawah), lalu PR.

---

## 3) Next Actions (immediate focus)
1. Buat branch `feat/nextjs-fullstack`.
2. Init Next.js di `/app/web` + Tailwind + TS.
3. Prisma `db pull` dari `DATABASE_URL_PUBLIC` dan commit schema/client.
4. Implement POC: `/api/health`, `/api/public/gallery`, `/api/upload` + `storage.ts`.
5. Implement preview bridge (FastAPI proxy di 8001 + Next dev di 3000).
6. Jalankan `web/scripts/test-core.ts` sampai lulus.

---

## 4) Success Criteria
**Phase 1 (POC) sukses jika:**
- `prisma db pull` berhasil tanpa mengubah skema DB.
- Preview URL:
  - `GET /api/health` return OK melalui 8001.
  - `GET /api/public/gallery` return data dari MariaDB dan bentuk JSON sesuai backend Python.
  - Landing `/` render dan menampilkan data galeri.
  - Upload menghasilkan file WebP dan URL publik (R2) atau fallback disk.

**Final sukses jika:**
- Semua route landing + POS identik secara visual.
- Semua Route Handlers `/api/*` parity dengan FastAPI (shape + business rules).
- Docker standalone build untuk Coolify berjalan stabil.
- PR `feat/nextjs-fullstack` siap merge (tanpa `.env`/secrets).
---

## Sesi 2026-09-23 — Revamp `/app/mockup-kaos` menjadi "Jenis Produk"

### Permintaan pemilik
Halaman admin `/app/mockup-kaos` (dulu "Mockup Kaos") diganti fungsinya secara keseluruhan:
1. Admin bisa **create / edit / delete jenis & info produk**. Info ini tampil di halaman
   publik `/custom` (tombol "Ganti Produk") dan `/price-list`.
2. **CRUD warna per produk** — setiap produk punya jumlah & daftar warna berbeda. Di daftar
   harga, jumlah varian warna ditampilkan sebagai ikon kaos; ikon diklik menampilkan
   thumbnail tampak depan (di-upload manual admin, PNG/JPG → WebP otomatis).
3. **CRUD size chart per produk** dengan kolom Lebar Dada (cm) dan Panjang (cm).
4. Optimisasi **lazy load pagination**.

Field produk (disetujui pemilik): Nama produk, Harga kaos, Suplier, Size (Asia/Local vs
Eropa/USA), Model, Bahan, Deskripsi, Foto/thumbnail, Aktif/non-aktif, Urutan.

### Yang dikerjakan — SELESAI
- **Skema DB**: `custom_products` ditambah kolom `subtitle`, `price`, `supplier`,
  `size_region`, `model`, `material`, `thumbnail_url`, `is_active`, `sort_order`. Dua tabel
  baru: `custom_product_colors` (nama, hex, `thumb_url`, urutan, aktif) dan
  `custom_product_sizes` (label, `chest_cm`, `length_cm`, urutan), keduanya
  `ON DELETE CASCADE` ke produk. Migrasi produksi aditif (hanya ADD/CREATE, aman diulang):
  `web/prisma/sql/2026-09-23_custom_product_types.sql`.
- **Seeding bawaan** (`lib/productTypeQueries.ts` → `ensureSeedProductTypes`): empat jenis
  kaos (premium-cotton-7200, SIZE LOCAL, SIZE LUAR, Standar DNS) beserta warna & size chart.
  Dikerjakan **per `product_key`** dan hanya mengisi kolom yang masih kosong, jadi tidak
  menimpa data yang sudah diedit admin. Ikut dipanggil dari `scripts/seed-dummy-sandbox.ts`.
- **API admin**: `GET/POST /api/custom-products`, `GET/PUT/DELETE /api/custom-products/:id`,
  `GET/POST /api/custom-products/:id/colors` + `PUT/DELETE .../colors/:cid`,
  `GET/POST /api/custom-products/:id/sizes` + `PUT/DELETE .../sizes/:sid`.
  Semua tulis dibatasi role Owner/Manager, validasi Zod (hex `#RRGGBB`, angka cm, harga ≥ 0),
  hex & label duplikat ditolak 400, berkas R2 lama dibersihkan saat diganti/dihapus.
- **API publik**: `GET /api/public/custom-products?page&limit&q` — hanya produk aktif,
  dipaginasi, plus `Cache-Control`.
- **UI admin baru** `src_pages/ProductTypes.jsx`: kartu produk + kartu statistik, dialog form
  produk (upload thumbnail → WebP), manajer warna (nama, color picker + input hex, upload foto
  tampak depan, preview), manajer size chart (tabel + form), toggle aktif, hapus dengan
  konfirmasi, pencarian debounce, filter "hanya aktif", dan **lazy load** lewat
  IntersectionObserver + tombol "Muat Lebih Banyak".
- **Konsumen publik**: `components/landing/pages/PriceList.jsx` tidak lagi hardcoded —
  jenis kaos, spesifikasi, ikon varian warna (klik → preview thumbnail), dan tabel ukuran
  semuanya dari DB, dengan lazy load. `src_pages/CustomTees.jsx` mendapat modal
  "Ganti Produk" (+ pencarian), modal "Panduan Ukuran", panel "Detail Produk", serta ukuran
  dan warna yang mengikuti produk terpilih; mendukung deep link `/custom?product=<key>`.
- Label menu sidebar: "Mockup Kaos" → **"Jenis Produk"**.

### Verifikasi
- `web/scripts/test-product-types.ts` — 12 test hijau (seed idempotent, upload PNG→WebP,
  CRUD produk/warna/size, tolak duplikat, pagination, produk non-aktif tidak bocor ke
  endpoint publik, cascade delete).
- `yarn test:core` 7/7 hijau. `npx eslint .` exit 0. `yarn build` sukses.
- Testing agent iterasi 1: backend 33/33 + UI admin lulus. Iterasi 2: 13 user story halaman
  publik `/price-list` & `/custom` lulus, lazy load terbukti (10 produk → 9 + 1).
- Catatan: header `Cache-Control` endpoint publik sudah benar dari Next.js (terbukti via
  `curl localhost:3000`) tetapi ditimpa ingress sandbox Emergent; di Coolify tidak terjadi.

### Catatan untuk sesi berikutnya
- Warna hasil seeding belum punya foto tampak depan — admin perlu mengunggahnya lewat
  tombol "Warna" pada tiap produk supaya preview di daftar harga menampilkan gambar.
- Tabel lama `custom_mockups` masih ada dan belum dihapus (endpoint `/api/mockups` juga
  masih hidup) supaya tidak memutus data lama; bisa dipensiunkan di sesi terpisah.

---

## Sesi 2026-09-23 (lanjutan) — Font kustom di desainer kaos

### Permintaan pemilik
Pada sub menu **Custom Tees**, admin bisa menambahkan font baru sendiri, dan
**disertakan label format font yang ideal**.

### Yang dikerjakan — SELESAI
- **Tabel baru `custom_fonts`** (`name`, `family`, `file_url`, `format`,
  `file_size`, `is_active`, `sort_order`). Migrasi produksi:
  `web/prisma/sql/2026-09-23_custom_fonts.sql` (hanya `CREATE TABLE IF NOT EXISTS`,
  tidak menyentuh tabel lain).
- **`lib/fonts.ts`**: daftar format yang diterima beserta label kelayakannya —
  **WOFF2 "Paling ideal"**, WOFF "Bagus", TTF/OTF "Berat (sebaiknya diubah ke
  WOFF2)" — plus batas 3 MB dan tips lisensi/subset Latin.
- **API**: `GET/POST /api/fonts` (unggah multipart), `PUT/DELETE /api/fonts/:id`
  (ubah nama, aktif/non-aktif, hapus), `GET /api/public/fonts` (daftar font aktif
  untuk pelanggan), dan `GET /api/public/fonts/:id/file` yang menyajikan berkas
  font **same-origin**. Endpoint terakhir ini penting: berkas font yang dimuat
  `@font-face` butuh header CORS, jadi kalau disajikan langsung dari URL R2/CDN
  fontnya bisa gagal dimuat. Tulis dibatasi role Owner/Manager.
- **`lib/storage.ts`**: `uploadFont()` menyimpan berkas apa adanya (tanpa
  konversi sharp) dan `fetchBytes()` untuk membacanya kembali dari R2 atau disk.
- **UI (`src_pages/CustomTees.jsx`)**: tombol **"Kelola Font"** di panel Teks
  (hanya muncul untuk admin, tidak di halaman publik). Modalnya berisi kartu
  panduan format dengan badge kelayakan, form unggah (nama + berkas), dan daftar
  font dengan **pratinjau huruf langsung**, ukuran berkas, tombol
  sembunyikan/aktifkan, dan hapus. Aturan `@font-face` disuntikkan otomatis ke
  `<head>`, lalu font kustom ikut muncul di dropdown "Jenis Font" dengan
  keterangan jumlah font yang tersedia.

### Verifikasi
- Rantai unggah diuji langsung: WOFF2 terunggah ke R2, disajikan kembali
  **byte-identical** (`content-type: font/woff2`, ada `access-control-allow-origin`),
  muncul di `/api/public/fonts`, dan berkas non-font (`.png`) ditolak dengan pesan
  yang menyebut WOFF2 sebagai format paling ideal.
- UI: dropdown berubah dari 8 jadi 9 font, teks di kanvas benar-benar memakai font
  kustom, tombol "Kelola Font" tidak ada di `/custom` publik.
- `yarn test:core` 7/7 hijau, `npx eslint .` exit 0, `yarn build` sukses (4 route
  font terdaftar). Font uji dihapus lagi setelah pengujian.

---

## Sesi 2026-09-23 (perbaikan) — Error `custom_fonts does not exist`

### Gejala yang dilaporkan pemilik
Saat menekan "Tambahkan Font" di modal Kelola Font, muncul error merah:
`Invalid prisma.custom_fonts.findFirst() invocation: The table custom_fonts
does not exist in the current database.`

### Akar masalah
Bukan bug kode. Proyek ini tidak memakai `prisma migrate`, jadi tabel baru tidak
ikut terpasang saat deploy (lihat DEPLOY.md "Perubahan skema database"). Kodenya
sudah ter-merge lewat PR #38, tetapi berkas
`web/prisma/sql/2026-09-23_custom_fonts.sql` belum pernah dijalankan ke database
yang dipakai, sehingga tabelnya belum ada. Ini persis gejala `P2021` yang sudah
didokumentasikan sebelumnya untuk `custom_tee_orders`.

### Perbaikan — SELESAI
Daripada hanya meminta pemilik menjalankan SQL manual, dibuat jaring pengaman
**`web/lib/schemaGuard.ts`**:
- `ensureFontSchema()` \u2014 memastikan tabel `custom_fonts` ada.
- `ensureProductTypeSchema()` \u2014 memastikan kolom baru `custom_products` serta
  tabel `custom_product_colors` dan `custom_product_sizes` ada (fitur PR #37
  punya risiko yang sama).
- Dipanggil di awal semua endpoint `/api/fonts*`, `/api/custom-products*`,
  `/api/public/fonts*`, dan `/api/public/custom-products`.
- Semua perintahnya **aditif dan idempotent**: hanya `CREATE TABLE IF NOT EXISTS`
  dan `ADD COLUMN` yang dijaga `information_schema`. **Tidak ada DROP/TRUNCATE**,
  jadi aman untuk database produksi yang sudah berisi data. Hasilnya di-cache per
  proses sehingga biayanya hanya sekali di request pertama.

### Verifikasi (tanpa agen penguji, sesuai permintaan)
Situasi pemilik direproduksi langsung di sandbox: tabel `custom_fonts`,
`custom_product_colors`, `custom_product_sizes` di-DROP dan kolom `price` serta
`is_active` dihapus dari `custom_products`. Setelah restart:
- `/api/public/fonts` dan `/api/public/custom-products` **tidak lagi error**,
- tabel dan kolom terbentuk kembali otomatis (dicek lewat `SHOW TABLES` dan
  `SHOW COLUMNS`),
- warna & size chart ikut ter-seed ulang (8/6/5 warna, 8/6/5 ukuran),
- unggah font WOFF2 berhasil dan berkasnya tersaji `200 font/woff2`.
- `yarn test:core` 7/7 hijau, `npx tsc --noEmit` bersih untuk berkas yang diubah,
  `npx eslint .` exit 0, `yarn build` sukses.

DEPLOY.md diperbarui untuk mencatat adanya pengaman otomatis ini.
