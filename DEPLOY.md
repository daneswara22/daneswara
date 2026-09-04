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
