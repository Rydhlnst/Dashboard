# Dashboard Monitoring Data

MVP dashboard untuk monitoring data project berbasis Excel upload.

## Tech Stack

| Layer | Teknologi |
|-------|-----------|
| Frontend | Next.js 15 + TypeScript + Tailwind CSS + ShadCN UI |
| Tabel | TanStack Table |
| Chart | Recharts |
| Backend | PHP 8+ REST API |
| Database | MySQL / MariaDB |
| Excel Parser | PhpSpreadsheet |
| Auth | PHP Session (HttpOnly Cookie) |
| Deploy | cPanel Shared Hosting |

---

## Struktur Folder

```
dashboad/
├── frontend/           ← Next.js app (static export)
│   ├── src/
│   │   ├── app/        ← Pages
│   │   ├── components/ ← UI components
│   │   ├── lib/        ← API client, auth helpers
│   │   └── types/      ← TypeScript types
│   └── package.json
│
└── backend/            ← PHP REST API
    ├── api/            ← Endpoints
    ├── config/         ← Database & CORS config
    ├── helpers/        ← Response, validation, upload helpers
    ├── middleware/     ← requireAuth, requireAdmin
    ├── models/         ← AuditLog model
    ├── database/       ← SQL migrations
    └── composer.json
```

---

## Setup Lokal

### Prasyarat
- PHP 8.0+, Composer, MySQL/MariaDB
- Node.js 18+ dan pnpm
- Web server lokal (XAMPP / Laragon / WAMP)

### 1. Setup Backend

```bash
cd backend
composer install
cp .env.example .env
# Edit .env sesuai database lokal
```

### 2. Setup Database

```sql
CREATE DATABASE dashboard_monitoring CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Import migration via phpMyAdmin atau CLI:

```bash
mysql -u root -p dashboard_monitoring < backend/database/migrations.sql
```

**Default Admin:**
- Email: `admin@example.com`
- Password: `Admin@123456`

> ⚠️ Ganti password admin segera setelah login pertama!

### 3. Generate hash password baru (opsional)

```php
<?php echo password_hash('Admin@123456', PASSWORD_BCRYPT, ['cost' => 12]);
```

### 4. Setup Frontend

```bash
cd frontend
pnpm install
cp .env.example .env.local
# Set NEXT_PUBLIC_API_URL ke URL backend
```

### 5. Run Dev

```bash
cd frontend && pnpm dev    # http://localhost:3000
# Backend: taruh di htdocs XAMPP, akses http://localhost/backend
```

---

## Build untuk Production (cPanel)

```bash
cd frontend
pnpm build
# Output: frontend/out/
```

Lihat [DEPLOY.md](DEPLOY.md) untuk panduan deploy lengkap ke cPanel.

---

## RBAC

| Fitur | Admin | Viewer |
|-------|-------|--------|
| Login / Signup | ✅ | ✅ |
| Dashboard & Chart | ✅ | ✅ |
| Lihat & Filter Projects | ✅ | ✅ |
| Ganti tipe chart | ✅ | ✅ |
| Import Excel | ✅ | ❌ |
| Tambah/Edit/Hapus Project | ✅ | ❌ |
| Manage Users & Role | ✅ | ❌ |

> RBAC di-enforce di **backend**. Frontend hanya menyembunyikan UI.

---

## API Endpoints

### Auth
| Method | Endpoint |
|--------|----------|
| POST | `/api/auth/signup.php` |
| POST | `/api/auth/login.php` |
| POST | `/api/auth/logout.php` |
| GET | `/api/auth/me.php` |

### Projects (Auth required)
| Method | Endpoint |
|--------|----------|
| GET | `/api/projects/index.php?page=&limit=&search=&status_project=&...` |
| GET | `/api/projects/show.php?id=` |
| POST | `/api/projects/create.php` (admin) |
| PUT | `/api/projects/update.php?id=` (admin) |
| DELETE | `/api/projects/delete.php?id=` (admin) |

### Import (Admin)
| Method | Endpoint |
|--------|----------|
| POST | `/api/import/excel.php` |

### Dashboard & Charts
| Method | Endpoint |
|--------|----------|
| GET | `/api/dashboard/summary.php` |
| GET | `/api/charts/data.php?group_by=` |
| GET | `/api/chart-preferences/index.php` |
| POST | `/api/chart-preferences/save.php` |

### Users (Admin)
| Method | Endpoint |
|--------|----------|
| GET | `/api/users/index.php` |
| PUT | `/api/users/update-role.php` |
| PUT | `/api/users/update-status.php` |

---

## Security Features

- bcrypt password hashing (cost 12)
- PDO prepared statements (SQL injection safe)
- Session regeneration on login
- HttpOnly + SameSite cookies
- RBAC enforced server-side
- File upload validation (ext + size)
- Temp file auto-cleanup post-import
- CORS per-domain whitelist
- Audit log: login, import, create, update, delete

---

## Format Excel

Header di **baris ke-2**. Kolom yang didukung:

```
PDID, CAID, Scarlett / IOMS ID Final, Status PO, PoNo Tsel, Capex,
Band, Sector, Project Category, SOW Actual, Vendor Principle, CR Status,
Status EBA Mapping, EBA Mapping Number, Donor Act SiteID, Donor NOP,
Donor TP, Donor Progress, Re-Plan Dismantle, Donor Dismantle Actual,
SiteID PO, SiteID Act, NEID Act, Site Name, Infra Type, Lat, Long,
City, Province, NOP, TP Detail, RFS Actual, RFS Month, Mitra Impl,
Progress Act, Issue Category, Notes Progress, GAP Analysis, Blocking,
Support Needed, PIC Blocking, Detail PIC Blocking, Current Position,
Status Project, Progress Closing, Sub Progress Closing, ATP Status,
LV Status, OAC Status, QC Status, SQAC Status, BAUT Status, BAST Status
```
