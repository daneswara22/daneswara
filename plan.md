# Development Plan — Daneswara Full Refactor (Landing + DanesPOS)

## 1) Objectives
- Merge **Landing UI (zip1, recovered source)** + **DanesPOS UI (zip2)** into **one React app** while keeping both UIs visually identical.
- Rewrite backend from **FastAPI + Mongo** → **FastAPI + SQLAlchemy (async) + MariaDB (aiomysql)**.
- Centralize media: convert uploads to **WebP** and store on **Cloudflare R2 (S3 via boto3)** with **local-disk fallback**.
- Turn **Gallery Manager** into **one menu inside POS dashboard**; landing consumes via `GET /api/public/gallery`.
- Provide **Coolify-ready Docker**: backend Dockerfile + frontend multi-stage Nginx Dockerfile with `/api` proxy + `docker-compose.yml`.
- Provide **Mongo Atlas → MariaDB migration tooling** and **R2 setup tooling** for production cutover.
- Ensure **preview/sandbox resiliency**: local MariaDB under supervisor (wait for binaries) + backend retries DB at startup.

**Status:** All core objectives above are **DONE** and **tested** in preview; production cutover depends on user-provided infra inputs (R2 bucket name + Atlas allowlist).

## 2) Implementation Steps

### Phase 1 — Core POC (prove hardest integrations before building everything)
**Core risk = (MariaDB async schema + R2 media pipeline + public gallery API + image conversion).**

User stories:
1. As an admin, I can create/read/update/reorder gallery items via API.
2. As a public visitor, I can load landing gallery via `GET /api/public/gallery`.
3. As an admin, I can upload an image and it is stored as WebP (R2 or local fallback).
4. As an admin, I can seed initial gallery from existing `gallery.json` and images are normalized to WebP.
5. As a developer, I can run the stack locally and pass a smoke script.

Steps:
1. **DB foundation**
   - Add SQLAlchemy async setup, session management (idempotent `create_all` for MVP).
   - Define models incl. `tenant_id` for future (single-tenant now).
2. **Auth seed (minimal)**
   - Implement login (JWT cookie + Bearer) and seed owner on startup.
3. **Storage module POC**
   - Implement `storage.py`: WebP conversion + upload to R2; fallback to `/api/files` when R2 not configured.
4. **Gallery API POC**
   - `GET /api/public/gallery` sorted.
   - POS endpoints: `GET/POST/PUT/DELETE /api/gallery` + `POST /api/gallery/reorder`.
5. **Seed scripts POC**
   - Import `gallery.json` (14 items), convert data-URI to WebP, upload.
6. **Validation**
   - Smoke script: create → reorder → fetch public.

✅ **Completed**
- Backend migrated to MariaDB async; schema auto-created.
- Storage module converts images to WebP; local fallback verified.
- Gallery API + seed completed and verified.


### Phase 2 — V1 App Development (merge UIs; keep visuals identical)
User stories:
1. As a visitor, I see the landing page identical to zip1 at `/`.
2. As a visitor, `/galeri` shows the full gallery identical to zip1.
3. As staff, I can login at `/login` with the same UI as zip2.
4. As staff, I can use POS at `/pos` and dashboard at `/app/*` identical to zip2.
5. As owner/admin, I can manage gallery inside dashboard and see it reflected on landing.

Steps:
1. **Frontend merge (single React app)**
   - Import landing components/pages recovered from sourcemap.
   - Scope landing theme under `.dp-landing` to prevent bleed into POS.
   - Mount POS under `/app/*`, cashier at `/pos`.
   - Map routes:
     - Landing: `/`, `/galeri`, `/gallery`, `/price-list`, `/price-list-print-only`, `/order`
     - Redirect `/admin` → `/login`
     - POS: `/login`, `/pos`, `/app/*`
     - Legacy POS paths `/produk` etc redirect to `/app/*`
2. **Unify API client**
   - Use axios base `${REACT_APP_BACKEND_URL}/api` with credentials; support empty backend URL for same-origin nginx proxy.
3. **Gallery Manager UI in POS**
   - Add one new menu entry (Owner/Manager) “Galeri Website”.
   - CRUD + reorder + upload (WebP) via `/api/upload`.
4. **Media changes in POS**
   - Replace base64-in-DB images with upload URLs for products/categories/logo.
5. **Seed core business data**
   - Customers 648, catalog 49 categories / 300 products, settings, gallery 14.
6. **E2E test**
   - Landing shows dynamic gallery from API.
   - Login → Dashboard → Galeri Website reflects on landing.

✅ **Completed**
- Landing verified via screenshots and test agent.
- POS routes `/login`, `/pos`, `/app/*` verified.
- Gallery Manager in dashboard verified (count, CRUD, reorder, website reflection).
- Product/category/logo image uploads now go through `/api/upload` (no base64 storage).


### Phase 3 — Productionization for Coolify (Docker + Ops)
User stories:
1. As an operator, I can deploy backend+frontend with docker-compose on Coolify.
2. As an operator, `/api/health` returns healthy behind Nginx proxy.
3. As an operator, I can configure R2 and DB via env.
4. As an operator, static caching works for frontend while API remains dynamic.
5. As an operator, seed runs once safely (idempotent).

Steps:
1. **Docker**
   - Backend Dockerfile uses `requirements.prod.txt` (lean deps).
   - Frontend multi-stage build → Nginx serve + `/api` proxy to backend.
   - `docker-compose.yml` wiring for Coolify.
2. **Env contract**
   - DB: `DATABASE_URL`.
   - R2: `R2_ENDPOINT`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_PUBLIC_BASE_URL`, `R2_PREFIX`.
3. **Docs**
   - `README.md` + `DEPLOY.md` for Coolify.

✅ **Completed**
- Dockerfiles + nginx proxy + compose + docs created.
- Production build validated (`yarn build` succeeded).


### Phase 4 — Migration + Cutover (Mongo Atlas → MariaDB, R2 enablement)
User stories:
1. As an operator, I can migrate legacy Mongo data to MariaDB safely.
2. As an operator, I can enable R2 and confirm uploads/public URLs work.

Steps:
1. **Migration tool**
   - Use `backend/scripts/migrate_mongo_to_mariadb.py`:
     - `--dry-run` to inspect collections/fields.
     - `--wipe` to clear seeded transactional tables.
     - Converts base64 data-URI images to WebP and uploads to storage.
2. **Atlas allowlist**
   - Add IP allowlist in Atlas:
     - Sandbox egress IP: `34.7.135.173`
     - VPS/Coolify IP: `103.175.220.31`
3. **R2 setup**
   - Fill env `R2_BUCKET` (token can’t `ListBuckets`, bucket name must be provided).
   - Run `backend/scripts/r2_setup.py --check` and `--cors`.
4. **Post-cutover**
   - Disable seed (`SEED_* = false`) once production data migrated.

✅ **Completed (tooling)**
- Migration script implemented and tested against mock Mongo.
- R2 helper script implemented.

⏳ **Pending user inputs / infra**
- R2 bucket name (`R2_BUCKET`).
- Atlas Network Access allowlist for migration runner IP.


## 3) Next Actions
1. **Provide R2 bucket name** and confirm `R2_PUBLIC_BASE_URL` policy (r2.dev public domain).
2. **Atlas allowlist**: add `34.7.135.173` (sandbox) and/or `103.175.220.31` (VPS) so migration can connect.
3. Run migration on Coolify backend terminal:
   - `python scripts/migrate_mongo_to_mariadb.py --mongo "mongodb+srv://..." --dry-run`
   - `python scripts/migrate_mongo_to_mariadb.py --mongo "mongodb+srv://..." --wipe`
4. Enable R2 in env, run:
   - `python scripts/r2_setup.py --check`
   - `python scripts/r2_setup.py --cors`
5. Coolify ops notes:
   - phpMyAdmin akses via **http**: `http://phpmyadmin-...sslip.io/`
   - MariaDB publik `103.175.220.31:7897` menolak user `mariadb` (production recommended pakai internal hostname `b0vbpdmzlvngrbnqqzfvse5j`).

## 4) Success Criteria
- Landing routes render pixel-identical to zip1 and load gallery from API.
- POS routes render identical to zip2; login works with owner credentials from env.
- Gallery Manager exists as **one dashboard menu**; CRUD + reorder works; landing updates.
- Uploads are WebP and stored on R2 when configured; otherwise served from local fallback.
- Coolify deployment works via provided Dockerfiles + compose; `/api/health` ok.
- Migration script can import legacy Mongo data (incl. base64 images) into MariaDB.
- Repo pushed to GitHub `ClientSca7452/daneswara` `main` with secrets scrubbed and `.env` ignored.
