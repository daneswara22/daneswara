# Development Plan — Daneswara Full Refactor (Landing + DanesPOS)

## 1) Objectives
- Merge **Landing UI (zip1, recovered source)** + **DanesPOS UI (zip2)** into **one React app** while keeping both UIs visually identical.
- Rewrite backend from **FastAPI + Mongo** → **FastAPI + SQLAlchemy (async) + MariaDB (aiomysql)**.
- Centralize media: convert uploads to **WebP** and store on **Cloudflare R2 (S3 via boto3)** with **local-disk fallback**.
- Turn **Gallery Manager** into **one menu inside POS dashboard**; landing consumes via `GET /api/public/gallery`.
- Provide **Coolify-ready Docker**: backend Dockerfile + frontend multi-stage Nginx Dockerfile with `/api` proxy + `docker-compose.yml`.

## 2) Implementation Steps

### Phase 1 — Core POC (prove hardest integrations before building everything)
**Core risk = (MariaDB async migrations + R2 media pipeline + public gallery API + image conversion).**

User stories:
1. As an admin, I can create/read/update/reorder gallery items via API.
2. As a public visitor, I can load landing gallery via `GET /api/public/gallery`.
3. As an admin, I can upload an image and it is stored as WebP (R2 or local fallback).
4. As an admin, I can seed initial gallery from existing `gallery.json` and images are normalized to WebP.
5. As a developer, I can run the stack locally (MariaDB + backend) and pass a smoke script.

Steps:
1. **DB foundation**
   - Add SQLAlchemy async setup, session management, and Alembic (or simple idempotent migration scripts for MVP).
   - Define minimal models: `users`, `customers`, `categories`, `products`, `gallery_items`, `settings`.
   - Ensure tenant scoping is optional for MVP (single-tenant) but keep `tenant_id` column stubbed for future.
2. **Auth seed (minimal)**
   - Implement login (JWT) and seed `admin / <lihat backend/.env OWNER_PASSWORD>` on startup.
3. **Storage module POC**
   - Implement `storage.py`: `put_object()`, `delete_object()`, `get_public_url()`.
   - R2 first; if any S3 call fails → fallback to local `/app/backend/uploads` served by backend.
   - Implement `images.py`: decode data-URI/file → Pillow convert to WebP (quality target + max dimension).
4. **Gallery API POC**
   - `GET /api/public/gallery` returns sorted items for landing.
   - POS-only endpoints: `GET/POST/PUT/DELETE /api/gallery` + `POST /api/gallery/reorder`.
5. **Seed scripts POC**
   - Import `gallery.json` (14 items): convert any data-URI to WebP and upload.
   - Smoke script: create gallery item → reorder → fetch public endpoint.
6. **Validation**
   - Run POC script against local MariaDB.
   - If R2 not configured, verify local fallback serves WebP URLs correctly.

### Phase 2 — V1 App Development (merge UIs; keep visuals identical)
User stories:
1. As a visitor, I see the landing page identical to zip1 at `/`.
2. As a visitor, `/galeri` shows the full gallery identical to zip1.
3. As staff, I can login at `/login` with the same UI as zip2.
4. As staff, I can use POS at `/pos` and dashboard at `/app/*` identical to zip2.
5. As owner/admin, I can manage gallery inside dashboard and see it reflected instantly on landing.

Steps:
1. **Frontend merge (single React app)**
   - Import Landing components/pages recovered from sourcemap and keep Tailwind theme exactly.
   - Mount POS app under `/app/*` and keep `/pos` cashier route.
   - Map routes:
     - Landing: `/`, `/galeri`, `/gallery`, `/price-list`, `/price-list-print-only`, `/order`
     - Redirect `/admin` → `/login` (POS login)
     - POS: `/login`, `/pos`, `/app/*` (nested dashboard)
2. **Unify API client**
   - Keep existing axios base `${REACT_APP_BACKEND_URL}/api` with credentials.
3. **Gallery Manager UI in POS**
   - Add a single new menu entry (Owner/Manager) “Gallery Manager”.
   - Build UI to match zip1 admin behavior but styled like POS (or embed original layout if needed) while preserving functionality.
4. **Media changes in POS**
   - Product/category image + receipt logo uploads: switch from base64-in-DB to storage-backed URLs.
   - Update backend models to store `image_url` / `logo_url` fields.
5. **Seed core business data**
   - Customers: seed 648 from `seed_customers.json`.
   - Catalog: parse `export_items.csv` (300 rows) → categories + products.
   - Settings defaults.
6. **E2E test**
   - Run preview: login → open dashboard → gallery CRUD → landing reflects.
   - Call testing agent once; fix blockers before moving on.

### Phase 3 — Productionization for Coolify (Docker + Ops)
User stories:
1. As an operator, I can deploy backend+frontend+db with docker-compose on Coolify.
2. As an operator, `/api/health` returns healthy behind Nginx proxy.
3. As an operator, I can configure R2 and DB via environment variables.
4. As an operator, static caching works for frontend while API remains dynamic.
5. As an operator, seed runs once safely (idempotent).

Steps:
1. **Docker**
   - Backend Dockerfile: install deps, run uvicorn, include migration/seed entrypoint.
   - Frontend multi-stage build → Nginx serve + `/api` proxy to backend.
   - `docker-compose.yml`: `mariadb`, `backend`, `frontend` with env wiring.
2. **Env contract**
   - DB: `DATABASE_URL` (aiomysql) or discrete envs.
   - R2: `R2_ENDPOINT`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_PUBLIC_BASE`.
3. **Hardening**
   - Add basic rate limits for upload endpoints (optional MVP).
   - Ensure CORS/cookies for same-domain Nginx deployment.
4. **Testing**
   - Deploy-like run locally via compose; rerun tests + manual smoke.

### Phase 4 — Feature parity & cleanup (only after V1 stable)
User stories:
1. As owner, I can manage products/categories and images reliably with R2.
2. As cashier, printing/nota flows still work without regressions.
3. As owner, reports/exports still function with SQL.
4. As user, the app remains fast with images optimized as WebP.
5. As developer, codebase is modular and maintainable.

Steps:
- Port remaining Mongo queries to SQL equivalents (reports, exports, finance, orders).
- Optimize indexes and queries.
- Add migrations, tests, and data validation.

## 3) Next Actions
1. Confirm **R2 bucket name** + public base URL path policy (cannot `ListBuckets` from sandbox).
2. Confirm desired **public landing domain pathing** (single domain vs subdomain).
3. Start Phase 1 POC implementation in `/app`:
   - Add async DB layer + gallery models + storage+webp pipeline.
   - Add seed scripts and smoke script.
4. Run POC locally (MariaDB under supervisor in preview), then proceed to Phase 2 UI merge.

## 4) Success Criteria
- Landing routes render pixel-identical to zip1 and load gallery from API.
- POS routes render identical to zip2; login works with `admin/<OWNER_PASSWORD>`.
- Gallery Manager exists as **one dashboard menu**; CRUD + reorder works; landing updates instantly.
- Uploads are WebP and stored on R2 when configured; otherwise served from local fallback.
- Coolify deployment works via provided Dockerfiles + compose; `/api/health` ok.
