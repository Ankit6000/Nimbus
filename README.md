# Nimbus Vault

Private portal for admin-managed members who should see a single vault while the assigned Google accounts stay hidden in the backend.

## What is implemented

- Next.js App Router frontend
- Cookie-based member login
- Persistent SQLite database stored at `data/vault.db`
- Seeded demo member and hidden Google account assignments
- Aggregated dashboard totals across assigned accounts
- Section pages for photos, drive, passwords, notes, messages, and mail
- Google sync service for Drive and Gmail, ready to run when OAuth credentials and refresh tokens are added
- iCloud sync request placeholder that records sync intent in the database

## Demo login

- Username: `amber`
- Email: `amber@nimbus.local`
- Password: `vault123`

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Database

The app automatically creates and seeds a SQLite database on first server start:

- Database file: `data/vault.db`
- Tables:
  - `users`
  - `hidden_google_accounts`
  - `icloud_connections`
  - `vault_items`
  - `sync_runs`

If you want a fresh local database, delete `data/vault.db` and restart the app.

## Google integration setup

Create `.env.local` from `.env.example` and fill in:

```bash
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=
```

The sync service expects hidden Google accounts in the database to have refresh tokens with at least:

- `https://www.googleapis.com/auth/drive.metadata.readonly`
- `https://www.googleapis.com/auth/gmail.readonly`

Right now the seeded hidden accounts are placeholders, so the dashboard can render real aggregated data even before live Google credentials are attached.

To attach a hidden Google account to a member, use the admin-facing connect route after filling `.env.local`:

```text
/api/google/connect?userId=<member-user-id>&label=<internal-label>&emailHint=<google-email>
```

After consent, the callback stores the refresh token in the local database while keeping the account invisible in the member UI.

## Build

```bash
npm run build
```
