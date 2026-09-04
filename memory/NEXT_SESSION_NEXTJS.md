# Prompt: Migrasi ke Next.js Fullstack (paste ke sesi agent berikutnya)

Migrasikan project **Daneswara v2** (repo `daneswara22/daneswara`, kode di `/app`) dari **React CRA + FastAPI (Python)** menjadi **Next.js 15 fullstack (TypeScript)** dengan database **MariaDB yang sudah ada** dan media **Cloudflare R2**. UI landing & DanesPOS **harus tetap identik** (pakai ulang komponen yang ada). Baca dulu: `plan.md`, `memory/PRD.md`, `DEPLOY.md`, `backend/app/models.py`, `backend/app/routers/*`, `frontend/src/App.js`, `frontend/src/components/Layout.jsx`.

## Target stack
- **Next.js 15 (App Router) + TypeScript**, Tailwind + shadcn/ui (komponen `frontend/src/components/ui` dipindah apa adanya).
- **Prisma** (atau Drizzle) -> MariaDB. Skema diambil dari DB yang sudah ada: `prisma db pull` dari `DATABASE_URL` (18 tabel: tenants, users, categories, products, stock_movements, sales, orders, purchases, held_orders, customers, suppliers, expenses, other_income, finance_categories, settings, user_settings, activities, gallery_items). **Jangan ubah skema/nama kolom** agar data & migrasi Mongo tetap kompatibel.
- Auth: JWT (jose) di **httpOnly cookie** + Bearer, password **bcrypt** (hash `$2b$` lama tetap valid) -> `bcryptjs`.
- Media: `@aws-sdk/client-s3` ke R2 (endpoint `https://<account>.r2.cloudflarestorage.com`), konversi **WebP via `sharp`**, fallback simpan ke disk `/data/uploads` bila `R2_BUCKET` kosong. Key `daneswara/<kind>/<uuid>.webp`.
- Validasi input: **Zod** (port dari `backend/app/schemas.py`).
- Deploy: `output: "standalone"`, `Dockerfile` root (node:20-alpine, port 80/3000) untuk Coolify build pack Dockerfile.

## Struktur yang diminta
```
app/
  (landing)/           layout.tsx (tema .dp-landing, LangProvider), page.tsx (/), galeri/, gallery/, price-list/, price-list-print-only/, order/   -> SSG/ISR (revalidate 60) + SEO metadata
  admin/ -> redirect /login
  login/page.tsx
  pos/page.tsx                       ("use client")
  app/layout.tsx (Layout POS + guard) + app/page.tsx (Dashboard) + app/produk ... app/galeri-web, app/pengguna, app/pengaturan   ("use client")
  api/                               Route Handlers 1:1 dengan FastAPI (prefix /api tetap!) 
    auth/{login,logout,me,change-password}, users, categories(+reorder), products(+reorder), stock(+movements), sales(+refund), held-orders,
    orders(+deposit,complete), suppliers, purchases(+from-order,from-product,receive), customers(+history), finance-categories, expense-categories,
    expenses, other-income-categories, other-income, dashboard, reports/{sales,monthly,profit-loss,cash-flow}, settings, admin/{clear-transactions,reprice-catalog,reset-stock},
    export/[dataset], gallery(+reorder), public/gallery, upload, storage/status, health, files/[...path] (fallback lokal)
lib/  db.ts (prisma), auth.ts, storage.ts (R2+sharp), tz.ts (Asia/Makassar), seed.ts, migration/mongo.ts (port scripts/migrate_mongo_to_mariadb.py)
components/ (ui/, pos/, landing/)   i18n/ (translations landing)
```
**Bentuk JSON response harus sama persis** dengan backend Python sekarang (frontend POS tidak diubah logikanya; cukup ganti `lib/api.js` -> baseURL relatif `/api`).

## Aturan bisnis yang wajib dipertahankan (lihat router Python)
- Role: Owner, Manager, Kasir, Gudang (matriks akses per route sama).
- Penjualan: kurangi stok + stock_movements, nomor `INV-yymmdd-####`, refund kembalikan stok. Pesanan custom: Draft (DP 0) -> Proses (DP) -> Selesai (buat sale `from_order`). PO: Menunggu -> Diterima (tambah stok, update cost); hapus PO diterima hanya Owner (koreksi stok).
- Laporan pakai zona waktu `TIMEZONE` (default Asia/Makassar); expenses/other_income pakai kolom `date`.
- Seed idempoten saat start (owner dari env `OWNER_USERNAME/OWNER_PASSWORD`, katalog `data/export_items.csv`, `seed_customers.json`, galeri) - hanya bila tabel kosong.
- Settings printer per user (`user_settings`), settings bisnis per tenant.
- Galeri publik `GET /api/public/gallery` tanpa auth, urut `sort_order desc`.

## Langkah kerja
1. Init Next.js di folder `web/` (jangan hapus `frontend/` & `backend/` sampai paritas tercapai), pindahkan komponen UI + CSS (tema landing ter-scope `.dp-landing`, font Anton/Work Sans/Caveat, POS Outfit/Inter).
2. Prisma `db pull` -> generate; `lib/db.ts` singleton.
3. Implement API route handlers per modul, uji paritas dengan curl terhadap backend Python (bandingkan JSON).
4. Port halaman landing (SSG + metadata/OG, sitemap, robots) lalu POS (client components), Gallery Manager, upload WebP.
5. Port skrip migrasi Mongo -> `lib/migration/mongo.ts` + halaman `/app/migrasi` (Owner) dengan progres (lihat `memory/NEXT_SESSION.md`).
6. `Dockerfile` standalone + `DEPLOY.md` diperbarui; hapus `frontend/`, `backend/`, compose lama setelah paritas 100%.
7. Jalankan **testing agent** (API + UI: landing, login, dashboard, POS sale, galeri, upload). Commit ke branch `feat/nextjs-fullstack`, **buat Pull Request ke `main`** (saya yang merge). Jangan push langsung ke main, jangan commit `.env`/secret, jangan tampilkan token/password di output.

## Env (lihat `backend/.env.example`)
`DATABASE_URL` (mysql://mariadb:<pass>@b0vbpdmzlvngrbnqqzfvse5j:3306/default di Coolify; publik 103.175.220.31:6796 untuk dev), `JWT_SECRET`, `OWNER_*`, `TIMEZONE`, `PUBLIC_BASE_URL`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT`, `R2_BUCKET`, `R2_PUBLIC_BASE_URL`, `R2_PREFIX`, `SEED_*`. Kredensial ada di DanesProd.txt yang saya upload.
