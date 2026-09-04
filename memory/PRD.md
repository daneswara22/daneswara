# Daneswara Print - Website + DanesPOS (Refactor v2)

## Tujuan
Satu aplikasi: landing page daneswaraprint (UI zip 1, tetap) + DanesPOS dashboard (UI zip 2, tetap) + **Galeri Website** (1 menu baru di dashboard) yang mengisi galeri landing.
Stack baru total: FastAPI + SQLAlchemy async + **MariaDB**, media **Cloudflare R2** (WebP), Docker + docker-compose untuk **Coolify**.

## Rute
- Publik: `/`, `/galeri` `/gallery`, `/price-list`, `/price-list-print-only`, `/order`; `/admin` -> `/login`
- POS: `/login`, `/pos`, `/app` (+ `/app/produk` ... `/app/galeri-web` ... `/app/pengaturan`); path lama `/produk` dst redirect ke `/app/*`

## Backend (backend/)
- `server.py` (lifespan: tunggu DB, create_all, seed), `app/config.py`, `app/db.py`, `app/models.py`, `app/security.py` (bcrypt+JWT cookie/bearer), `app/storage.py` (R2/WebP/fallback `/api/files`), `app/routers/*`
- Seed idempoten: owner (OWNER_USERNAME/PASSWORD), settings, katalog 49 kategori/300 produk (export_items.csv), 648 pelanggan, 14 galeri (gallery_seed.json -> WebP)
- `scripts/migrate_mongo_to_mariadb.py` (upsert by id, base64 -> WebP -> storage, --wipe/--dry-run)
- `scripts/r2_setup.py` (check/cors/sync-assets)

## Frontend (frontend/)
- `src/landing/*` (source landing dipulihkan dari sourcemap, tema ter-scope `.dp-landing`, `useGallery` -> `/api/public/gallery`)
- `src/pages/GalleryManager.jsx` (CRUD + urutan + upload WebP), Layout NAV `/app/*` + "Galeri Website"
- Upload gambar produk/kategori/logo -> `POST /api/upload?kind=` (bukan base64 lagi)
- `lib/api.js`: REACT_APP_BACKEND_URL kosong => relatif `/api` (nginx proxy)

## Deploy
- `docker-compose.yml` (backend + frontend nginx proxy), `DEPLOY.md`, `.env.example`
- Preview sandbox: MariaDB lokal via supervisor (`scripts/dev/mariadb-run.sh`, data `/root/mariadb-data`)

## Kredensial test
- Owner: admin / <lihat backend/.env OWNER_PASSWORD> ; Kasir: kasirtest / Kasir123

## Status / Pending (butuh user)
- R2: nama bucket belum diketahui (token tidak bisa ListBuckets) -> isi `R2_BUCKET` di backend/.env & Coolify
- Migrasi Mongo Atlas: IP sandbox 34.7.135.173 / VPS 103.175.220.31 harus diizinkan di Atlas Network Access
- MariaDB baru (VPS 103.175.220.31): internal `e5t5yllm46db0cnsu9fwv3cv:3306`, publik `:6796`; remote ditolak (1130 host not allowed) sampai user `daneswaraprod`@`%` dibuat - lihat DEPLOY.md 5b
