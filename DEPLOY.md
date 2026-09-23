# Deployment Guide - Daneswara v2 (Next.js 15 fullstack)

## Overview

Single-container Next.js 15 App with standalone output. Coolify deploys via **Dockerfile** build pack.

## Coolify Setup

1. **New Resource -> Docker Image / Dockerfile**
   - Repository: `https://github.com/daneswara22/daneswara.git`
   - Branch: `main` (after PR merge)
   - Build Pack: **Dockerfile**
   - Dockerfile path: `./Dockerfile` (root)
   - Build context: `.` (root)

2. **Environment Variables** (Coolify -> Environment tab):

   Required:
   ```env
   DATABASE_URL=mysql://mariadb:<password>@b0vbpdmzlvngrbnqqzfvse5j:3306/default
   JWT_SECRET=<long-random-string>
   OWNER_USERNAME=admin
   OWNER_PASSWORD=<strong-password>
   OWNER_NAME=Owner
   OWNER_BUSINESS=Daneswara Print
   TIMEZONE=Asia/Makassar
   PUBLIC_BASE_URL=https://daneswaraprint.com

   R2_ACCOUNT_ID=74c0281094eec575e203814b144bc86d
   R2_ACCESS_KEY_ID=<access-key>
   R2_SECRET_ACCESS_KEY=<secret-key>
   R2_ENDPOINT=https://74c0281094eec575e203814b144bc86d.r2.cloudflarestorage.com
   R2_BUCKET=daneswaraobjectr2
   R2_PUBLIC_BASE_URL=https://cdn.daneswara.com
   R2_PREFIX=daneswara

   SEED_CATALOG=true
   SEED_CUSTOMERS=true
   SEED_GALLERY=true
   ```

3. **Ports**
   - Container port: `3000` (Next.js)
   - Coolify auto-generates a URL; add custom domain `daneswaraprint.com` if desired

4. **Persistent Storage (optional local fallback)**
   - Volume: `/data/uploads` -> host path (only used when `R2_BUCKET` is empty; R2 is preferred)

5. **Health Check**
   - Configured in Dockerfile (`GET /api/health` every 30s)

## Database
- MariaDB is deployed as a separate Coolify resource; already contains 18 tables + seed data.
- Prisma is used with `db pull` only. **DO NOT** run `prisma migrate` against production - migrations can drop columns.
- On first boot the app seeds Owner/settings if the `users` table is empty (idempotent).

### Perubahan skema database
Karena `prisma migrate` tidak dipakai di sini, tabel/kolom baru **tidak ikut terpasang otomatis saat deploy**. Kalau sebuah fitur baru sudah ter-merge tetapi tabelnya belum ada di produksi, gejalanya muncul sebagai error Prisma `P2021` di UI, misalnya "The table `custom_tee_orders` does not exist in the current database" saat menekan "Cek Harga".

> **Pengaman otomatis (sejak 2026-09-23).** Untuk fitur **Jenis Produk** dan **Font kustom**, ada jaring pengaman di `web/lib/schemaGuard.ts`. Sebelum endpoint-nya menyentuh tabel, kode memastikan dulu tabel/kolom yang dibutuhkan ada, dan membuatnya kalau belum. Semua perintahnya **aditif dan idempotent** (hanya `CREATE TABLE IF NOT EXISTS` dan `ADD COLUMN` yang dijaga `information_schema`; tidak ada `DROP` apa pun), dijalankan sekali per proses. Jadi kedua fitur itu tidak akan pernah tampak rusak hanya karena migrasi terlewat. Untuk fitur lain, alur manual di bawah tetap berlaku. Berkas SQL di `web/prisma/sql/` tetap dipertahankan sebagai jejak riwayat dan boleh dipakai manual.

Alur yang dipakai:

1. Cek selisih antara database dan `schema.prisma` (read-only, tidak mengubah apa pun):
   ```bash
   cd web
   npx prisma migrate diff --from-url "$DATABASE_URL" \
     --to-schema-datamodel prisma/schema.prisma --script
   ```
   Kalau hasilnya `-- This is an empty migration.` berarti skema sudah sinkron.
2. Periksa hasilnya. Ambil **hanya** pernyataan aditif (`CREATE TABLE`, `CREATE INDEX`, `ADD COLUMN`). Jangan pernah menjalankan `DROP`/`ALTER ... DROP` dari hasil diff ke produksi.
3. Simpan pernyataan itu sebagai berkas SQL di `web/prisma/sql/<tanggal>_<nama>.sql` supaya ada jejaknya, lalu terapkan:
   ```bash
   mysql -h <host> -P <port> -u <user> -p default < web/prisma/sql/<tanggal>_<nama>.sql
   ```
4. Ulangi langkah 1 untuk memastikan hasilnya sudah kosong, lalu cek `GET /api/health` -> `database: ok`.

Riwayat SQL yang sudah diterapkan ada di `web/prisma/sql/`.

## Cloudflare R2
- Bucket: `daneswaraobjectr2`
- CDN domain: `https://cdn.daneswara.com`
- Media uploads (product images, category images, gallery photos, logos) are converted to WebP via `sharp` and stored under `daneswara/<kind>/<uuid>.webp`.
- If any R2 env var is missing, the app falls back to local disk `/data/uploads` and serves files via `/api/files/<...path>`.

## Backups (recommended)
- **DB**: use Coolify's MariaDB backup schedule.
- **R2**: enable object versioning + lifecycle policy in Cloudflare dashboard.

## Post-deploy checklist
- [ ] `GET https://<domain>/api/health` returns `{ "status": "healthy", "database": "ok" }`
- [ ] `POST /api/auth/login` works with your owner credentials
- [ ] Landing page `/` renders identical to preview
- [ ] Gallery images load from `cdn.daneswara.com`

## Local development
```bash
cd web
cp .env.example .env  # fill in real values (do not commit)
yarn install
npx prisma generate
yarn dev
```

## Legacy code
- `frontend/` (React CRA) and `backend/` (FastAPI Python) remain in the repo temporarily during migration.
- After parity is confirmed in production, they may be removed in a follow-up PR.
- The Coolify Docker build does **not** use `frontend/` or `backend/` code - only the root `Dockerfile` + `web/` are used.
