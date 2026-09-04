# Deploy ke Coolify (VPS self-hosted)

Arsitektur produksi:

```
[Traefik/Coolify] --> frontend (nginx :80)  --/api/-->  backend (FastAPI :8001)  -->  MariaDB (Coolify, internal)
                                                                  \-->  Cloudflare R2 (media WebP)
```

## 1. Persiapan

- MariaDB sudah ada di project **Daneswara Client / production** (`MariadbSQL`). Internal URL:
  `mysql://daneswara:<password>@9cox2040sfl5xb5docwuqjlc:3306/default`
- Repo GitHub berisi `docker-compose.yml`, `backend/Dockerfile`, `frontend/Dockerfile`.

## 2. Buat resource di Coolify

1. **+ New Resource -> Public/Private Repository (GitHub)** -> pilih repo & branch `main`.
2. **Build Pack: Docker Compose**, compose file: `/docker-compose.yml`.
3. Di tab **Environment Variables** isi (minimal):

   | Key | Nilai |
   |---|---|
   | `DATABASE_URL` | `mysql://daneswara:<password>@9cox2040sfl5xb5docwuqjlc:3306/default` |
   | `JWT_SECRET` | string acak panjang |
   | `OWNER_USERNAME` / `OWNER_PASSWORD` | akun owner pertama |
   | `PUBLIC_BASE_URL` | `https://daneswaraprint.com` (domain frontend) |
   | `SEED_CATALOG` / `SEED_CUSTOMERS` | `false` jika akan migrasi data dari Mongo |
   | `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT`, `R2_BUCKET`, `R2_PUBLIC_BASE_URL` | dari Cloudflare R2 (kosongkan `R2_BUCKET` = simpan di disk) |

4. Service **frontend** -> set **Domain** (mis. `https://daneswaraprint.com`), port `80`.
   Service **backend** tidak perlu domain (diakses via proxy nginx `/api`).
5. Aktifkan **"Connect To Predefined Network"** (Advanced) agar `backend` bisa resolve hostname MariaDB Coolify.
6. **Deploy**. Cek: `https://<domain>/api/health` -> `{"status":"healthy","database":"ok",...}`.

## 3. Migrasi data lama (MongoDB Atlas -> MariaDB)

Jalankan **sekali** dari terminal container backend (Coolify -> backend -> Terminal), atau dari mesin mana pun yang bisa mengakses Atlas + MariaDB:

```bash
# lihat ringkasan koleksi & field yang akan dimigrasi (tanpa menulis)
python scripts/migrate_mongo_to_mariadb.py --mongo "mongodb+srv://USER:PASS@customer-apps.0vndh7.mongodb.net/?retryWrites=true&w=majority" --dry-run

# migrasi penuh: hapus data seed lalu isi dari Mongo (gambar base64 -> WebP -> R2)
python scripts/migrate_mongo_to_mariadb.py --mongo "mongodb+srv://..." --wipe
```

> **Atlas Network Access**: IP server yang menjalankan migrasi harus diizinkan di MongoDB Atlas
> (Network Access -> Add IP Address). Untuk sandbox preview ini IP-nya `34.7.135.173`; untuk VPS Coolify `103.150.190.182`.

Setelah migrasi, restart backend (seed tidak akan menimpa data yang sudah ada).

## 4. Cloudflare R2

1. Buat bucket (mis. `daneswara`) -> **Settings -> Public access -> Allow (r2.dev)**; catat `R2_PUBLIC_BASE_URL` (`https://pub-xxxx.r2.dev`).
2. API token dengan izin **Object Read & Write** untuk bucket tersebut.
3. Isi env `R2_*` di Coolify (dan `backend/.env` untuk lokal), lalu:

```bash
python scripts/r2_setup.py --check      # tes tulis ke bucket
python scripts/r2_setup.py --cors       # izinkan GET dari browser (logo struk/canvas)
python scripts/r2_setup.py --sync-assets ../frontend/public/assets   # opsional: aset statis landing ke R2
```

Semua upload dari dashboard (galeri, gambar produk/kategori, logo struk) otomatis dikonversi ke **WebP** dan disimpan dengan key `daneswara/<jenis>/<uuid>.webp`.

## 5. phpMyAdmin (Coolify)

Buka lewat **http://** (bukan https) `http://phpmyadmin-....sslip.io/`. Di form login: **Server** = `9cox2040sfl5xb5docwuqjlc` (hostname internal MariaDB), user `daneswara`, password DB.

## 6. Update

Push ke `main` -> Coolify auto-deploy (aktifkan webhook GitHub di resource). Skema tabel dibuat otomatis (`create_all`) saat backend start.
