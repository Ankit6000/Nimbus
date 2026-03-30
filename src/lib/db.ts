import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import bcrypt from "bcryptjs";

const dataDir = path.join(process.cwd(), "data");
const dbPath = path.join(dataDir, "vault.db");

type GlobalWithDb = typeof globalThis & {
  __vaultDb?: DatabaseSync;
};

function createDatabase() {
  fs.mkdirSync(dataDir, { recursive: true });

  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");

  applySchema(db);
  seedDatabase(db);

  return db;
}

function applySchema(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      avatar TEXT NOT NULL,
      role_label TEXT NOT NULL,
      is_admin INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS hidden_google_accounts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      account_label TEXT NOT NULL,
      google_email TEXT NOT NULL,
      login_password_json TEXT,
      refresh_token TEXT,
      scopes TEXT,
      total_bytes INTEGER NOT NULL DEFAULT 0,
      used_bytes INTEGER NOT NULL DEFAULT 0,
      kind TEXT NOT NULL DEFAULT 'drive',
      status TEXT NOT NULL DEFAULT 'seeded',
      last_synced_at TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS icloud_connections (
      user_id TEXT PRIMARY KEY,
      connected INTEGER NOT NULL DEFAULT 0,
      apple_email TEXT,
      last_sync TEXT,
      pending_items INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS apple_accounts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      label TEXT NOT NULL,
      apple_email TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'linked',
      last_sync TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS vault_items (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      section TEXT NOT NULL,
      title TEXT NOT NULL,
      subtitle TEXT,
      bytes INTEGER NOT NULL DEFAULT 0,
      item_kind TEXT,
      source TEXT,
      source_account_id TEXT,
      occurred_at TEXT NOT NULL,
      unread INTEGER NOT NULL DEFAULT 0,
      meta_json TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS sync_runs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      provider TEXT NOT NULL,
      account_id TEXT,
      status TEXT NOT NULL,
      item_count INTEGER NOT NULL DEFAULT 0,
      message TEXT,
      started_at TEXT NOT NULL,
      finished_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      actor_user_id TEXT NOT NULL,
      target_user_id TEXT,
      action TEXT NOT NULL,
      details TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE SET NULL
    );
  `);

  ensureColumn(db, "users", "is_admin", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn(db, "hidden_google_accounts", "login_password_json", "TEXT");
  ensureColumn(db, "vault_items", "source_account_id", "TEXT");
  ensureColumn(db, "sync_runs", "account_id", "TEXT");
  ensureColumn(db, "sync_runs", "item_count", "INTEGER NOT NULL DEFAULT 0");
}

function seedDatabase(db: DatabaseSync) {
  const existingAdmin = db
    .prepare("SELECT id FROM users WHERE username = ?")
    .get("admin") as { id: string } | undefined;

  if (!existingAdmin) {
    const now = new Date().toISOString();
    const adminId = randomUUID();
    const adminPasswordHash = bcrypt.hashSync("admin123", 10);

    db.prepare(
      `
        INSERT INTO users (id, username, email, password_hash, full_name, avatar, role_label, is_admin, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    ).run(
      adminId,
      "admin",
      "admin@nimbus.local",
      adminPasswordHash,
      "System Admin",
      "SA",
      "Administrator",
      1,
      now,
    );
  }

  const existingUser = db
    .prepare("SELECT id FROM users WHERE username = ?")
    .get("amber") as { id: string } | undefined;
  const now = new Date().toISOString();
  let userId = existingUser?.id;

  if (!userId) {
    userId = randomUUID();
    const passwordHash = bcrypt.hashSync("vault123", 10);

    db.prepare(
      `
        INSERT INTO users (id, username, email, password_hash, full_name, avatar, role_label, is_admin, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    ).run(
      userId,
      "amber",
      "amber@nimbus.local",
      passwordHash,
      "Amber Rahman",
      "AR",
      "Private Vault Member",
      0,
      now,
    );
  }

  const accountStmt = db.prepare(
    `
      INSERT INTO hidden_google_accounts
      (id, user_id, account_label, google_email, refresh_token, scopes, total_bytes, used_bytes, kind, status, last_synced_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
  );

  const accounts = [
    {
      label: "drive-core",
      email: "hidden.drive.a@example.com",
      total: 21474836480,
      used: 14817637171,
      kind: "drive",
    },
    {
      label: "drive-archive",
      email: "hidden.drive.b@example.com",
      total: 32212254720,
      used: 21115079021,
      kind: "drive",
    },
    {
      label: "mail-primary",
      email: "hidden.mail.a@example.com",
      total: 16106127360,
      used: 7021461296,
      kind: "mail",
    },
    {
      label: "mail-secondary",
      email: "hidden.mail.b@example.com",
      total: 21474836480,
      used: 11964882944,
      kind: "mail",
    },
  ];

  const hasHiddenAccounts = db
    .prepare("SELECT id FROM hidden_google_accounts WHERE user_id = ? LIMIT 1")
    .get(userId) as { id: string } | undefined;

  if (!hasHiddenAccounts) {
    for (const account of accounts) {
      accountStmt.run(
        randomUUID(),
        userId,
        account.label,
        account.email,
        null,
        "https://www.googleapis.com/auth/drive.metadata.readonly https://www.googleapis.com/auth/gmail.readonly",
        account.total,
        account.used,
        account.kind,
        "seeded",
        now,
        now,
      );
    }
  }

  const hasIcloudConnection = db
    .prepare("SELECT user_id FROM icloud_connections WHERE user_id = ? LIMIT 1")
    .get(userId) as { user_id: string } | undefined;

  if (!hasIcloudConnection) {
    db.prepare(
      `
        INSERT INTO icloud_connections (user_id, connected, apple_email, last_sync, pending_items)
        VALUES (?, ?, ?, ?, ?)
      `,
    ).run(userId, 1, "amber@icloud.example", "2026-03-28T14:40:00.000Z", 19);
  }

  const appleStmt = db.prepare(
    `
      INSERT INTO apple_accounts (id, user_id, label, apple_email, status, last_sync, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
  );

  const hasAppleAccounts = db
    .prepare("SELECT id FROM apple_accounts WHERE user_id = ? LIMIT 1")
    .get(userId) as { id: string } | undefined;

  if (!hasAppleAccounts) {
    appleStmt.run(
      randomUUID(),
      userId,
      "Primary iPhone",
      "amber@icloud.example",
      "linked",
      "2026-03-28T14:40:00.000Z",
      now,
    );
    appleStmt.run(
      randomUUID(),
      userId,
      "Old iPad archive",
      "amber.backup@icloud.example",
      "queued",
      "2026-03-24T10:10:00.000Z",
      now,
    );
  }

  const itemStmt = db.prepare(
    `
      INSERT INTO vault_items
      (id, user_id, section, title, subtitle, bytes, item_kind, source, occurred_at, unread, meta_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
  );

  const items = [
    ["photos", "Bali-sunrise.mov", "", 3456106496, "video", "icloud", "2026-03-26T05:20:00.000Z", 0],
    ["photos", "Family-day.jpg", "", 8456114, "image", "device", "2026-03-24T10:00:00.000Z", 0],
    ["photos", "Receipt-scan.jpg", "", 2145614, "image", "icloud", "2026-03-21T11:20:00.000Z", 0],
    ["drive", "College Archive.zip", "archive", 5282412544, "archive", "google-drive", "2026-03-27T07:00:00.000Z", 0],
    ["drive", "Brand Strategy.pdf", "document", 42652141, "document", "google-drive", "2026-03-20T08:15:00.000Z", 0],
    ["drive", "Client Sheets", "folder", 2011520, "folder", "google-drive", "2026-03-25T17:30:00.000Z", 0],
    ["passwords", "Netflix Household", "amber.family", 5120, "credential", "vault", "2026-03-25T03:10:00.000Z", 0],
    ["passwords", "Bank Portal", "amber.r", 6144, "credential", "vault", "2026-03-18T16:40:00.000Z", 0],
    ["notes", "Quarterly plan", "Finalize renewal pricing and vendor shortlist.", 23654, "note", "vault", "2026-03-27T18:05:00.000Z", 0],
    ["notes", "Travel checklist", "Passports, chargers, medicine, camera cards.", 7642, "note", "vault", "2026-03-22T06:55:00.000Z", 0],
    ["messages", "Rafiq", "Imported thread", 147620, "message-archive", "import", "2026-03-28T11:48:00.000Z", 0],
    ["messages", "Design Team", "Imported archive", 264120, "message-archive", "import", "2026-03-24T09:02:00.000Z", 0],
    ["mail", "Flight confirmation for April", "travel@alerts.example", 58212, "mail", "gmail", "2026-03-28T02:12:00.000Z", 1],
    ["mail", "Invoice 0918 paid", "billing@vendor.example", 33671, "mail", "gmail", "2026-03-26T13:34:00.000Z", 0],
    ["mail", "Shared folder updated", "drive@workspace.example", 47990, "mail", "gmail", "2026-03-25T09:01:00.000Z", 0],
  ] as const;

  const hasVaultItems = db
    .prepare("SELECT id FROM vault_items WHERE user_id = ? LIMIT 1")
    .get(userId) as { id: string } | undefined;

  if (!hasVaultItems) {
    for (const item of items) {
      itemStmt.run(
        randomUUID(),
        userId,
        item[0],
        item[1],
        item[2],
        item[3],
        item[4],
        item[5],
        item[6],
        item[7],
        null,
      );
    }
  }
}

function ensureColumn(db: DatabaseSync, table: string, column: string, definition: string) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  const exists = columns.some((entry) => entry.name === column);

  if (!exists) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

export function getDb() {
  const globalWithDb = globalThis as GlobalWithDb;

  if (!globalWithDb.__vaultDb) {
    globalWithDb.__vaultDb = createDatabase();
  } else {
    applySchema(globalWithDb.__vaultDb);
    seedDatabase(globalWithDb.__vaultDb);
  }

  return globalWithDb.__vaultDb;
}
