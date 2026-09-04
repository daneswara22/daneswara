# AGENTS.md — Panduan untuk AI Agent & Kontributor

> Dokumen ini dibaca lebih dulu oleh AI agent (Emergent E2, Cursor, dsb.) sebelum menyentuh kode.
> Tujuannya: sesi baru langsung paham arsitektur, cara menjalankan, dan **workflow Git wajib**.

---

## Bootstrap Sesi (RITUAL SETIAP SESI — kerjakan berurutan sebelum apa pun)

Pemilik selalu memulai sesi vibe-coding dengan memberi **3 input** ini (kadang dalam satu file `.txt`):

1. **GitHub PAT** + **nama repo** (mis. `daneswara22/daneswara`).
2. **Env produksi** (`DATABASE_URL` MariaDB, `JWT_SECRET`, `OWNER_*`, semua `R2_*`, `PUBLIC_BASE_URL`,
   `NEXT_PUBLIC_POS_URL`, dst.) — sering ada varian **host DB internal** (Coolify) *dan* **host DB publik**
   (`HOST:6796`) untuk dev di luar VPS.
3. Baru setelah itu: **permintaan fitur** (tambah/ubah fitur).

**Yang HARUS dilakukan agent, berurutan:**

```text
Langkah 1 — Clone & sinkron
  git clone https://<PAT>@github.com/<owner>/<repo>.git   (atau update remote yang ada)
  git fetch origin && cek commit/branch/PR TERBARU  ->  selaraskan ke `main` terakhir
  (sering ada PR yang di-merge pemilik di antara sesi; jangan bangun di atas kode basi)

Langkah 2 — Pasang env (JANGAN commit)
  Tulis env ke `web/.env` (bukan ke repo).
  DI SANDBOX (di luar jaringan Coolify) WAJIB pakai host MariaDB PUBLIK `HOST:6796`,
  BUKAN host internal Docker. Sisipkan tuning pool bila latensi tinggi:
    ...@HOST:6796/default?connection_limit=20&pool_timeout=30&connect_timeout=20&socket_timeout=60
  SEED_* = false untuk DB produksi yang sudah berisi data.

Langkah 3 — Sambungkan & BUKTIKAN MariaDB + Cloudflare R2 dulu (POC), sebelum sentuh fitur
  cd web && yarn install && npx prisma generate
  cd web && yarn test:core          # HARUS hijau: Prisma+18 tabel, tenants/users, bcrypt, JWT, sharp WebP, backend=r2
  curl -s $PUBLIC_URL/api/health     # database: ok
  (opsional) cd backend && python scripts/r2_cors.py   # pasang CORS bucket R2 (butuh token R2 Admin R/W)
  Restart layanan: sudo supervisorctl restart backend frontend

Langkah 4 — Login owner utk uji
  Password user lama (hasil migrasi) TIDAK diketahui -> JANGAN tebak.
  Buat/reset Owner: cd web && npx tsx scripts/ensure-admin.ts admin '<password>'

Langkah 5 — BARU kerjakan fitur
  Verifikasi dgn testing agent (skip drag-drop/kamera/bluetooth-printer).
  Setiap perubahan -> branch -> Pull Request -> pemilik REVIEW & MERGE MANUAL (lihat Workflow Git).
```

**Aturan mutlak selama bootstrap:** data = **produksi & hidup** → utamakan read-only, jangan seed/hapus
massal, jangan commit rahasia (repo **publik**), jangan push ke `main`.

---

## Prompt Baku Pemilik (verbatim — beginilah sesi dimulai & disimpan)

Pemilik memakai **metode token PAT** untuk load & save (BUKAN integrasi "connected Emergent ↔ GitHub").
Alasannya: lebih rapi & disiplin. Kenali dua prompt ini:

**A. Cara Load from GitHub** (awal sesi):
> hubungkan Ke Repository GitHub saya. Repo nya: `REPO KAKAK` dan **cek seluruh commit akhir-akhir
> yang telah saya kerjakan**, instal dependencies, dan jalankan app web saya di live preview Emergent.
> `github_pat_: ISI TOKEN KAKAK`

→ Artinya agent harus: pakai token 1 baris untuk clone/sync repo, **selalu cek commit/PR TERBARU
lebih dulu** (pemilik sering sudah merge PR diantara sesi), install deps, sambungkan MariaDB + R2,
lalu jalankan app di preview. (Lihat "Bootstrap Sesi" di atas.)

**B. Cara Save to GitHub** (akhir sesi / saat mau simpan):
> Buatkan saya **Pull Request** seluruh perubahan code yang berubah dari sesi chat Emergent ini ke
> repository GitHub saya. **Mulai dari PR #1; jika sudah ada Pull Request, sesuaikan / lanjutkan di
> PR terakhir.**

→ Artinya agent harus:
- Simpan lewat **Pull Request via token PAT**, JANGAN pakai fitur "connected Emergent to GitHub".
- **Nomori PR berurutan**: jika belum ada, mulai PR #1; jika sudah ada, lanjut mengikuti nomor PR
  terakhir yang berjalan. Jangan buat cabang yatim yang tumpang tindih.
- Satu sesi umumnya = satu PR yang koheren (push commit tambahan ke branch PR yang sama selama PR
  itu masih terbuka, daripada membuka banyak PR kecil terpisah).
- **Pemilik yang review & MERGE MANUAL.** Agent tidak pernah merge sendiri, tidak pernah push ke `main`.

---

## TL;DR (baca ini dulu)

1. **Kode hidup di `web/`** — satu app **Next.js 15 fullstack** (halaman + API routes di `web/app/api`).
   `backend/` hanya **bridge FastAPI tipis** yang mem-forward `/api/*` ke Next.js (khusus sandbox
   Emergent). `frontend/` juga cuma bridge (`yarn dev` → `web/`). Sumber CRA lama ada di
   `web/src_pages` & `web/components/landing` (di-import ulang via alias, jangan dihapus).
2. **Database MariaDB via Prisma** (`web/prisma/schema.prisma`, 18 tabel). **Cloudflare R2** untuk
   media (`web/lib/storage.ts`), disajikan dari `cdn.daneswara.com`.
3. **Data itu PRODUKSI & HIDUP.** Default utamakan operasi **read-only**. Jangan hapus/ubah massal.
   Jangan jalankan `/api/admin/clear-transactions`, `/reset-stock`, `/reprice-catalog`, atau refund
   pada data nyata. Kalau perlu tes tulis, buat 1 record ber-prefix `ZZ_TEST_` lalu hapus lagi.
4. **`.env` TIDAK PERNAH di-commit** (repo ini publik). Semua rahasia hanya di `web/.env` (lokal) /
   env Coolify. Jangan pernah menaruh password, kredensial DB, atau kunci R2 ke dalam kode/README/test.
5. **Workflow Git (WAJIB): jangan pernah push langsung ke `main`.** Selalu buat branch → buka Pull
   Request → **manusia yang review & merge manual.** Lihat bagian [Workflow Git](#workflow-git).

---

## Menjalankan & mengecek (sandbox)

```bash
# Sandbox berada DI LUAR jaringan Coolify, jadi web/.env memakai host MariaDB PUBLIK
# (HOST:6796), sedangkan produksi memakai host internal Docker.

cd web && yarn install && npx prisma generate
sudo supervisorctl restart backend frontend    # backend = bridge :8001, frontend = next :3000

# POC / sanity check inti (DB + R2 + bcrypt + JWT + WebP) — HARUS hijau semua:
cd web && yarn test:core

# Health (termasuk latency DB):
curl -s $PUBLIC_URL/api/health
```

Login Owner untuk uji: buat/reset via `cd web && npx tsx scripts/ensure-admin.ts admin '<password>'`
(password dari argumen atau env `OWNER_PASSWORD`; **tidak ada default hardcoded**). Password user
lama hasil migrasi tidak diketahui — jangan coba tebak.

---

## Peta arsitektur singkat

| Path | Isi |
|---|---|
| `web/app/(landing)` | Situs marketing "Daneswara Print" (port dari React statis) |
| `web/app/(pos)` | DanesPOS: login + dashboard `/app/*` + kasir `/pos` |
| `web/app/api/**` | Semua endpoint (`/api/*`), auth cookie/bearer JWT |
| `web/components/landing` | Komponen/pages/i18n landing (scoped di `.dp-landing`) |
| `web/src_pages`, `web/components` | Halaman & komponen POS (CRA-style, dipakai via alias) |
| `web/lib` | `db.ts` (Prisma), `storage.ts` (R2+sharp), `auth.ts`, `api.ts`, `media.ts`, `printer.js` |
| `web/middleware.ts` | Redirect `/` → `/login` untuk host POS (`pos.`/`app.`/`dashboard.`) |
| `backend/scripts/r2_cors.py` | Pasang CORS bucket R2 (butuh token Admin R/W) |
| `web/scripts/ensure-admin.ts` | Buat/reset akun Owner (idempotent, tanpa secret) |

Alur upload gambar: klien → `POST /api/upload?kind=...` → `sharp` konversi **WebP** → R2 →
URL `https://cdn.daneswara.com/daneswara/<kind>/<uuid>.webp`. Jangan kembalikan base64 data URI lagi.

---

## Jebakan yang sudah pernah menggigit (jangan diulang)

- **Logo hilang di struk/voucher.** Struk dirender ke `<canvas>` (html2canvas + ESC/POS
  `getImageData`). Gambar cross-origin tanpa header CORS akan **men-taint** canvas → logo hilang
  diam-diam. Solusi: bungkus SEMUA URL media yang masuk canvas dengan `canvasSafeUrl()`
  (`web/lib/media.ts`) yang merutekannya lewat proxy same-origin `GET /api/media?url=...`. Sudah
  dipakai di `printer.js`, `ReceiptShareCard.jsx`, `VoucherShareCard.jsx`. Bucket CORS juga
  dipasang via `backend/scripts/r2_cors.py`, tapi proxy adalah fix utamanya.
- **404 polos.** CRA lama punya catch-all `path="*" → /`. Di Next.js gunakan `web/app/not-found.tsx`
  (sudah ada, ber-branding). Jangan biarkan jatuh ke 404 default Next.
- **Route POS pindah prefix.** Semua menu dashboard sekarang `/app/*` (bukan `/produk`, dst.).
- **Aset landing = `.webp`** (bukan `.png`). Ada di `web/public/assets/`.
- **`NEXT_PUBLIC_*` di-"bake" saat `next build`.** Set `NEXT_PUBLIC_POS_URL` SEBELUM build, bukan
  runtime.
- **Prisma pool timeout (P2024)** saat DB remote latensi tinggi → tuning query-string
  `?connection_limit=..&pool_timeout=..&connect_timeout=..` di `DATABASE_URL`.

---

## Workflow Git

**Aturan emas: TIDAK pernah commit/push ke `main`. Selalu lewat Pull Request via token PAT
(BUKAN integrasi "connected Emergent ↔ GitHub"), di-merge MANUAL oleh pemilik setelah review.**
Lihat juga [Prompt Baku Pemilik](#prompt-baku-pemilik-verbatim--beginilah-sesi-dimulai--disimpan).

```bash
# 0. Autentikasi via token 1 baris (jangan simpan token ke file yang ter-commit)
#    remote url = https://x-access-token:<PAT>@github.com/<owner>/<repo>.git

# 1. Sinkron dengan main terlebih dulu (cek commit/PR TERBARU — pemilik sering merge antar sesi)
git fetch origin main

# 2. Branch fitur bermakna (feat/…, fix/…, docs/…, chore/…)
git switch -c fix/nama-perubahan origin/main

# 3. Commit fokus & deskriptif (Conventional Commits)
git add <file-yang-relevan-saja>        # JANGAN `git add .` membabi buta
git commit -m "fix(web): ringkas apa & kenapa"

# 4. Push branch + buka PR ke main — JANGAN merge sendiri
git push origin fix/nama-perubahan
#   lalu buka Pull Request; tunggu review & merge manual oleh pemilik.
```

**Penomoran & jumlah PR (samakan dengan ekspektasi pemilik):**
- Jika repo belum punya PR, mulai dari **PR #1**; jika sudah ada, **lanjutkan mengikuti PR terakhir**.
- **Satu sesi = satu PR koheren.** Selama PR sesi ini masih terbuka, **push commit tambahan ke branch
  PR yang sama** (jangan berhamburan buka banyak PR kecil). Kalau pemilik sudah terlanjur merge PR
  itu, barulah perubahan berikutnya masuk PR baru (follow-up) dengan nomor berikutnya.

Checklist sebelum buka PR:
- [ ] `cd web && yarn test:core` hijau, dan `npx tsx` / build tidak error.
- [ ] `npx eslint .` dari root exit 0 (config v9 sudah ada).
- [ ] Tidak ada rahasia (password, kredensial DB, kunci R2, PAT) di diff. Repo ini **publik**.
- [ ] `.env`, artefak sandbox, dan file berisi kredensial tidak ikut ter-commit.
- [ ] Perubahan yang menyentuh struk/media sudah pakai `canvasSafeUrl()`.
- [ ] Deskripsi PR menjelaskan **apa**, **kenapa**, dan **cara uji**.

---

## Jangan disentuh / jangan di-commit

- `web/.env`, `backend/.env`, env apa pun berisi nilai asli.
- File dokumentasi lokal berisi kredensial (mis. RUNBOOK sandbox) — biarkan di luar repo/gitignored.
- Skema/isi DB produksi lewat operasi destruktif.
- `main` secara langsung.
