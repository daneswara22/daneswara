# Panduan untuk AI Agent dan Kontributor

Baca dokumen ini dulu sebelum menyentuh kode. Tujuannya supaya siapa pun yang baru masuk (baik AI seperti Emergent atau Cursor, maupun orang) langsung paham cara kerja proyek ini, cara menjalankannya, dan aturan mainnya saat menyimpan ke GitHub.

## Cara memulai sesi

Setiap kali mulai kerja, pemilik biasanya memberi tiga hal, kadang digabung dalam satu file teks:

1. Token GitHub (PAT) dan nama repo, misalnya `daneswara22/daneswara`.
2. Env produksi. Isinya `DATABASE_URL` untuk MariaDB, `JWT_SECRET`, kelompok `OWNER_`, semua `R2_`, `PUBLIC_BASE_URL`, `NEXT_PUBLIC_POS_URL`, dan seterusnya. Sering ada dua versi alamat database: versi internal (dipakai di server Coolify) dan versi publik `HOST:6796` (dipakai kalau kerja di luar server).
3. Baru setelah itu permintaan fiturnya, entah menambah atau mengubah sesuatu.

Kalau ketiga hal itu sudah ada, kerjakan berurutan seperti ini:

Pertama, jalankan **Pra-kerja** (bagian di bawah) — cek sinkronisasi, pahami logika, nyalakan dev server, buka Preview. Berhenti dan tunggu tugas.

Kedua, kerjakan fiturnya. Baca berkas relevan dulu (grep/read), jangan menebak API/versi/path. Rencana 3 baris, lalu patch kecil yang bisa langsung dijalankan. Jalankan/verify. Error â†’ baca pesan aslinya â†’ fix â†’ ulangi (maks 3x).

Ketiga, verifikasi. Selesai = ada bukti nyata: output command, status HTTP, test pass, atau screenshot. Tanpa bukti = belum selesai.

Keempat, simpan lewat pull request (lihat **Alur PR**), lalu berhenti. Pemilik yang review dan merge.

Selama proses ini ingat bahwa datanya produksi dan hidup. Utamakan hanya membaca, jangan menghapus atau mengubah massal, jangan menaruh rahasia ke repo (repo ini publik), dan jangan pernah push langsung ke `main`.

### Env lokal

Pasang env ke `web/.env`, jangan pernah dimasukkan ke repo. Berkas env dari pemilik kadang membawa anotasi seperti ` (bisa diganti)` di belakang nilai dan line ending CRLF; bersihkan dulu sebelum dipakai, kalau tidak login akan gagal.

Kalau koneksi database terasa lambat, tambahkan parameter pool di ujung `DATABASE_URL` seperti `?connection_limit=20&pool_timeout=30&connect_timeout=20&socket_timeout=60`. Untuk database produksi yang sudah berisi data, set semua `SEED_` ke false supaya datanya tidak tertimpa.

### Akun untuk uji

Password user lama hasil migrasi tidak diketahui, jadi jangan coba menebak. Kalau memang perlu akun uji, buat atau reset akun Owner dengan `npx tsx scripts/ensure-admin.ts admin '<password>'` di folder `web` — **hanya kalau pemilik mengizinkan**, karena ini menulis ke database produksi.

### Dependency

`node_modules` biasanya sudah lengkap. Cek dulu `Test-Path web\node_modules\.bin\next.cmd`; kalau ada, **jangan** jalankan `yarn install` lagi. Kalau perlu install, pakai `yarn install --frozen-lockfile` supaya lockfile tidak berubah.

## Tiga prompt baku pemilik

Pemilik menyimpan dan memuat kode lewat token PAT, bukan lewat integrasi bawaan yang menghubungkan Emergent dengan GitHub. Alasannya lebih rapi dan lebih disiplin. Tiga prompt ini yang biasa dipakai.

### 1. Pra-kerja (dipakai tiap sesi baru)

> Sebelum mulai bekerja silahkan cek kondisi main source code lokal laptop ini dan GitHub repository, pastikan main source code sinkron 100% dengan GitHub, pahami logika fungsi project saya 100%, jangan ubah apa pun setelah cek. Nyalakan web dev port sesuai project ini di tab Preview. Nanti baru saya beri tugas.

Artinya, jalankan **Pra-kerja** di bawah ini secara read-only, lalu berhenti dan tunggu tugas. Jangan menulis kode, jangan usul refactor, jangan "sekalian memperbaiki" apa pun.

### 2. Simpan (Save to GitHub)

> Buatkan pull request untuk seluruh perubahan kode dari sesi ini ke repository GitHub saya. Mulai dari PR nomor 1. Kalau sudah ada pull request, sesuaikan atau lanjutkan di PR terakhir.

Artinya, simpan lewat pull request memakai token PAT. Kalau belum ada PR mulai dari nomor 1, kalau sudah ada lanjutkan mengikuti PR terakhir. Satu sesi sebaiknya satu pull request utuh — commit tambahan didorong ke branch PR yang sama selama PR masih terbuka, bukan bikin banyak PR kecil. Yang review dan merge tetap pemilik.

### 3. Merge (hanya kalau diminta)

> Merge PR-nya.

Baru setelah perintah ini agent boleh merge. Tanpa perintah itu, PR dibiarkan terbuka.

## Pra-kerja — wajib, read-only

Dijalankan setiap sesi baru sebelum menyentuh apa pun. Selama pra-kerja **dilarang**
mengubah berkas, install, format, refactor, commit, pull, atau push.

### 1. Cek sinkronisasi lokal vs GitHub

Repo lokal bisa saja belum punya `.git` (hasil ekstrak zip). Kalau begitu,
inisialisasi dulu tanpa mengubah berkas kerja:

```powershell
cd "C:\Daneswara Dev\daneswara-main"
git init -b main
git remote add origin https://github.com/daneswara22/daneswara.git
git fetch --depth=1 origin main
```

**Jangan** pakai `git checkout -f` atau `git reset --hard` untuk menyamakan —
itu menghapus pekerjaan yang belum di-commit. Bandingkan isi berkas saja:

```powershell
git --no-pager diff --stat origin/main
git --no-pager status --short
```

Laporkan salah satu status: `SINKRON`, `AHEAD n`, `BEHIND n`, `DIVERGED (n/m)`,
atau `ADA PERUBAHAN LOKAL (n file)`. Sebut nama berkasnya. Jangan diperbaiki,
jangan di-pull, jangan di-stash.

Cek juga berkas kunci sama atau beda: `package.json`, `yarn.lock`,
`prisma/schema.prisma`, `.env.example`.

### 2. Pahami logika project (tanpa mengubah)

Baca README, `package.json` scripts, struktur folder, entry point, routing,
service/data layer, schema DB, dan 1–2 alur utama (login, CRUD inti). Tulis
ringkasan maks 10 baris: stack, arsitektur, alur utama, lokasi logic penting,
dan bagian yang **belum** dipahami. Jangan klaim "100%" untuk bagian yang belum
dibaca — sebut apa adanya.

### 3. Nyalakan dev server

Port dari script `dev` di `web/package.json` (sekarang 3000 untuk landing, 3001 untuk POS).

```powershell
cd "C:\Daneswara Dev\daneswara-main\web"

# Landing
npx next dev -p 3000 > "C:\Daneswara Dev\.logs\dev.log" 2> "C:\Daneswara Dev\.logs\dev.err"

# POS (folder build terpisah, lihat bagian "Port & domain")
node scripts/dev-pos.mjs > "C:\Daneswara Dev\.logs\dev-pos.log" 2> "C:\Daneswara Dev\.logs\dev-pos.err"
```

Verifikasi: `curl.exe -s -o NUL -w "%{http_code}" http://localhost:3000/` dan
`http://localhost:3001/login` harus 200/307. Kalau gagal, baca `dev.err` dan
`dev.log`, laporkan error pertama, fix hanya yang menghalangi server hidup.

### 4. Cek backend

- DB: `curl.exe -s http://localhost:3000/api/health` â†’ `database: "ok"`.
- R2: uji `ListObjectsV2` dengan kredensial dari `web/.env` (read-only, `MaxKeys: 1`).

### 5. Buka di tab Preview

Buka `http://localhost:3000` (landing) dan `http://localhost:3001/login` (POS) di
tab Preview VS Code. Pastikan render: status HTTP, `<title>`, elemen kunci muncul.
Jangan buka browser eksternal.

### 6. Berhenti dan tunggu

Laporkan (sync, ringkasan project, port, status preview, status DB/R2) lalu
**BERHENTI**. Jangan menulis kode sebelum pemilik memberi tugas.

## Gambaran singkat proyek

Semua kode yang jalan ada di folder `web`, yaitu satu aplikasi Next.js 15 fullstack (halaman dan API jadi satu di `web/app/api`). Folder `backend` isinya cuma jembatan FastAPI tipis yang meneruskan `/api/` ke Next.js, dan hanya dipakai di sandbox Emergent. Folder `frontend` juga sekadar jembatan yang menjalankan `yarn dev` di `web`. Kode lama bergaya Create React App masih disimpan di `web/src_pages` dan `web/components/landing`, dipakai lagi lewat alias, jadi jangan dihapus.

Databasenya MariaDB lewat Prisma (skemanya di `web/prisma/schema.prisma`, ada 18 tabel). Media disimpan di Cloudflare R2 (lihat `web/lib/storage.ts`) dan disajikan dari `cdn.daneswara.com`.

Perlu diingat lagi, datanya produksi dan hidup. Jangan menjalankan endpoint yang merusak seperti `clear-transactions`, `reset-stock`, `reprice-catalog`, atau refund pada data asli. Kalau butuh menguji jalur tulis, buat satu record dengan awalan `ZZ_TEST_` lalu hapus lagi.

## Peta folder

- `web/app/(landing)` berisi situs marketing Daneswara Print, hasil port dari situs React statis.
- `web/app/(pos)` berisi DanesPOS, mulai dari login, dashboard di `/app`, sampai kasir di `/pos`.
- `web/app/api` berisi semua endpoint dengan auth lewat cookie atau bearer JWT.
- `web/components/landing` berisi komponen, halaman, dan i18n landing (gaya CSS-nya dikurung di `.dp-landing`).
- `web/src_pages` dan `web/components` berisi halaman dan komponen POS gaya CRA, dipakai lewat alias.
- `web/lib` berisi berkas inti: `db.ts` (Prisma), `storage.ts` (R2 dan sharp), `auth.ts`, `api.ts`, `media.ts`, dan `printer.js`.
- `web/lib/channels` berisi integrasi kanal penjualan (marketplace). `types.ts` mendaftar kanal, `store.ts` satu-satunya tempat token dibaca/ditulis (terenkripsi AES-256-GCM lewat `lib/crypto.ts`), dan `shopee/` berisi klien Shopee Open API v2, pemetaan status, pemetaan produk, serta sinkronisasi idempoten. Endpointnya di `web/app/api/channels/**` dan halaman adminnya `web/src_pages/SalesChannels.jsx`. Jangan pernah menaruh partner key atau token di env frontend maupun di repo; semuanya diisi dari halaman admin dan disimpan di tabel `channel_credentials`.
- `web/middleware.ts` mengalihkan halaman utama ke `/login` untuk host POS seperti `pos`, `app`, atau `dashboard`.
- `backend/scripts/r2_cors.py` memasang CORS bucket R2 (butuh token R2 dengan izin Admin baca tulis).
- `web/scripts/ensure-admin.ts` membuat atau mereset akun Owner tanpa menyimpan rahasia.

Soal upload gambar, alurnya: klien mengirim ke `POST /api/upload?kind=...`, lalu sharp mengubahnya jadi WebP, disimpan ke R2, dan mengembalikan URL seperti `https://cdn.daneswara.com/daneswara/<kind>/<uuid>.webp`. Jangan lagi mengembalikan gambar dalam bentuk base64.

## Hal yang pernah bikin masalah

Logo pernah hilang di struk dan voucher. Struk digambar ke elemen canvas memakai html2canvas dan ESC/POS, dan gambar dari domain lain tanpa header CORS membuat canvas "tercemar" sehingga logonya hilang diam-diam. Solusinya, bungkus semua URL media yang masuk ke canvas dengan `canvasSafeUrl()` dari `web/lib/media.ts`, yang mengalihkannya lewat proxy satu domain di `GET /api/media?url=...`. Ini sudah dipakai di `printer.js`, `ReceiptShareCard.jsx`, dan `VoucherShareCard.jsx`. CORS bucket juga sudah dipasang lewat `backend/scripts/r2_cors.py`, tapi proxy tadi tetap perbaikan utamanya.

Halaman 404 pernah tampil polos. Versi CRA lama punya penangkap semua rute yang mengarahkan balik ke halaman utama. Di Next.js, halaman itu ada di `web/app/not-found.tsx` dan sudah ber-branding, jadi jangan biarkan jatuh ke 404 bawaan Next.

Rute POS sekarang pindah, semua menu dashboard ada di bawah `/app`, bukan lagi `/produk` dan seterusnya. Aset landing juga sekarang berformat WebP, bukan PNG, dan ada di `web/public/assets`.

Variabel yang berawalan `NEXT_PUBLIC_` ikut ditanam saat `next build`, jadi `NEXT_PUBLIC_POS_URL` harus di-set sebelum build, bukan saat aplikasi jalan. Terakhir, kalau muncul error Prisma P2024 karena koneksi database jauh dan lambat, tambahkan parameter pool di `DATABASE_URL` seperti dijelaskan di bagian memulai sesi.

## Printer Bluetooth (BLE) — cara kerjanya sekarang

Semua logika ada di `web/lib/printer.js`. Jangan bikin koneksi BLE baru di tempat lain; pakai `printReceiptSmart()` saja.

Status yang dilaporkan ke UI ada enam: `connected`, `connecting`, `reconnecting`, `disconnected`, `printing`, `error`. Komponen berlangganan lewat `setPrinterStatusCallback(cb)` yang mengembalikan fungsi unsubscribe (boleh lebih dari satu pelanggan, misalnya badge di header dan halaman Pengaturan).

Koneksi dijaga tiga lapis: listener `gattserverdisconnected`, watchdog 8 detik yang mengirim byte NUL sebagai keep-alive, dan hook `visibilitychange` untuk menyambung ulang begitu tab aktif lagi (browser menahan timer di tab latar, ini penyebab umum koneksi mati). Saat mencetak, keep-alive dimatikan sementara lewat flag `btPrinting` supaya byte NUL tidak menyelip di tengah payload ESC/POS dan membuat struk rusak.

Semua pekerjaan cetak masuk antrean (`enqueuePrintJob`) dan dikirim satu per satu, ditandai user id dan job id. Antrean dilindungi Web Locks (`daneswara-bt-printer`) supaya dua tab di browser yang sama tidak saling menimpa. Kalau satu tulisan gagal, payload penuh dikirim ulang tepat satu kali setelah reconnect — jadi tidak ada cetak ganda saat tulisan pertama sebenarnya berhasil.

Konfigurasi printer disimpan per user per perangkat dengan kunci `pos_printer_config_v1:<userId>`. Kunci lama `pos_printer_config_v1` tetap dibaca sebagai cadangan dan dimigrasikan otomatis pada pembacaan pertama, jadi printer yang sudah dipasangkan tidak hilang. `AuthContext` memanggil `setPrinterUserScope(user.id)` setiap kali user berubah; saat logout, pemutusan koneksi ditunda sampai antrean kosong agar struk yang sedang jalan tidak hilang.

Batasan fisik yang tidak bisa dilawan dari kode: satu printer BLE hanya menerima satu koneksi aktif. Jadi dua perangkat tidak bisa memakai satu printer Bluetooth bersamaan — untuk itu pakai mode USB/Desktop. Dua user di satu browser tetap aman karena antrean dan Web Locks menyerialkan pekerjaannya.

Tes ada di `web/scripts/test-printer.ts` dan dijalankan dengan `npm run test:printer` (esbuild membundel `printer.js` dulu supaya alias `@/` ter-resolve, lalu `tsx` menjalankan skenario). Tidak butuh printer fisik.

## Aturan Git

Aturan intinya sederhana: jangan pernah commit atau push langsung ke `main`. Selalu lewat pull request memakai token PAT, dan biarkan pemilik yang review lalu merge sendiri.

Alur biasanya begini. Autentikasi pakai token satu baris, dengan remote berbentuk `https://x-access-token:<PAT>@github.com/<owner>/<repo>.git`, dan jangan simpan token itu ke berkas yang ikut ter-commit. Sinkronkan dulu dengan `git fetch origin main` sambil cek commit dan PR terbaru. Buat branch dengan nama yang jelas seperti `fix/nama-perubahan` atau `docs/nama-perubahan`. Tambahkan hanya berkas yang relevan (jangan `git add .` asal comot), commit dengan pesan yang menjelaskan apa dan kenapa, lalu push branch itu dan buka pull request ke `main`.

Soal jumlah dan nomor PR, kalau repo belum punya PR mulai dari nomor 1, kalau sudah ada lanjutkan mengikuti PR terakhir. Satu sesi sebaiknya satu pull request yang utuh. Selama PR sesi ini masih terbuka, dorong commit tambahan ke branch yang sama. Kalau pemilik sudah terlanjur merge PR itu, barulah perubahan berikutnya masuk ke PR baru sebagai lanjutan.

Sebelum membuka PR, pastikan beberapa hal. `yarn test:core` di folder `web` hijau dan proses build tidak error. `npx eslint .` dari root keluar dengan kode 0. Tidak ada rahasia apa pun di diff, baik password, kredensial database, kunci R2, maupun token, karena repo ini publik. Berkas `.env`, artefak sandbox, dan berkas yang memuat kredensial tidak ikut ter-commit. Perubahan yang menyentuh struk atau media sudah memakai `canvasSafeUrl()`. Dan deskripsi PR menjelaskan apa yang diubah, kenapa, serta cara mengujinya.

### Merge — hanya kalau pemilik menyuruh

**Jangan pernah merge sendiri.** PR dibuka, lalu berhenti dan tunggu perintah. Kalau pemilik bilang "merge", baru jalankan `PUT /repos/daneswara22/daneswara/pulls/<n>/merge` dengan `merge_method: squash`. Kalau tidak disuruh, jangan disentuh — sekalipun PR terlihat sudah siap dan semua cek hijau.

## Yang tidak boleh disentuh atau di-commit

Jangan pernah meng-commit `web/.env`, `backend/.env`, atau env apa pun yang berisi nilai asli. Jangan ikut sertakan berkas dokumentasi lokal yang memuat kredensial, misalnya RUNBOOK sandbox, biarkan tetap di luar repo. Jangan menjalankan operasi yang merusak skema atau isi database produksi. Dan jangan menyentuh `main` secara langsung.

## Port & domain

Satu aplikasi Next.js melayani dua wajah berbeda, dipisah oleh **host**, bukan port.
`middleware.ts` mengalihkan `/` ke `/login` hanya kalau host-nya `pos.*`,
`dashboard.*`, atau `app.*`.

| Lingkungan | Landing (publik) | POS (dashboard) | Catatan |
|---|---|---|---|
| Produksi | `https://daneswara.com` | `https://pos.daneswara.com` | Coolify, satu container |
| Dev lokal | `http://localhost:3000` | `http://localhost:3001` | dua proses terpisah |

### Menjalankan lokal

```powershell
cd "C:\Daneswara Dev\daneswara-main\web"

# Landing — port 3000, folder build .next
npx next dev -p 3000

# POS — port 3001, folder build .next-pos (terpisah supaya cache tidak bentrok)
node scripts/dev-pos.mjs
```

`yarn dev:pos` memanggil script yang sama.

**Penting:** dua dev server **tidak boleh** berbagi folder `.next`. Cache webpack
saling menimpa dan route jadi 404 (`/app`, `/pos`). Karena itu `next.config.js`
membaca `distDir` dari env `NEXT_DIST_DIR`, dan `scripts/dev-pos.mjs` mengisinya
`.next-pos`. `.next-pos` sudah masuk `.gitignore`.

### Link POS di lokal

`NEXT_PUBLIC_POS_URL` di `web/.env` menunjuk produksi (`https://pos.daneswara.com`).
Supaya link POS di lokal tidak nyasar ke produksi, `web/.env.local` meng-override:

```
NEXT_PUBLIC_POS_URL=http://localhost:3001
```

`.env.local` sudah gitignored. Next memuat `.env.local` lebih dulu daripada `.env`.

### Catatan host

Karena redirect POS berbasis host, membuka `http://localhost:3001/` tetap
menampilkan landing. Untuk masuk POS, buka langsung `/login`, `/app`, atau `/pos`.
Kalau butuh simulasi subdomain, tambahkan baris berikut ke
`C:\Windows\System32\drivers\etc\hosts`:

```
127.0.0.1 pos.localhost
```

lalu buka `http://pos.localhost:3001/` — middleware akan mengalihkan ke `/login`.

