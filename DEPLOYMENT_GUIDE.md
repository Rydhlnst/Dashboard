# Panduan Setup Lokal, Deploy cPanel & Penggunaan Aplikasi

Panduan ini berisi petunjuk lengkap untuk menjalankan aplikasi secara lokal, melakukan deploy ke cPanel, cara melakukan import data Excel, contoh file `.env`, serta checklist untuk pengujian fitur utama.

---

## 1. Setup Lokal

### Prasyarat
- PHP 8.0+ dan Composer (untuk phpMyAdmin/Laragon/XAMPP).
- Node.js 18+ dan pnpm.
- Server database MySQL atau MariaDB.

### Langkah Setup Otomatis (Direkomendasikan)
Kami telah menyediakan script satu-klik [dev.ps1](file:///d:/Projects/Freelance/dashboad/dev.ps1) untuk setup dan menjalankan server lokal.

1. Buka terminal PowerShell sebagai Administrator.
2. Jalankan perintah berikut di root folder project:
   ```powershell
   powershell -ExecutionPolicy Bypass -File dev.ps1
   ```
3. Script otomatis akan:
   - Membuat file `.env` di root dan `frontend/.env.local` jika belum ada.
   - Menginstall dependensi Composer (PHP) dan pnpm (Next.js).
   - Membuat database `dashboard_monitoring` dan mengimport schema SQL.
   - Menjalankan server backend PHP di `http://localhost:8000` dan frontend Next.js di `http://localhost:3000`.

---

## 2. Deploy ke cPanel Shared Hosting

Aplikasi ini dirancang agar sangat mudah di-host di cPanel shared hosting tanpa memerlukan VPS Node.js. Frontend Next.js akan diexport menjadi file HTML statis biasa, sedangkan backend PHP diunggah sebagai REST API standar.

### Struktur Folder di cPanel
```text
public_html/                ← Folder utama domain Anda (e.g., domain.com)
├── index.html              ← Frontend Next.js (file html hasil export)
├── _next/                  ← Folder aset frontend Next.js
├── dashboard/              ← Halaman dashboard Next.js (statis)
├── api/                    ← API Backend PHP (pindahkan isi folder backend/api di sini)
│   ├── auth/
│   ├── analytics/
│   └── ...
├── config/                 ← File konfigurasi database backend PHP
├── vendor/                 ← Folder library PHP composer
├── uploads/                ← Folder upload file Excel sementara
│   └── temp/
├── .env                    ← Konfigurasi database produksi
└── .htaccess               ← Proteksi file .env dan routing
```

### Langkah-Langkah Deploy:

#### Langkah 1: Build dan Export Frontend Next.js
1. Buka terminal di folder `frontend` di komputer lokal Anda.
2. Jalankan perintah build:
   ```bash
   pnpm build
   ```
3. Next.js akan menghasilkan folder `out/` di dalam `frontend/` yang berisi semua halaman web statis HTML/CSS/JS.
4. Compress seluruh isi folder `frontend/out/` menjadi file `.zip` (misal: `frontend.zip`).

#### Langkah 2: Siapkan Database di cPanel
1. Login ke **cPanel** → **MySQL Databases**.
2. Buat database baru (misal: `user_dashboard`).
3. Buat user database baru (misal: `user_dbuser`) dan hubungkan ke database dengan akses **ALL PRIVILEGES**.
4. Buka **phpMyAdmin** di cPanel → Pilih database yang baru dibuat → Klik tab **Import** → Upload file `backend/database/migrations.sql` lalu klik **Go**.

#### Langkah 3: Upload File ke File Manager cPanel
1. Buka cPanel **File Manager** → Masuk ke folder **`public_html/`**.
2. Upload `frontend.zip` ke `public_html/` lalu extract. Pastikan file `index.html` berada langsung di bawah `public_html/`.
3. Upload seluruh isi folder `backend/` (seperti `api/`, `config/`, `helpers/`, `middleware/`, `models/`, `vendor/`) langsung ke `public_html/`.
4. Buat folder `uploads/temp/` di dalam `public_html/` dengan izin chmod `755` untuk menampung file Excel sementara.

#### Langkah 4: Konfigurasi File `.env` Produksi
Buat file bernama `.env` di dalam root folder `public_html/` cPanel Anda:
```env
DB_HOST=localhost
DB_PORT=3306
DB_NAME=namauser_dashboard
DB_USER=namauser_dbuser
DB_PASS=password_database_anda

FRONTEND_URL=https://domainanda.com
```

#### Langkah 5: Proteksi File Keamanan via `.htaccess`
Buat file `.htaccess` di root `public_html/` untuk mencegah akses publik ke folder konfigurasi dan file `.env`:
```apache
# Blokir akses langsung ke file sensitif
<Files ".env">
    Order allow,deny
    Deny from all
</Files>
<Files "composer.json">
    Order allow,deny
    Deny from all
</Files>

# Blokir folder internal PHP
RewriteEngine On
RewriteRule ^(config|helpers|middleware|models|vendor|uploads)/(.*)$ - [F,L]
```

---

## 3. Contoh File Konfigurasi `.env`

### Backend `.env` (Lokal & Produksi)
Letakkan file ini di root folder project (Lokal) atau root `public_html/` (cPanel):
```env
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=dashboard_monitoring
DB_USER=root
DB_PASS=

FRONTEND_URL=http://localhost:3000
```

### Frontend `.env.local` (Hanya untuk Lokal)
Letakkan file ini di folder `frontend/.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

*Catatan: Saat dideploy ke cPanel, Anda tidak perlu mengatur `.env.local` pada frontend karena frontend dibuild secara statis dan akan memanggil relative path API `/api/...` secara otomatis.*

---

## 4. Instruksi Cara Import Data Excel

Fitur ini hanya dapat diakses oleh user dengan role **Admin**. 

### Langkah-langkah Import:
1. Pastikan Anda sudah login menggunakan akun **Admin** (Kredensial default: `admin@example.com` / `Admin@123456`).
2. Masuk ke halaman **Import Excel** dari menu sidebar.
3. Seret file Excel (.xlsx / .xls) Anda ke kotak dropzone, atau klik kotak tersebut untuk memilih file dari penyimpanan lokal Anda.
4. Klik tombol **Pratinjau Data** (Preview).
5. Sistem akan membaca baris ke-2 dari file Excel Anda sebagai baris header kolom dan menampilkan:
   - Baris header terdeteksi.
   - Jumlah kolom yang berhasil dicocokkan dengan format database.
   - Contoh **5 baris data pertama** dalam bentuk tabel pratinjau.
6. Silakan tinjau data pratinjau tersebut. Jika header kolom sudah sesuai dengan template, klik tombol **Konfirmasi & Simpan ke DB** untuk memulai proses import penuh.
7. Setelah selesai, sistem akan menampilkan statistik data:
   - Jumlah baris yang diproses.
   - Jumlah baris berhasil disimpan.
   - Jumlah baris gagal beserta detail deskripsi error per barisnya (jika ada).

### Aturan Format File Excel:
- **Baris Header**: Header kolom wajib berada pada baris ke-2 (Baris ke-1 bisa berisi judul file atau dibiarkan kosong).
- **Nama Header Kolom**: Wajib menggunakan nama berikut agar dapat dibaca oleh sistem (urutan kolom bebas):
  > PDID, CAID, Scarlett / IOMS ID Final, Status PO, PoNo Tsel, Capex, Band, Sector, Project Category, SOW Actual, Vendor Principle, CR Status, Status EBA Mapping, EBA Mapping Number, Donor Act SiteID, Donor NOP, Donor TP, Donor Progress, Re-Plan Dismantle, Donor Dismantle Actual, SiteID PO, SiteID Act, NEID Act, Site Name, Infra Type, Lat, Long, City, Province, NOP, TP Detail, RFS Actual, RFS Month, Mitra Impl, Progress Act, Issue Category, Notes Progress, GAP Analysis, Blocking, Support Needed, PIC Blocking, Detail PIC Blocking, Current Position, Status Project*, Progress Closing, Sub Progress Closing, ATP Status, LV Status, OAC Status, QC Status, SQAC Status, BAUT Status, BAST Status.
- **Parsing Kolom Khusus**:
  - Kolom **Blocking**: Membaca nilai "Yes", "Ya", "1", "True", "Blocking", "Y" sebagai blocking aktif (`1`), nilai selain itu dibaca `0`.
  - Kolom **Progress Act & Progress Closing**: Secara otomatis diparse menjadi angka (desimal). Jika bernilai "100%", "Completed", "Done" otomatis disimpan sebagai `100.00`. Jika berisi persentase desimal (seperti `0.85` di Excel) otomatis disimpan sebagai `85.00`.
  - Kolom **Lat & Long**: Disimpan sebagai nilai desimal dengan koordinat geografis yang valid (Lat: -90 s/d 90, Long: -180 s/d 180).

---

## 5. Checklist Testing Fitur Utama

Gunakan checklist ini untuk menguji fungsionalitas monitoring dashboard setelah instalasi:

| No | Modul | Langkah Pengujian | Hasil yang Diharapkan | Status |
|----|-------|-------------------|-----------------------|--------|
| 1 | Auth | Daftar akun baru di `/signup` | Akun berhasil dibuat dan dialihkan ke login | [ ] |
| 2 | Auth | Login menggunakan kredensial admin | Dialihkan ke dashboard utama dan session tersimpan | [ ] |
| 3 | Auth | Login menggunakan kredensial viewer | Dialihkan ke dashboard, menu "Import Excel" & "Users" tersembunyi | [ ] |
| 4 | Import | Unggah file Excel rollout di `/dashboard/import` | Pratinjau data muncul dan menampilkan 5 baris pertama | [ ] |
| 5 | Import | Klik "Konfirmasi & Simpan" data pratinjau | Seluruh data Excel masuk ke database tanpa error | [ ] |
| 6 | Overview | Kunjungi halaman `/dashboard` | Menampilkan 8 KPI Cards (termasuk rata-rata progress) & 5 chart utama | [ ] |
| 7 | Data Table | Kunjungi halaman `/dashboard/data` | Menampilkan tabel project lengkap dengan pagination & kolom sorting | [ ] |
| 8 | Data Table | Ketik kata kunci di kolom cari | Hasil pencarian memfilter data secara dinamis | [ ] |
| 9 | Data Table | Ubah opsi filter provinsi/mitra/status | Data tabel terupdate sesuai filter yang dipilih | [ ] |
| 10 | Data Table | Klik tombol "Export CSV" | File CSV terunduh berisi data halaman aktif | [ ] |
| 11 | Data Table | Klik ikon "Mata" (Detail) pada salah satu baris | Dialog muncul menampilkan data detail site terbagi dalam kategori | [ ] |
| 12 | Analytics | Kunjungi `/dashboard/analytics` | Memuat Dynamic Chart Builder sesuai setelan default | [ ] |
| 13 | Analytics | Pilih dimensi "province", metrik "avg_progress_act", jenis "line", lalu klik "Apply" | Grafik Recharts terupdate menampilkan visualisasi rata-rata progress per provinsi | [ ] |
| 14 | Issues | Kunjungi `/dashboard/issues` | Menampilkan data site terblokir, daftar support needed, pic, dan tabel site blocking | [ ] |
| 15 | Location Map | Kunjungi `/dashboard/location` | Memuat peta Leaflet dan menampilkan titik marker sesuai koordinat site | [ ] |
| 16 | Location Map | Klik marker di peta | Popup info site muncul dengan data nama site, status project, dan kendala | [ ] |
| 17 | Acceptance | Kunjungi `/dashboard/acceptance` | Menampilkan statistik milestone serah terima, grafik funnel, dan tabel site outstanding | [ ] |
| 18 | RBAC | Login sebagai Viewer, lalu coba akses langsung ke URL `/dashboard/users` | Akses ditolak dan dialihkan ke halaman utama (Forbidden) | [ ] |
| 19 | Users | Login sebagai Admin, lalu ubah role salah satu user di `/dashboard/users` | Role user berhasil diupdate di database | [ ] |
