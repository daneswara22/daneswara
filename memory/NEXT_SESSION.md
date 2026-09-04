# Prompt lanjutan (paste ke sesi agent berikutnya)

Lanjutkan project **Daneswara v2** (repo GitHub `daneswara22/daneswara`, branch `main`; kode ada di `/app`).
Baca dulu: `plan.md`, `memory/PRD.md`, `DEPLOY.md`, `backend/scripts/migrate_mongo_to_mariadb.py`. JANGAN ubah UI landing/POS yang sudah ada.

## Kondisi sekarang
- Stack: React (landing + DanesPOS + menu Galeri Website) + FastAPI/SQLAlchemy async + **MariaDB** + R2/WebP (fallback disk). Docker root `Dockerfile` (nginx+API, port 80) untuk Coolify.
- Preview sudah tersambung ke MariaDB produksi Biznet (`103.175.220.31:6796`, db `default`, user `mariadb`) - 18 tabel + seed (49 kategori/300 produk/648 pelanggan/14 galeri). `DATABASE_URL` ada di `backend/.env` (tidak di-commit).
- Data lama masih di **MongoDB Atlas** (URI ada di file DanesProd.txt yang saya upload; db `test_database`). Belum dimigrasi karena Atlas memblokir IP (sandbox `34.7.135.173`, VPS `103.175.220.31`) - saya akan membuka Network Access di Atlas.
- R2: kredensial ada di DanesProd.txt, **nama bucket belum ada** -> minta ke saya, isi `R2_BUCKET`, jalankan `python scripts/r2_setup.py --check --cors`.

## Tugas sesi ini: MIGRASI DINAMIS (Owner-only, dari dashboard)
1. **Backend** `backend/app/routers/migration.py` (prefix `/api/admin/migration`, role Owner):
   - `POST /preview` body `{mongo_uri, db_name?}` -> koneksi ke Mongo, kembalikan daftar koleksi + jumlah dokumen + field yang tidak dikenal skema (pakai logika `coerce()` di `scripts/migrate_mongo_to_mariadb.py`; refactor script itu menjadi modul `app/migration.py` yang bisa dipakai CLI maupun API).
   - `POST /start` body `{mongo_uri, db_name?, wipe: bool, convert_images: bool}` -> jalankan di **BackgroundTask** (satu job aktif saja), simpan progres di tabel `migration_jobs` (id, status, started_at, finished_at, total, done, current_collection, log JSON, error).
   - `GET /status` -> job terakhir + progres; `POST /cancel`.
   - Jangan pernah menyimpan/mencatat URI Mongo (mengandung password) di DB/log.
   - Password user tetap kompatibel: Mongo menyimpan bcrypt `$2b$` -> langsung dipakai.
   - Setelah selesai: refresh `settings` dan pastikan akun Owner (`OWNER_USERNAME`) tetap bisa login (lihat `seed_owner`).
2. **Frontend** halaman `src/pages/DataMigration.jsx` di `/app/migrasi` (menu "Migrasi Data", Owner saja, ikon `DatabaseZap`):
   - Form URI Mongo (type password) + tombol **Cek** -> tabel koleksi/jumlah; checkbox "Hapus data seed dulu (wipe)" & "Konversi gambar ke WebP/R2"; tombol **Mulai Migrasi**.
   - Progress bar + log realtime (poll `GET /status` tiap 2s), state selesai/gagal, tombol "Ulangi".
   - Gaya sama dengan halaman POS lain (shadcn, `data-testid` lengkap).
3. **Jalankan migrasi nyata** dari UI ke MariaDB produksi setelah Atlas dibuka, lalu verifikasi jumlah baris per tabel vs koleksi Mongo; pastikan dashboard/laporan menampilkan data lama dengan benar (timezone Asia/Makassar).
4. Set `SEED_CATALOG=false`, `SEED_CUSTOMERS=false` di `DEPLOY.md`/compose setelah migrasi.
5. Jalankan **testing agent** (backend + frontend) untuk fitur migrasi, lalu commit ke branch `feat/dynamic-migration` dan **buat Pull Request ke `main`** (saya yang merge). Jangan push langsung ke main. Jangan commit `.env`/secret.

## Info teknis penting
- Backend jalan via supervisor (`supervisorctl restart backend`), MariaDB lokal dev via `scripts/dev/mariadb-run.sh` (tidak dipakai lagi bila `.env` menunjuk ke Biznet).
- Semua route API prefix `/api`; frontend pakai `REACT_APP_BACKEND_URL`.
- Untuk push/PR pakai token GitHub di DanesProd.txt (jangan pernah menampilkan token di output).
