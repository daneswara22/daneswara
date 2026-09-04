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