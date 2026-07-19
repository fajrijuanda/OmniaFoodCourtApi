# Omnia API

Nest.js backend untuk katalog industri Omnia, auth portal, dan admin CRUD.

## Setup

```bash
npm install
copy .env.example .env
npm run prisma:generate
npm run prisma:migrate
npm run seed
npm run dev
```

`DATABASE_URL` memakai URI Supabase Postgres. Password database tidak disimpan di repo.

`npm run seed` hanya mengisi superadmin, katalog, paket harga, dan add-on. Data workspace demo tidak dibuat secara default agar aman untuk production. Jika butuh data demo lokal, jalankan:

```bash
npm run seed:demo
```

Untuk production, ganti password akun seed `admin@omnia.local` segera setelah deploy pertama atau buat superadmin baru lalu nonaktifkan akun default.

## HRIS Smoke Test

Untuk QA lokal/staging sebelum launch HRIS:

```bash
npm run seed:demo
npm run dev
npm run smoke:hris
```

Env opsional:

```txt
SMOKE_API_URL=http://localhost:4000/api
SMOKE_EMAIL=owner@omnia.local
SMOKE_PASSWORD=Owner123!
```

Smoke test mengecek login, employee database, selfie enrollment MVP, liveness challenge MVP, clock-in, leave approval, payroll finalize, payslip, dan dashboard summary. Xendit tidak ikut dites di script ini.

## Payment Checkout

Checkout publik dari Landing memakai Xendit Invoice sebagai payment link server-side:

```txt
XENDIT_SECRET_KEY=xnd_...
XENDIT_CALLBACK_TOKEN=...
LANDING_PUBLIC_URL=https://omnia-landing-page.vercel.app
PORTAL_URL=https://omnia-portal.vercel.app
```

Endpoint:

- `POST /api/public/checkout`
- `POST /api/public/checkout/xendit-webhook`
- `POST /api/billing/checkout`

Default checkout memakai QRIS karena fee gateway paling rendah untuk pembayaran publik Omnia. Biaya payment gateway dihitung di API dan ditambahkan ke total tagihan customer. Checkout Portal menyimpan sesi billing tenant; saat webhook Xendit berstatus `PAID`, API mengaktifkan atau memperpanjang subscription tenant sesuai invoice.

## Automatic Supabase Migration

Setiap push ke branch `master` akan menjalankan GitHub Actions `.github/workflows/supabase-prisma.yml`:

```bash
npm run prisma:generate
npm run prisma:deploy
npm run seed
```

Tambahkan secret `DATABASE_URL` di GitHub repo settings sebelum workflow dipakai. Untuk GitHub Actions, gunakan URI **Session pooler** dari Supabase jika direct connection gagal dijangkau dari runner GitHub.

Supabase Dashboard:

```txt
Connect > Direct/ORM > Connection Method: Session pooler > Type: URI
```

Jangan gunakan direct IPv6-only URL untuk GitHub Actions kecuali project Supabase sudah punya IPv4 add-on.

## Endpoints

- `POST /api/auth/login`
- `POST /api/auth/register`
- `GET /api/auth/me`
- `GET /api/public/catalog`
- `GET /api/public/industries`
- `GET /api/public/industries/:slug`
- `GET /api/public/sub-industries/:slug/plans`
- `GET|POST|PATCH|DELETE /api/admin/:entity`

Admin entity yang tersedia: `industries`, `sub-industries`, `tiers`, `features`, `tier-features`, dan `users`.

Superadmin customer dashboard:

- `GET /api/admin/customers/overview`
- `GET /api/admin/customers/accounts`
- `GET /api/admin/customers/transactions`
- `GET /api/admin/customers/follow-ups`
- `PATCH /api/admin/customers/follow-ups/:id`

## OAuth

Tambahkan env berikut untuk login/register Google dan GitHub:

```txt
PORTAL_URL=https://domain-portal.vercel.app
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_CALLBACK_URL=https://domain-api.vercel.app/api/auth/google/callback
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
GITHUB_CALLBACK_URL=https://domain-api.vercel.app/api/auth/github/callback
```

Pada Google/GitHub developer settings, callback URL harus sama persis dengan env callback di atas.

## Seed Accounts

- `admin@omnia.local` / `Admin123!` dibuat oleh `npm run seed`.
- `owner@omnia.local` / `Owner123!` dan `employee@omnia.local` / `Employee123!` hanya dibuat oleh `npm run seed:demo`.

## Trial Registration

`POST /api/auth/register` membuat akun `owner` trial 3 hari. Payload:

```json
{
  "name": "Nama Bisnis",
  "email": "owner@domain.com",
  "password": "minimal-8-karakter",
  "subIndustryId": "id-sub-industri"
}
```

Backend otomatis memilih Tier Starter dari sub-industri tersebut. Setelah `trialEndsAt` lewat, login tetap berhasil tetapi response user mengembalikan `effectiveSubscriptionStatus: "unsubscribed"` dan `trialExpired: true`.
