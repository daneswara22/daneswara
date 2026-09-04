# Daneswara Print - Website + DanesPOS (Cloud POS)

Satu aplikasi: **landing page daneswaraprint** (publik) + **DanesPOS dashboard** (login) dengan **Galeri Website** dikelola dari dashboard.

| Layer | Teknologi |
|---|---|
| Frontend | React 19 (CRA + craco), Tailwind, shadcn/ui, React Router 7 |
| Backend | FastAPI, SQLAlchemy 2 (async) + aiomysql |
| Database | **MariaDB** (Coolify) |
| Media | **Cloudflare R2** (S3 API) - semua upload dikonversi ke **WebP** otomatis; fallback disk lokal bila R2 belum diisi |
| Deploy | Docker (multi-stage) + docker-compose untuk **Coolify** |

## Rute

| Path | Halaman |
|---|---|
| `/` | Landing (Hero, Marquee, Galeri, Harga, Cara Kerja, Penawaran, Kontak) |
| `/galeri`, `/gallery` | Galeri lengkap (data dari dashboard) |
| `/price-list`, `/price-list-print-only`, `/order` | Kalkulator harga & form order |
| `/login` | Login DanesPOS (`/admin` -> `/login`) |
| `/pos` | Layar kasir |
| `/app` | Dashboard; `/app/produk`, `/app/kategori`, `/app/inventory`, `/app/pelanggan`, `/app/pesanan`, `/app/riwayat`, `/app/supplier`, `/app/pembelian`, `/app/pengeluaran`, `/app/pendapatan-lain`, `/app/laporan`, `/app/ekspor`, **`/app/galeri-web`**, `/app/pengguna`, `/app/pengaturan` |

Semua API di bawah `/api` (lihat `backend/app/routers/`). Endpoint publik: `GET /api/public/gallery`, `GET /api/health`.

## Struktur

```
backend/
  server.py            app FastAPI (lifespan: tunggu DB -> create tables -> seed)
  app/config.py        env (DATABASE_URL, JWT, OWNER_*, R2_*, TIMEZONE)
  app/db.py            engine async MariaDB
  app/models.py        skema tabel (UUID char(36), JSON untuk item transaksi)
  app/storage.py       R2 + WebP + fallback lokal
  app/routers/         auth, users, catalog, sales, orders, purchases, customers, finance, reports, settings, admin, gallery, uploads
  app/seed.py          owner, katalog (data/export_items.csv), pelanggan, galeri
  scripts/migrate_mongo_to_mariadb.py   migrasi data lama (MongoDB Atlas) -> MariaDB
  scripts/r2_setup.py                   cek bucket, CORS, sync aset statis
  Dockerfile, requirements.prod.txt
frontend/
  src/landing/         landing page (komponen, i18n, tema vintage ter-scope .dp-landing)
  src/pages/           halaman POS (+ GalleryManager.jsx)
  src/components/      Layout, ProtectedRoute, ui/
  Dockerfile, nginx.conf (SPA + proxy /api -> backend)
docker-compose.yml     untuk Coolify (Docker Compose build pack)
DEPLOY.md              langkah deploy & migrasi
```

## Jalankan lokal (dev)

```bash
# backend
cd backend && cp .env.example .env   # isi DATABASE_URL MariaDB
pip install -r requirements.prod.txt
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
# frontend
cd frontend && yarn && REACT_APP_BACKEND_URL=http://localhost:8001 yarn start
```

Akun awal (seed): `OWNER_USERNAME` / `OWNER_PASSWORD` dari env (default `admin` / `ChangeMe123!` - **wajib diganti**). Ganti setelah deploy.
