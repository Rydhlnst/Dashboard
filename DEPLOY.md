# Deploy ke cPanel — Panduan Lengkap

## Gambaran Arsitektur di cPanel

```
yourdomain.com/
├── index.html              ← Frontend (Next.js static export)
├── _next/
├── dashboard/
├── projects/
├── login/
└── ...

yourdomain.com/backend/     ← Atau subdomain: api.yourdomain.com/
├── api/
│   ├── auth/
│   ├── projects/
│   └── ...
├── config/
├── vendor/
└── .env
```

---

## Langkah-Langkah Deploy

### Tahap 1: Siapkan Database di cPanel

1. Login ke **cPanel** → **MySQL Databases**
2. Buat database baru: `youruser_dashboard`
3. Buat user database baru: `youruser_dbuser`
4. Assign user ke database dengan **ALL PRIVILEGES**
5. Catat: hostname (biasanya `localhost`), nama DB, user, password

### Tahap 2: Import Schema Database

1. Buka **phpMyAdmin** → Pilih database yang baru dibuat
2. Klik tab **Import**
3. Upload file `backend/database/migrations.sql`
4. Klik **Go** / **Execute**

Verifikasi: tabel `users`, `project_records`, `import_batches`, `user_chart_preferences`, `audit_logs` sudah terbentuk.

### Tahap 3: Deploy Backend PHP

**Opsi A — Letakkan di subdirektori** (paling mudah):

1. Di cPanel **File Manager** → masuk ke `public_html/`
2. Buat folder `backend/`
3. Upload seluruh isi folder `backend/` (kecuali `uploads/temp/` bisa dibiarkan kosong)

**Opsi B — Subdomain** (lebih rapi):

1. Buat subdomain `api.yourdomain.com` pointing ke `/home/user/api/`
2. Upload isi `backend/` ke folder tersebut

**Konfigurasi .env Backend:**

Upload file `.env` ke root backend (setingkat dengan folder `api/`):

```env
DB_HOST=localhost
DB_PORT=3306
DB_NAME=youruser_dashboard
DB_USER=youruser_dbuser
DB_PASS=your_db_password
FRONTEND_URL=https://yourdomain.com
```

> ⚠️ **Pastikan file `.env` tidak bisa diakses publik!**

Tambahkan file `.htaccess` di root backend:

```apache
# backend/.htaccess
Options -Indexes
<Files ".env">
    Order allow,deny
    Deny from all
</Files>
<Files "composer.json">
    Order allow,deny
    Deny from all
</Files>
```

**Install Composer Dependencies:**

Via cPanel Terminal atau SSH:

```bash
cd /home/youruser/public_html/backend
composer install --no-dev --optimize-autoloader
```

Jika tidak ada akses SSH, upload folder `vendor/` yang sudah di-build dari lokal:

```bash
# Di lokal (dalam folder backend/)
composer install --no-dev --optimize-autoloader
# Lalu upload folder vendor/ ke server
```

**Set Permissions folder uploads:**

```bash
chmod 755 uploads/
chmod 755 uploads/temp/
```

### Tahap 4: Build & Deploy Frontend

**Build static export di lokal:**

```bash
cd frontend

# Edit .env.local — sesuaikan URL backend production
echo "NEXT_PUBLIC_API_URL=https://yourdomain.com/backend" > .env.local

# Build
pnpm build
# Output ada di: frontend/out/
```

**Upload ke cPanel:**

1. Masuk **File Manager** → `public_html/`
2. Upload seluruh isi folder `frontend/out/` langsung ke `public_html/`
   (bukan dalam subfolder, kecuali dashboard ada di subdirektori)

**Konfigurasi .htaccess untuk SPA routing:**

Upload `.htaccess` berikut ke `public_html/`:

```apache
Options -MultiViews
RewriteEngine On

# Handle Next.js static export trailing slash
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^(.*)$ /$1/ [L,R=301]

# Serve index.html untuk semua route SPA
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^([^/]+)/$ /index.html [L]
```

> **Catatan**: Next.js dengan `output: "export"` + `trailingSlash: true` membuat setiap halaman menjadi `folder/index.html`. `.htaccess` di atas membantu routing bekerja dengan benar.

### Tahap 5: Konfigurasi CORS

Edit `backend/config/cors.php` — pastikan `FRONTEND_URL` di `.env` sudah benar:

```env
FRONTEND_URL=https://yourdomain.com
```

Jika menggunakan subdomain untuk backend, tambahkan ke `FRONTEND_URL`:

```env
FRONTEND_URL=https://yourdomain.com,https://www.yourdomain.com
```

### Tahap 6: Test Deploy

1. Buka `https://yourdomain.com` → harus redirect ke `/login/`
2. Login dengan `admin@example.com` / `Admin@123456`
3. **Segera ubah password admin!**
4. Test import Excel kecil
5. Verifikasi data muncul di tabel dan dashboard

---

## Checklist Deploy

- [ ] Database dibuat dan schema diimport
- [ ] File `.env` backend sudah dikonfigurasi
- [ ] `vendor/` (Composer) sudah ada di server
- [ ] `.htaccess` backend melindungi `.env`
- [ ] Frontend di-build dengan `NEXT_PUBLIC_API_URL` yang benar
- [ ] File `out/` diupload ke `public_html/`
- [ ] `.htaccess` untuk SPA routing sudah diupload
- [ ] CORS sudah dikonfigurasi untuk domain production
- [ ] Folder `uploads/temp/` ada dengan permission 755
- [ ] Login berhasil
- [ ] Import Excel berhasil
- [ ] Password admin sudah diubah

---

## Troubleshooting

### Error 403 / 404 setelah navigate halaman
→ Pastikan `.htaccess` sudah terupload dan `mod_rewrite` aktif di cPanel.

### Error CORS (blocked by CORS policy)
→ Cek `FRONTEND_URL` di `.env` backend sudah sesuai domain frontend (dengan `https://`).

### Import Excel gagal: "PhpSpreadsheet not installed"
→ Jalankan `composer install` atau upload folder `vendor/` dari hasil build lokal.

### Session tidak persistent / logout terus
→ Pastikan HTTPS aktif. Cookie `Secure` hanya bekerja di HTTPS.

### Database connection failed
→ Cek credentials di `.env`. Di beberapa hosting, hostname bukan `localhost` tapi IP khusus — cek di cPanel MySQL.

### Frontend tidak bisa connect ke API
→ Cek `NEXT_PUBLIC_API_URL` saat build. Nilai ini di-hardcode saat build — harus rebuild jika URL berubah.

---

## Struktur File Setelah Deploy

```
public_html/
├── .htaccess              ← SPA routing
├── index.html             ← Root page (redirect ke /login)
├── _next/                 ← Next.js assets
├── login/
│   └── index.html
├── signup/
│   └── index.html
├── dashboard/
│   └── index.html
├── projects/
│   └── index.html
├── import/
│   └── index.html
├── users/
│   └── index.html
├── settings/
│   └── charts/
│       └── index.html
└── backend/               ← PHP API
    ├── .htaccess          ← Proteksi .env
    ├── .env               ← Konfigurasi (TIDAK public)
    ├── api/
    ├── config/
    ├── helpers/
    ├── middleware/
    ├── models/
    ├── vendor/
    └── uploads/
        └── temp/
```
