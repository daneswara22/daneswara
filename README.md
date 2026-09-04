<div align="center">

# Daneswara Print — <em>Percetakan Digital Bali, Online</em>

**Landing marketing publik + POS internal + manajemen bisnis percetakan dalam satu aplikasi**

`Genesis` · Landing · POS · Inventori · Pesanan Custom · Pembelian · Keuangan · Galeri

![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=nextdotjs)
![React](https://img.shields.io/badge/React-19-149ECA?logo=react)
![Prisma](https://img.shields.io/badge/Prisma-6.x-2D3748?logo=prisma)
![MariaDB](https://img.shields.io/badge/MariaDB-11-003545?logo=mariadb)
![Cloudflare R2](https://img.shields.io/badge/Cloudflare_R2-cdn.daneswara.com-F38020?logo=cloudflare)
![deploy](https://img.shields.io/badge/deploy-Coolify-6D28D9)

</div>

---

## Daftar Isi

1. [Apa itu Daneswara](#1--apa-itu-daneswara)
2. [Fitur Utama](#2--fitur-utama)
3. [Teknologi](#3--teknologi)
4. [Arsitektur Self-Hosted](#4--arsitektur-self-hosted)
5. [Quick Start](#5--quick-start)
6. [Struktur Folder](#6--struktur-folder)
7. [Environment Variables](#7--environment-variables)
8. [Struktur CDN (R2)](#8--struktur-cdn-r2)
9. [API Surface](#9--api-surface)
10. [Script Operasional](#10--script-operasional)
11. [Migrasi Data (MongoDB → MariaDB)](#11--migrasi-data-mongodb--mariadb)
12. [Deployment (Coolify)](#12--deployment-coolify)
13. [FAQ Operasional](#13--faq-operasional)
14. [Lisensi](#14--lisensi)

---

## 1 · Apa itu Daneswara

**Daneswara** adalah aplikasi web **all-in-one** untuk **Daneswara Print** (percetakan digital / DTF di Bali). Alih-alih memisah website company profile dan aplikasi kasir, semuanya disatukan dalam satu deployment dengan bahasa desain yang konsisten:

- **Publik (landing marketing)** — etalase karya, daftar harga cetak, dan form pemesanan yang langsung terhubung ke WhatsApp. Bilingual **ID/EN**, tema "brutalist" hitam × aksen oranye.
- **Internal (POS + admin)** — kasir point-of-sale dengan 300+ produk, inventori, pesanan custom (DP → pelunasan), pembelian ke supplier, laporan keuangan, dan CRM pelanggan. Wajib login, berbasis peran.

> Satu situs untuk pelanggan **dan** untuk operasional toko — tanpa pindah aplikasi.

---

## 2 · Fitur Utama

### Publik (tanpa login)
| Halaman | Fungsi |
|---|---|
| `/` | Hero + galeri karya + kontak (SSG, revalidate) |
| `/galeri`, `/gallery` | Grid galeri lengkap (data dari DB) |
| `/price-list`, `/price-list-print-only` | Daftar harga cetak DTF |
| `/order` | Ringkasan order → kirim ke WhatsApp |

### Internal (POS + admin, per peran)
| Modul | Halaman | Ringkas |
|---|---|---|
| Kasir | `/pos` | POS cepat, hold order, cetak nota |
| Dashboard | `/app` | Omzet, laba, stok minus, aktivitas |
| Katalog | `/app/produk`, `/app/kategori`, `/app/inventory` | Produk, kategori, stok + opname |
| Pesanan | `/app/pesanan` | Custom order: Draft → Proses (DP) → Selesai |
| Riwayat | `/app/riwayat` | Transaksi + refund |
| Pembelian | `/app/supplier`, `/app/pembelian` | PO: Menunggu → Diterima (tambah stok) |
| Pelanggan | `/app/pelanggan` | CRM + histori belanja |
| Keuangan | `/app/pengeluaran`, `/app/pendapatan-lain` | Kas keluar/masuk + kategori |
| Laporan | `/app/laporan` | Penjualan, laba-rugi, arus kas (TZ Asia/Makassar) |
| Ekspor | `/app/ekspor` | Export CSV per dataset |
| Galeri Web | `/app/galeri-web` | CRUD galeri publik + upload WebP ke R2 |
| Admin | `/app/pengguna`, `/app/pengaturan` | User & pengaturan toko |

**Aturan bisnis inti**
- Peran: **Owner / Manager / Kasir / Gudang**
- Penjualan mengurangi stok + menulis `stock_movements`; invoice `INV-yymmdd-####`
- PO diterima menambah stok + update HPP; nomor `PO-yymmdd-####`
- Gambar produk/kategori/galeri otomatis dikonversi ke **WebP** dan diunggah ke **Cloudflare R2** (dilayani lewat CDN `cdn.daneswara.com`)

---

## 3 · Teknologi

| Lapisan | Stack |
|---|---|
| Framework | **Next.js 15** (App Router) + **React 19**, TypeScript |
| ORM / DB | **Prisma 6** → **MariaDB 11** (18 tabel) |
| Auth | JWT (cookie httpOnly) + **bcryptjs**, role-based |
| Storage | **Cloudflare R2** (S3 API) + CDN domain, fallback disk `/data/uploads` |
| Gambar | **sharp** (konversi WebP) |
| UI | Tailwind CSS + shadcn/Radix, `lucide-react`, `recharts`, `sonner` |
| Deploy | **Coolify** (Docker standalone) |

---

## 4 · Arsitektur Self-Hosted

```
                 ┌──────────────────────────────┐
   Pelanggan ───▶│  Next.js 15 (app + /api)      │
   Kasir/Admin   │  container @ Coolify (Docker) │
                 └───────┬───────────────┬───────┘
                         │               │
              Prisma     │               │  S3 API (put/get)
                         ▼               ▼
              ┌────────────────┐   ┌──────────────────────┐
              │  MariaDB 11    │   │  Cloudflare R2 bucket │
              │  db "default"  │   │  daneswaraobjectr2    │
              └────────────────┘   └──────────┬───────────┘
                                               │ public CDN
                                               ▼
                                   https://cdn.daneswara.com/...
```

- **Database & objek storage sepenuhnya milik sendiri** (MariaDB di VPS + R2). Tidak ada ketergantungan pada layanan managed pihak ketiga saat runtime.
- Gambar tidak disimpan sebagai base64 di DB — dikonversi ke WebP lalu diunggah ke R2, DB hanya menyimpan URL CDN. Kalau `R2_BUCKET` kosong, otomatis fallback ke disk lokal `/data/uploads` (dilayani via `/api/files/*`).

---

## 5 · Quick Start

```bash
# 1. Masuk ke app Next.js
cd web

# 2. Install dependency
yarn install

# 3. Siapkan environment (lihat bagian 7)
cp .env.example .env
# isi DATABASE_URL, JWT_SECRET, R2_* ...

# 4. Sinkronkan Prisma client dengan DB yang sudah ada
yarn prisma:generate      # generate client
# (skema sudah cocok dengan DB; untuk introspeksi ulang: yarn prisma:pull)

# 5. Jalankan
yarn dev                  # http://localhost:3000
# atau produksi
yarn build && yarn start
```

Owner pertama dibuat otomatis dari `OWNER_USERNAME` / `OWNER_PASSWORD` saat DB kosong (seed idempotent).

---

## 6 · Struktur Folder

```
web/
├── app/
│   ├── (landing)/          # halaman publik: /, /galeri, /price-list, /order ...
│   ├── (pos)/              # halaman internal: /login, /pos, /app/*
│   └── api/                # semua REST endpoint (route handlers)
├── components/
│   ├── landing/            # UI landing (i18n ID/EN, brutalist)
│   └── ui/                 # shadcn/Radix components
├── src_pages/              # halaman POS hasil porting (Login, POS)
├── lib/
│   ├── db.ts               # Prisma client singleton
│   ├── env.ts              # loader & validasi environment
│   ├── storage.ts          # R2 / disk storage + konversi WebP
│   ├── auth.ts             # JWT + bcrypt helpers
│   ├── seed.ts             # seed owner/katalog/pelanggan/galeri
│   └── react-router-shim.tsx  # kompat react-router → Next navigation
├── prisma/schema.prisma    # 18 model = 18 tabel MariaDB
└── scripts/                # test-core, verify-bcrypt
backend/                    # (referensi) versi lama FastAPI + data seed
frontend/                   # (referensi) versi lama React CRA
```

---

## 7 · Environment Variables

Buat `web/.env` (jangan commit). Placeholder — isi dengan nilai asli kamu:

```env
# Database (MariaDB)
DATABASE_URL=mysql://USER:PASSWORD@HOST:PORT/default

# Auth
JWT_SECRET=string-acak-panjang
JWT_EXPIRE_DAYS=7
COOKIE_SECURE=true

# Owner pertama (dipakai saat DB kosong)
OWNER_USERNAME=admin
OWNER_PASSWORD=GantiIni!
OWNER_NAME=Owner
OWNER_BUSINESS=Daneswara Print

# App
TIMEZONE=Asia/Makassar
PUBLIC_BASE_URL=https://daneswaraprint.com
UPLOAD_DIR=/data/uploads

# Cloudflare R2 (kosongkan R2_BUCKET untuk fallback disk)
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_ENDPOINT=https://<account>.r2.cloudflarestorage.com
R2_BUCKET=daneswaraobjectr2
R2_PUBLIC_BASE_URL=https://cdn.daneswara.com
R2_PREFIX=daneswara

# Seed flags
SEED_CATALOG=true
SEED_CUSTOMERS=true
SEED_GALLERY=true
```

> **Catatan produksi Coolify:** dari dalam VPS gunakan host internal MariaDB; dari luar gunakan TCP proxy publik `HOST:6796`.

---

## 8 · Struktur CDN (R2)

Semua objek berada di bucket `daneswaraobjectr2`, prefix `daneswara/`, dilayani via `https://cdn.daneswara.com`:

```
cdn.daneswara.com/
└── daneswara/
    ├── product/<uuid>.webp     # gambar produk
    ├── category/<uuid>.webp    # gambar kategori
    ├── gallery/<uuid>.webp     # galeri landing
    └── logo/<uuid>.webp        # logo toko (settings)
```

- Format selalu **WebP** (quality ~82, maks sisi 1600px), `Cache-Control: public, max-age=31536000`.
- Domain custom R2 → cache di edge Cloudflare (`cf-cache-status: HIT`).

---

## 9 · API Surface

Semua endpoint di bawah prefix `/api` (Next.js Route Handlers), auth via cookie/bearer JWT.

<details>
<summary><b>Auth & Admin</b></summary>

```
POST   /api/auth/login            POST /api/auth/logout
GET    /api/auth/me               POST /api/auth/change-password
POST   /api/admin/clear-transactions
POST   /api/admin/reprice-catalog POST /api/admin/reset-stock
GET    /api/health                GET  /api/storage/status
```
</details>

<details>
<summary><b>Katalog & Inventori</b></summary>

```
GET/POST      /api/products         PUT/DELETE /api/products/[pid]
POST          /api/products/reorder
GET/POST      /api/categories       PUT/DELETE /api/categories/[cid]
POST          /api/categories/reorder
POST          /api/stock            GET /api/stock/movements
POST          /api/upload           GET /api/files/[...path]
```
</details>

<details>
<summary><b>Penjualan, Pesanan & Pembelian</b></summary>

```
GET/POST  /api/sales               POST /api/sales/[sid]/refund
GET/POST  /api/orders              GET/PUT/DELETE /api/orders/[oid]
POST      /api/orders/[oid]/deposit   POST /api/orders/[oid]/complete
GET/POST  /api/held-orders         DELETE /api/held-orders/[hid]
GET/POST  /api/purchases           PUT/DELETE /api/purchases/[pid]
POST      /api/purchases/[pid]/receive
POST      /api/purchases/from-order/[oid]  /from-product/[pid]
```
</details>

<details>
<summary><b>Pelanggan, Keuangan, Laporan, Galeri</b></summary>

```
GET/POST  /api/customers           PUT/DELETE /api/customers/[cid]
GET       /api/customers/[cid]/history
GET/POST  /api/expenses            DELETE /api/expenses/[eid]
GET/POST  /api/other-income        DELETE /api/other-income/[eid]
GET/POST  /api/finance-categories  DELETE /api/finance-categories/[cid]
GET       /api/reports/sales | monthly | profit-loss | cash-flow
GET       /api/dashboard           GET /api/export/[dataset]
GET/POST  /api/gallery             DELETE /api/gallery/[gid]
POST      /api/gallery/reorder     GET /api/public/gallery
GET/POST  /api/suppliers           PUT/DELETE /api/suppliers/[sid]
GET/PUT   /api/settings            GET/POST/PUT /api/users, /api/users/[uid]
```
</details>

---

## 10 · Script Operasional

```bash
cd web
yarn prisma:generate   # generate Prisma client
yarn prisma:pull       # introspeksi ulang skema dari DB
yarn test:core         # sanity check koneksi DB + R2 (tsx scripts/test-core.ts)
node scripts/verify-bcrypt.ts   # cek hash password
```

---

## 11 · Migrasi Data (MongoDB → MariaDB)

Aplikasi versi awal memakai MongoDB (DanesPOS). Data lama dimigrasikan ke MariaDB dengan menjaga `id`/`tenant_id`, mengonversi gambar base64 → WebP → R2, dan mempertahankan bcrypt password. Pemetaan **1:1** collection → tabel:

| Mongo collection | Tabel MariaDB |
|---|---|
| products, categories | products, categories (gambar → R2) |
| sales, orders, purchases, held_orders | idem (field `items` = JSON) |
| customers, suppliers, users | idem (users menjaga bcrypt) |
| stock_movements, expenses, other_income | idem |
| finance_categories, settings, activities, tenants | idem |

Verifikasi selalu membandingkan jumlah baris per tabel terhadap sumber.

---

## 12 · Deployment (Coolify)

1. **MariaDB** — resource MariaDB 11 di Coolify. Akses internal (dalam VPS) atau TCP proxy publik `:6796`.
2. **App** — build Docker dari root repo (`node server.js`, Next standalone). Isi semua env (bagian 7).
3. **R2** — set `R2_*`; `cdn.daneswara.com` diarahkan ke bucket via Cloudflare (public access / custom domain).
4. **phpMyAdmin** (opsional) — kalau host internal tak ter-resolve, arahkan `PMA_HOST` ke IP + port publik MariaDB.

Health check: `GET /api/health` → `{ "status": "healthy", "database": "ok" }`.

---

## 13 · FAQ Operasional

**Gambar tidak muncul?** Pastikan `R2_BUCKET` & `R2_PUBLIC_BASE_URL` terisi dan domain R2 publik aktif. `HEAD` bisa 403 di R2 — cek dengan `GET`.

**Build gagal `useSearchParams is not a function`?** Sudah difix: halaman yang mengimpor dari `react-router-dom` diarahkan ke `lib/react-router-shim.tsx`; halaman yang memakai `useSearchParams` dibungkus `<Suspense>`.

**Login gagal "Akun dinonaktifkan"?** Kolom `active`/`refunded` adalah `TINYINT(1)` — pastikan bernilai `1` (bukan string) saat impor.

**Owner lupa password?** Ganti `password_hash` (bcrypt `$2b$`) langsung di DB, atau buat user Owner baru.

---

## 14 · Lisensi

Proprietary © Daneswara Print. Penggunaan internal. Semua hak dilindungi.
