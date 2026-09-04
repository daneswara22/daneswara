# Daneswara v2

**Percetakan Digital Bali** — aplikasi web all-in-one untuk **Daneswara Print**: landing marketing publik + **POS (Point-of-Sale)** internal + manajemen inventori, pesanan custom, pembelian, keuangan, dan galeri.

Repo ini sekarang berisi **dua versi paralel** selama transisi:

1. **`web/`** — versi aktif **Next.js 15 fullstack (TypeScript)** yang akan naik ke production di Coolify via Docker.
2. **`frontend/`** + **`backend/`** — versi lama React CRA + FastAPI (Python), tetap ada sebagai referensi paritas selama migrasi. **Tidak dipakai** di Docker build.

> Setelah migrasi Next.js diverifikasi 100% di production, `frontend/` dan `backend/` akan dihapus di PR terpisah.

---

## Aplikasi ini apa

### Publik (landing marketing)
- `/` — hero + galeri karya + kontak (SSG, revalidate 60s)
- `/galeri`, `/gallery` — grid galeri lengkap (data dari DB)
- `/price-list`, `/price-list-print-only` — daftar harga cetak
- `/order` — form pemesanan
- Bilingual **ID/EN** via `LangContext`
- Tema "brutalist" hitam × aksen oranye (font Anton + Work Sans + Caveat), scope class `.dp-landing`

### Internal (POS + admin, wajib login)
- `/login`, `/pos` — kasir POS dengan 300+ produk
- `/app` — dashboard omzet/laba/produk/stok
- `/app/produk`, `/kategori`, `/inventory` — katalog + stok
- `/app/pesanan` — pesanan custom (Draft → Proses → Selesai)
- `/app/riwayat` — riwayat transaksi + refund
- `/app/supplier`, `/app/pembelian` — PO (Menunggu → Diterima)
- `/app/pelanggan` — CRM pelanggan
- `/app/pengeluaran`, `/app/pendapatan-lain` — keuangan
- `/app/laporan` — laporan penjualan, laba-rugi, arus kas (timezone Asia/Makassar)
- `/app/ekspor` — CSV export per dataset
- `/app/galeri-web` — CRUD galeri publik (Owner/Manager) + upload WebP ke R2
- `/app/pengguna`, `/app/pengaturan` — admin

Aturan bisnis inti:
- Role akses: **Owner / Manager / Kasir / Gudang**
- Sale kurangi stok + tulis `stock_movements`, invoice `INV-yymmdd-####`
- Refund kembalikan stok (Owner/Manager)
- Pesanan Draft (DP=0) → Proses (setelah DP) → Selesai (auto-create sale `from_order`)
- PO Menunggu → Diterima (tambah stok + update cost). Delete PO yang sudah Diterima: **Owner only** (dengan koreksi stok)
- Laporan pakai timezone **Asia/Makassar** (tetap konsisten dari FastAPI)

---

## Stack teknologi

### Versi aktif (`web/` — Next.js fullstack)

| Layer | Teknologi |
|-------|-----------|
| Framework | **Next.js 15** (App Router, `output: "standalone"`) |
| Language | **TypeScript** |
| Database | **MariaDB** existing (18 tabel, jangan `prisma migrate` — hanya `db pull`) |
| ORM | **Prisma 6** |
| Auth | **jose** (JWT, HS256, httpOnly cookie + Bearer) + **bcryptjs** (kompatibel hash `$2b$` lama) |
| Validation | **Zod** |
| Styling | **Tailwind 3** + **shadcn/ui** (46 komponen di `components/ui/`) |
| Fonts | Outfit, Manrope, Anton, Work Sans, Caveat, Inter |
| Media storage | **Cloudflare R2** (`@aws-sdk/client-s3`) + **sharp** (WebP) — fallback disk `/data/uploads` bila `R2_BUCKET` kosong |
| Charts | recharts |
| Toast | sonner |
| Timezone | date-fns-tz (Asia/Makassar) |
| Build/Deploy | **Dockerfile** multi-stage → **Coolify** |

Strukur direktori `web/`:

```
web/
├─ app/                      # Next.js App Router
│  ├─ (landing)/             # Group route: landing marketing (SSG/ISR)
│  │   ├─ layout.tsx          # LangProvider + LandingShell wrapper + .dp-landing scope
│  │   ├─ page.tsx            # /  (Landing)
│  │   ├─ galeri/page.tsx     # /galeri (GalleryPage)
│  │   ├─ gallery/page.tsx    # /gallery (alias)
│  │   ├─ price-list/page.tsx
│  │   ├─ price-list-print-only/page.tsx
│  │   └─ order/page.tsx
│  ├─ (pos)/                 # Group route: POS + admin (client, wajib login)
│  │   ├─ layout.tsx          # AuthProvider + ThemeProvider + Toaster
│  │   ├─ login/page.tsx
│  │   ├─ pos/page.tsx
│  │   └─ app/                # /app dashboard + sub-menus
│  │       ├─ layout.tsx      # ProtectedRoute + Layout sidebar
│  │       ├─ page.tsx        # Dashboard
│  │       ├─ produk/page.tsx
│  │       ├─ kategori/page.tsx
│  │       ├─ inventory/page.tsx
│  │       ├─ pelanggan/page.tsx
│  │       ├─ pesanan/page.tsx
│  │       ├─ riwayat/page.tsx
│  │       ├─ supplier/page.tsx
│  │       ├─ pembelian/page.tsx
│  │       ├─ pengeluaran/page.tsx
│  │       ├─ pendapatan-lain/page.tsx
│  │       ├─ laporan/page.tsx
│  │       ├─ ekspor/page.tsx
│  │       ├─ galeri-web/page.tsx
│  │       ├─ pengguna/page.tsx
│  │       └─ pengaturan/page.tsx
│  ├─ api/                   # Route Handlers 1:1 dengan FastAPI
│  │   ├─ auth/{login,logout,me,change-password}/route.ts
│  │   ├─ users(+[uid])/route.ts
│  │   ├─ categories(+reorder+[cid])/route.ts
│  │   ├─ products(+reorder+[pid])/route.ts
│  │   ├─ stock(+movements)/route.ts
│  │   ├─ sales(+[sid]/refund)/route.ts
│  │   ├─ held-orders(+[hid])/route.ts
│  │   ├─ orders(+[oid]+deposit+complete)/route.ts
│  │   ├─ purchases(+[pid]+receive+from-order+from-product)/route.ts
│  │   ├─ customers(+[cid]+history)/route.ts
│  │   ├─ suppliers(+[sid])/route.ts
│  │   ├─ finance-categories(+[cid])/route.ts
│  │   ├─ expense-categories/route.ts
│  │   ├─ other-income-categories/route.ts
│  │   ├─ expenses(+[eid])/route.ts
│  │   ├─ other-income(+[eid])/route.ts
│  │   ├─ dashboard/route.ts
│  │   ├─ reports/{sales,monthly,profit-loss,cash-flow}/route.ts
│  │   ├─ settings/route.ts
│  │   ├─ admin/{clear-transactions,reset-stock,reprice-catalog}/route.ts
│  │   ├─ export/[dataset]/route.ts
│  │   ├─ gallery(+reorder+[gid])/route.ts
│  │   ├─ public/gallery/route.ts
│  │   ├─ upload/route.ts
│  │   ├─ storage/status/route.ts
│  │   ├─ files/[...path]/route.ts     # local fallback serve
│  │   └─ health/route.ts
│  ├─ sitemap.ts
│  ├─ robots.ts
│  ├─ layout.tsx                # root layout (metadata SEO)
│  ├─ globals.css               # Tailwind + theme vars
│  └─ App.css                   # POS scope
├─ lib/
│  ├─ db.ts                     # Prisma singleton
│  ├─ env.ts                    # ENV loader + validation
│  ├─ auth.ts                   # bcryptjs + jose JWT + cookie helpers + logActivity
│  ├─ storage.ts                # R2 + sharp WebP + disk fallback
│  ├─ tz.ts                     # Asia/Makassar helpers
│  ├─ business.ts               # docNumber, parseDate, localRangeToUtc, rp()
│  ├─ schemas.ts                # Zod schemas (port dari FastAPI schemas.py)
│  ├─ serializers.ts            # to_dict() shape parity dengan FastAPI
│  ├─ handler.ts                # NextRequest wrapper + error handler + readBody
│  ├─ http.ts                   # HttpError, newId, toIso
│  ├─ api.ts                    # axios client-side (Bearer + cookie)
│  ├─ seed.ts                   # idempotent seed (owner/catalog/customers/gallery)
│  ├─ react-router-shim.tsx     # react-router-dom → next/navigation compat
│  ├─ utils.js                  # cn() + helpers (dari CRA)
│  ├─ captureImage.js           # html2canvas helper (nota image)
│  ├─ printer.js                # print helpers
│  └─ terbilang.js              # angka → bahasa (untuk nota)
├─ prisma/
│  └─ schema.prisma             # dihasilkan `prisma db pull` (18 model, JANGAN edit manual)
├─ context/                     # AuthContext, ThemeContext
├─ components/
│  ├─ ui/                       # shadcn/ui (46 file)
│  ├─ landing/                  # LandingShell + landing components + i18n
│  └─ *.jsx                     # Layout, ProtectedRoute, NotaDialog, VoucherDialog, dll.
├─ src_pages/                   # 17 halaman POS (JSX, di-mount lewat page.tsx wrapper)
├─ hooks/, constants/           # copy dari CRA
├─ public/                      # aset statis (logo, mockups, favicon)
├─ scripts/
│  ├─ test-core.ts              # POC test: DB + R2 + JWT + bcrypt
│  └─ verify-bcrypt.ts          # bcryptjs ⇔ Python bcrypt compat test
├─ next.config.js               # webpack alias + redirects + standalone
├─ tailwind.config.js
├─ postcss.config.js
├─ tsconfig.json
├─ package.json
└─ .env.example
```

### Versi lama (`frontend/` + `backend/` — legacy, akan dihapus)
- Frontend: React 19 CRA + craco + Tailwind + shadcn/ui + React Router 7
- Backend: FastAPI + SQLAlchemy async + aiomysql
- Migration script Mongo→MariaDB: `backend/scripts/migrate_mongo_to_mariadb.py`

---

## Workflow deploy (production)

**Coolify + Docker (Dockerfile build pack).**

1. Push ke branch feature → buat PR ke `main`.
2. Owner review + merge PR.
3. Coolify auto-deploy dari `main` dengan build pack **Dockerfile** (di root repo).
4. Container Next.js standalone listen di port 3000; Coolify proxy → domain publik.
5. Env vars di-set di Coolify (lihat `DEPLOY.md`).
6. Health check `GET /api/health` (30s interval).

**Yang tidak boleh dilakukan:**
- ❌ Push langsung ke `main`
- ❌ Commit `.env` / secrets (sudah di `.gitignore`)
- ❌ `prisma migrate` ke DB production (skema sudah ada 18 tabel + data seed; hanya `db pull`)
- ❌ Edit `prisma/schema.prisma` manual (regenerate lewat `prisma db pull` bila ada perubahan skema di sisi DB)

---

## Workflow development lokal

```bash
git clone https://github.com/daneswara22/daneswara.git
cd daneswara/web

cp .env.example .env
# Isi .env dengan kredensial dari admin (JANGAN commit)

yarn install
npx prisma generate       # generate Prisma client dari schema hasil db pull
yarn dev                  # → http://localhost:3000
```

Bila skema DB berubah:
```bash
npx prisma db pull        # tarik ulang skema dari MariaDB
npx prisma generate
```

Jalankan POC test (verifikasi koneksi DB + R2 + bcrypt + JWT):
```bash
yarn test:core
```

### Preview di sandbox Emergent

Environment sandbox Emergent memaksa ingress routing `/api/*` → port 8001 dan lainnya → port 3000. Untuk itu di sandbox:
- `backend/server.py` di-override jadi **FastAPI proxy mini** yang forward `/api/*` → `localhost:3000` (di mana Next.js jalan).
- `frontend/package.json` `start` script di-override supaya supervisor otomatis menjalankan `next dev` di `../web`.

Di production Coolify, dua hal ini **tidak dipakai** — hanya Dockerfile + `web/` yang aktif.

---

## Workflow migrasi (dari branch ini)

Saat PR `feat/nextjs-fullstack` di-merge ke `main`:
1. Coolify build ulang dengan Dockerfile baru.
2. Container Next.js jalan; `runSeed()` idempotent hanya seed bila tabel kosong (jadi aman untuk DB yang sudah ada 18 tabel + data).
3. Setelah smoke test production, PR follow-up bisa hapus `frontend/` + `backend/` legacy.

---

## Environment variables

Lihat `web/.env.example` untuk daftar lengkap. Ringkas:

| Var | Wajib | Keterangan |
|-----|-------|------------|
| `DATABASE_URL` | ✅ | `mysql://mariadb:<pw>@<host>:<port>/default` |
| `JWT_SECRET` | ✅ | Random 64+ char |
| `OWNER_USERNAME`, `OWNER_PASSWORD` | ✅ | Untuk seed pertama (idempotent) |
| `OWNER_NAME`, `OWNER_BUSINESS` | ⭕ | Metadata seed |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_ENDPOINT`, `R2_PUBLIC_BASE_URL` | ⭕ | Media R2. Kalau `R2_BUCKET` kosong → fallback disk |
| `R2_PREFIX` | ⭕ | Default `daneswara` |
| `PUBLIC_BASE_URL` | ⭕ | Untuk canonical URL SEO |
| `TIMEZONE` | ⭕ | Default `Asia/Makassar` |
| `SEED_CATALOG`, `SEED_CUSTOMERS`, `SEED_GALLERY` | ⭕ | Default `true` |

---

## Dokumentasi lain di repo

- **`DEPLOY.md`** — panduan lengkap deploy ke Coolify (env, ports, volume, health)
- **`memory/PRD.md`** — Product Requirements Document
- **`memory/NEXT_SESSION_NEXTJS.md`** — spesifikasi migrasi Next.js (rujukan utama)
- **`web/prisma/schema.prisma`** — skema DB hasil `db pull` (18 tabel)

---

## Kontak

Repo owner: [daneswara22](https://github.com/daneswara22) • Percetakan: **Daneswara Print**, Jl. Gunung Shangyang 156, Denpasar — Bali
