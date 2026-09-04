# Deploy ke Coolify (VPS self-hosted)

Arsitektur produksi:

```
[Traefik/Coolify] --> frontend (nginx :80)  --/api/-->  backend (FastAPI :8001)  -->  MariaDB (Coolify, internal)
                                                                  \-->  Cloudflare R2 (media WebP)
```

## 1. Persiapan

- MariaDB sudah ada di project **Daneswara Client / production** (`MariadbSQL`). Internal URL:
  `mysql://daneswaraprod:<password>@e5t5yllm46db0cnsu9fwv3cv:3306/default`
- Repo GitHub berisi `docker-compose.yml`, `backend/Dockerfile`, `frontend/Dockerfile`.

## 2. Buat resource di Coolify

Ada **dua cara** (pilih salah satu):

### Cara A (paling mudah): Build Pack **Dockerfile** - 1 container (nginx + API)

1. **+ New Resource -> Public Repository / GitHub App** -> repo `daneswara22/daneswara`, branch `main`.
2. **Build Pack: Dockerfile** (file `Dockerfile` di root repo), **Port: `80`**.
3. Isi **Environment Variables** (tabel di bawah). Tidak perlu build args.
4. Set **Domain** (mis. `https://daneswaraprint.com`) -> **Deploy**.
5. Storage (opsional bila belum pakai R2): tambah **Persistent Volume** `/data/uploads`.

### Cara B: Build Pack **Docker Compose** - 2 service (frontend nginx + backend)

1. Build Pack: **Docker Compose**, compose file `/docker-compose.yml`.
2. Env sama seperti tabel; domain di-set pada service **frontend** (port 80).
3. Aktifkan **"Connect To Predefined Network"** agar backend bisa resolve hostname MariaDB.

### Environment Variables (kedua cara)

   | Key | Nilai |
   |---|---|
   | `DATABASE_URL` | `mysql://daneswaraprod:<password>@e5t5yllm46db0cnsu9fwv3cv:3306/default` |
   | `JWT_SECRET` | string acak panjang |
   | `OWNER_USERNAME` / `OWNER_PASSWORD` | akun owner pertama |
   | `PUBLIC_BASE_URL` | `https://daneswaraprint.com` (domain situs) |
   | `TIMEZONE` | `Asia/Makassar` |
   | `SEED_CATALOG` / `SEED_CUSTOMERS` | `false` jika akan migrasi data dari Mongo |
   | `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT`, `R2_BUCKET`, `R2_PUBLIC_BASE_URL` | dari Cloudflare R2 (kosongkan `R2_BUCKET` = simpan di disk) |

Cek setelah deploy: `https://<domain>/api/health` -> `{"status":"healthy","database":"ok",...}`.

> Container app harus berada di jaringan Docker yang sama dengan MariaDB Coolify (default: network `coolify`).
> Jika `DATABASE_URL` internal tidak resolve, pakai URL publik `mysql://daneswaraprod:<password>@103.175.220.31:6796/default` (butuh user `'daneswaraprod'@'%'`, lihat bagian 5b).

## 3. Migrasi data lama (MongoDB Atlas -> MariaDB)

Jalankan **sekali** dari terminal container backend (Coolify -> backend -> Terminal), atau dari mesin mana pun yang bisa mengakses Atlas + MariaDB:

```bash
# lihat ringkasan koleksi & field yang akan dimigrasi (tanpa menulis)
python scripts/migrate_mongo_to_mariadb.py --mongo "mongodb+srv://USER:PASS@customer-apps.0vndh7.mongodb.net/?retryWrites=true&w=majority" --dry-run

# migrasi penuh: hapus data seed lalu isi dari Mongo (gambar base64 -> WebP -> R2)
python scripts/migrate_mongo_to_mariadb.py --mongo "mongodb+srv://..." --wipe
```

> **Atlas Network Access**: IP server yang menjalankan migrasi harus diizinkan di MongoDB Atlas
> (Network Access -> Add IP Address). Untuk sandbox preview ini IP-nya `34.7.135.173`; untuk VPS Coolify `103.175.220.31`.

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

## 5. phpMyAdmin (Coolify) - akses lokal & via `db.daneswara.com`

Sementara: buka lewat **http://** (bukan https) `http://phpmyadmin-kbs2qh0jspvfjhpmxqzc4zij.103.175.220.31.sslip.io/`.
Di form login: **Server** = `e5t5yllm46db0cnsu9fwv3cv` (hostname internal MariaDB), user `daneswaraprod`, password DB.

Pakai domain sendiri **https://db.daneswara.com**:

1. Cloudflare DNS: record **A** `db` -> `103.175.220.31`, **Proxied** (orange) boleh. SSL/TLS mode Cloudflare = **Full** (bukan Flexible).
2. Coolify -> service **PhpMyAdmin** -> **Settings -> Domains** isi `https://db.daneswara.com` -> **Save** -> **Redeploy**.
   Traefik Coolify otomatis minta sertifikat Let's Encrypt; jika Cloudflare Proxied gagal issue, matikan proxy (DNS only) sesaat lalu nyalakan lagi.
3. Di env service phpMyAdmin pastikan `PMA_HOST=e5t5yllm46db0cnsu9fwv3cv` (atau `PMA_ARBITRARY=1` supaya server bisa diketik di form login).
4. Opsional keamanan: batasi akses dengan Cloudflare Access (Zero Trust) untuk `db.daneswara.com`.

## 5b. Izinkan koneksi remote ke MariaDB (port publik 6796)

Error `Host 'x.x.x.x' is not allowed to connect` berarti user hanya terdaftar untuk host lokal. Jalankan sekali di phpMyAdmin (login sebagai **root** MariaDB, password root ada di Coolify -> MariadbSQL -> Environment Variables `MARIADB_ROOT_PASSWORD`):

```sql
CREATE USER IF NOT EXISTS 'daneswaraprod'@'%' IDENTIFIED BY '<password>';
GRANT ALL PRIVILEGES ON `default`.* TO 'daneswaraprod'@'%';
FLUSH PRIVILEGES;
```

Setelah itu URL publik `mysql://daneswaraprod:<password>@103.175.220.31:6796/default` bisa dipakai dari luar (misalnya untuk preview/migrasi). Produksi di Coolify tetap pakai URL internal.

## 6. Update

Push ke `main` -> Coolify auto-deploy (aktifkan webhook GitHub di resource). Skema tabel dibuat otomatis (`create_all`) saat backend start.
