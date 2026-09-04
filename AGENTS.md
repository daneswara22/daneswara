# Panduan untuk AI Agent dan Kontributor

Baca dokumen ini dulu sebelum menyentuh kode. Tujuannya supaya siapa pun yang baru masuk (baik AI seperti Emergent atau Cursor, maupun orang) langsung paham cara kerja proyek ini, cara menjalankannya, dan aturan mainnya saat menyimpan ke GitHub.

## Cara memulai sesi

Setiap kali mulai kerja, pemilik biasanya memberi tiga hal, kadang digabung dalam satu file teks:

1. Token GitHub (PAT) dan nama repo, misalnya `daneswara22/daneswara`.
2. Env produksi. Isinya `DATABASE_URL` untuk MariaDB, `JWT_SECRET`, kelompok `OWNER_`, semua `R2_`, `PUBLIC_BASE_URL`, `NEXT_PUBLIC_POS_URL`, dan seterusnya. Sering ada dua versi alamat database: versi internal (dipakai di server Coolify) dan versi publik `HOST:6796` (dipakai kalau kerja di luar server, termasuk sandbox).
3. Baru setelah itu permintaan fiturnya, entah menambah atau mengubah sesuatu.

Kalau ketiga hal itu sudah ada, kerjakan berurutan seperti ini:

Pertama, clone reponya lalu sinkronkan ke kondisi terbaru. Selalu cek dulu commit dan pull request paling akhir, karena pemilik sering sudah merge sesuatu di sela-sela sesi. Jangan membangun di atas kode yang sudah basi.

Kedua, pasang env ke `web/.env`, jangan pernah dimasukkan ke repo. Di sandbox, karena posisinya di luar jaringan Coolify, wajib pakai alamat MariaDB yang publik (`HOST:6796`), bukan yang internal. Kalau koneksi database terasa lambat, tambahkan parameter pool di ujung `DATABASE_URL` seperti `?connection_limit=20&pool_timeout=30&connect_timeout=20&socket_timeout=60`. Untuk database produksi yang sudah berisi data, set semua `SEED_` ke false supaya datanya tidak tertimpa.

Ketiga, sambungkan dan pastikan MariaDB serta Cloudflare R2 benar-benar jalan sebelum menyentuh fitur apa pun. Jalankan `yarn install` dan `npx prisma generate` di folder `web`, lalu `yarn test:core`. Tes ini harus hijau semua (koneksi Prisma, tabel, tenant dan user, bcrypt, JWT, konversi WebP, dan backend R2). Cek juga `/api/health` sampai databasenya "ok". Kalau perlu, jalankan `python scripts/r2_cors.py` di folder backend untuk memasang CORS bucket R2. Setelah itu restart layanannya.

Keempat, siapkan akun untuk uji. Password user lama hasil migrasi tidak diketahui, jadi jangan coba menebak. Buat atau reset akun Owner dengan `npx tsx scripts/ensure-admin.ts admin '<password>'` di folder `web`.

Kelima, baru kerjakan fiturnya. Setelah selesai, verifikasi lewat testing agent (lewati hal yang butuh drag-drop, kamera, atau printer bluetooth). Simpan lewat pull request, dan biarkan pemilik yang review lalu merge.

Selama proses ini ingat bahwa datanya produksi dan hidup. Utamakan hanya membaca, jangan menghapus atau mengubah massal, jangan menaruh rahasia ke repo (repo ini publik), dan jangan pernah push langsung ke `main`.

## Dua prompt baku pemilik

Pemilik menyimpan dan memuat kode lewat token PAT, bukan lewat integrasi bawaan yang menghubungkan Emergent dengan GitHub. Alasannya lebih rapi dan lebih disiplin. Dua prompt ini yang biasa dipakai.

Saat memulai (Load from GitHub):

> Hubungkan ke repository GitHub saya. Reponya: REPO KAKAK. Cek seluruh commit terakhir yang sudah saya kerjakan, install dependencies, dan jalankan app web saya di live preview Emergent. github_pat_: ISI TOKEN KAKAK

Maksudnya, pakai token satu baris untuk clone atau sinkron repo, selalu cek commit dan PR terbaru dulu, install dependency, sambungkan MariaDB dan R2, lalu jalankan aplikasinya di preview. Rinciannya ada di bagian "Cara memulai sesi" di atas.

Saat menyimpan (Save to GitHub):

> Buatkan pull request untuk seluruh perubahan kode dari sesi chat Emergent ini ke repository GitHub saya. Mulai dari PR nomor 1. Kalau sudah ada pull request, sesuaikan atau lanjutkan di PR terakhir.

Maksudnya, simpan lewat pull request memakai token PAT, jangan lewat integrasi Emergent ke GitHub. Soal penomoran, kalau belum ada PR mulai dari nomor 1, kalau sudah ada lanjutkan mengikuti PR terakhir. Idealnya satu sesi menghasilkan satu pull request yang utuh, jadi commit tambahan cukup didorong ke branch PR yang sama selama PR itu masih terbuka, bukan bikin banyak PR kecil terpisah. Yang review dan merge tetap pemilik. Agent tidak pernah merge sendiri dan tidak pernah push ke `main`.

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
- `web/middleware.ts` mengalihkan halaman utama ke `/login` untuk host POS seperti `pos`, `app`, atau `dashboard`.
- `backend/scripts/r2_cors.py` memasang CORS bucket R2 (butuh token R2 dengan izin Admin baca tulis).
- `web/scripts/ensure-admin.ts` membuat atau mereset akun Owner tanpa menyimpan rahasia.

Soal upload gambar, alurnya: klien mengirim ke `POST /api/upload?kind=...`, lalu sharp mengubahnya jadi WebP, disimpan ke R2, dan mengembalikan URL seperti `https://cdn.daneswara.com/daneswara/<kind>/<uuid>.webp`. Jangan lagi mengembalikan gambar dalam bentuk base64.

## Hal yang pernah bikin masalah

Logo pernah hilang di struk dan voucher. Struk digambar ke elemen canvas memakai html2canvas dan ESC/POS, dan gambar dari domain lain tanpa header CORS membuat canvas "tercemar" sehingga logonya hilang diam-diam. Solusinya, bungkus semua URL media yang masuk ke canvas dengan `canvasSafeUrl()` dari `web/lib/media.ts`, yang mengalihkannya lewat proxy satu domain di `GET /api/media?url=...`. Ini sudah dipakai di `printer.js`, `ReceiptShareCard.jsx`, dan `VoucherShareCard.jsx`. CORS bucket juga sudah dipasang lewat `backend/scripts/r2_cors.py`, tapi proxy tadi tetap perbaikan utamanya.

Halaman 404 pernah tampil polos. Versi CRA lama punya penangkap semua rute yang mengarahkan balik ke halaman utama. Di Next.js, halaman itu ada di `web/app/not-found.tsx` dan sudah ber-branding, jadi jangan biarkan jatuh ke 404 bawaan Next.

Rute POS sekarang pindah, semua menu dashboard ada di bawah `/app`, bukan lagi `/produk` dan seterusnya. Aset landing juga sekarang berformat WebP, bukan PNG, dan ada di `web/public/assets`.

Variabel yang berawalan `NEXT_PUBLIC_` ikut ditanam saat `next build`, jadi `NEXT_PUBLIC_POS_URL` harus di-set sebelum build, bukan saat aplikasi jalan. Terakhir, kalau muncul error Prisma P2024 karena koneksi database jauh dan lambat, tambahkan parameter pool di `DATABASE_URL` seperti dijelaskan di bagian memulai sesi.

## Aturan Git

Aturan intinya sederhana: jangan pernah commit atau push langsung ke `main`. Selalu lewat pull request memakai token PAT, bukan integrasi Emergent ke GitHub, dan biarkan pemilik yang review lalu merge sendiri.

Alur biasanya begini. Autentikasi pakai token satu baris, dengan remote berbentuk `https://x-access-token:<PAT>@github.com/<owner>/<repo>.git`, dan jangan simpan token itu ke berkas yang ikut ter-commit. Sinkronkan dulu dengan `git fetch origin main` sambil cek commit dan PR terbaru. Buat branch dengan nama yang jelas seperti `fix/nama-perubahan` atau `docs/nama-perubahan`. Tambahkan hanya berkas yang relevan (jangan `git add .` asal comot), commit dengan pesan yang menjelaskan apa dan kenapa, lalu push branch itu dan buka pull request ke `main`.

Soal jumlah dan nomor PR, kalau repo belum punya PR mulai dari nomor 1, kalau sudah ada lanjutkan mengikuti PR terakhir. Satu sesi sebaiknya satu pull request yang utuh. Selama PR sesi ini masih terbuka, dorong commit tambahan ke branch yang sama. Kalau pemilik sudah terlanjur merge PR itu, barulah perubahan berikutnya masuk ke PR baru sebagai lanjutan.

Sebelum membuka PR, pastikan beberapa hal. `yarn test:core` di folder `web` hijau dan proses build tidak error. `npx eslint .` dari root keluar dengan kode 0. Tidak ada rahasia apa pun di diff, baik password, kredensial database, kunci R2, maupun token, karena repo ini publik. Berkas `.env`, artefak sandbox, dan berkas yang memuat kredensial tidak ikut ter-commit. Perubahan yang menyentuh struk atau media sudah memakai `canvasSafeUrl()`. Dan deskripsi PR menjelaskan apa yang diubah, kenapa, serta cara mengujinya.

## Yang tidak boleh disentuh atau di-commit

Jangan pernah meng-commit `web/.env`, `backend/.env`, atau env apa pun yang berisi nilai asli. Jangan ikut sertakan berkas dokumentasi lokal yang memuat kredensial, misalnya RUNBOOK sandbox, biarkan tetap di luar repo. Jangan menjalankan operasi yang merusak skema atau isi database produksi. Dan jangan menyentuh `main` secara langsung.
