# Nimbus Vault

Private vault portal with:

- admin-managed member access
- hidden storage/mailbox channels behind the scenes
- vault sections for photos, videos, files, notes, passwords, messages, and mail
- Google OAuth integration for hidden account connections

## Current deployment status

This repo is now:

- GitHub-ready
- preview-deploy-ready
- production-hardened for cookies, legal pages, and object storage

What is still not fully production-complete:

- the current Postgres support is now available through `DATABASE_URL`
- the repository layer still uses a compatibility bridge instead of a fully optimized native async data layer

So you can deploy this for preview/staging now, and the binary file storage path is ready for object storage in production.

## Local development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Local demo accounts

By default, demo seed data is enabled outside production.

- Member: `amber / vault123`
- Admin: `admin / admin123`

To disable demo seeding, set:

```bash
SEED_DEMO_DATA=false
```

## Environment variables

Copy `.env.example` to `.env.local` and fill in what you need.

Important groups:

### App and public URLs

```bash
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SHOW_DEMO_CREDENTIALS=true
```

### Google OAuth

```bash
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:3000/api/google/callback
```

### Admin bootstrap

These are used to ensure there is at least one admin account:

```bash
ADMIN_BOOTSTRAP_USERNAME=admin
ADMIN_BOOTSTRAP_EMAIL=admin@nimbus.local
ADMIN_BOOTSTRAP_PASSWORD=admin123
ADMIN_BOOTSTRAP_FULL_NAME=System Admin
ADMIN_BOOTSTRAP_AVATAR=SA
ADMIN_BOOTSTRAP_ROLE_LABEL=Administrator
```

### Object storage

Nimbus Vault now supports S3-compatible object storage for uploaded binary files.
If these are missing, it falls back to local storage in `data/uploads`.

```bash
OBJECT_STORAGE_REGION=
OBJECT_STORAGE_BUCKET=
OBJECT_STORAGE_ACCESS_KEY_ID=
OBJECT_STORAGE_SECRET_ACCESS_KEY=
OBJECT_STORAGE_ENDPOINT=
OBJECT_STORAGE_FORCE_PATH_STYLE=false
```

This works well with:

- AWS S3
- Cloudflare R2
- Backblaze B2 S3-compatible API
- many Railway/Vercel-friendly S3-compatible providers

## Production deployment checklist

### 1. Preview deploy first

Recommended:

- Vercel for easiest Next.js previews
- Railway for a more backend-oriented deployment path

### 2. Set production URL

Set:

```bash
NEXT_PUBLIC_APP_URL=https://your-domain.com
GOOGLE_REDIRECT_URI=https://your-domain.com/api/google/callback
```

### 3. Configure database

Set:

```bash
DATABASE_URL=postgres://...
POSTGRES_SSL=true
SEED_DEMO_DATA=false
NEXT_PUBLIC_SHOW_DEMO_CREDENTIALS=false
```

Without `DATABASE_URL`, the app still falls back to local SQLite.

### 4. Configure object storage

Point the `OBJECT_STORAGE_*` variables at an S3-compatible bucket so uploaded/imported binaries are not stored on ephemeral local disk.

### 5. Configure Google OAuth

- enable the required Google APIs
- set your production redirect URI
- add privacy and terms URLs
- move the OAuth app toward production/verification

### 6. Optimize the Postgres layer further

The app can now run against hosted Postgres, but the current bridge keeps the existing repository API intact rather than fully rewriting the data layer. That is enough to unblock deployment, and a deeper repository refactor can come later for scale/performance.

## Legal/public pages

The app now includes:

- `/privacy`
- `/terms`

Replace the placeholder contact text on those pages before production launch.

## Build

```bash
npm run build
```

## Notes

- Session cookies automatically become secure in production.
- Demo credentials are hidden in production by default unless `NEXT_PUBLIC_SHOW_DEMO_CREDENTIALS=true`.
- Local runtime files under `data/` are ignored by Git.
