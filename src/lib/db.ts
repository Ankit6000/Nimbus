import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import bcrypt from "bcryptjs";
import { Pool as NeonPool, neonConfig } from "@neondatabase/serverless";
import postgres, { Sql } from "postgres";
import ws from "ws";

const dataDir = path.join(process.cwd(), "data");
const dbPath = path.join(dataDir, "vault.db");

type GlobalWithDb = typeof globalThis & {
  __vaultDb?: DatabaseSync;
  __vaultPg?: Sql;
  __vaultNeonPool?: NeonPool;
  __vaultInitPromise?: Promise<void>;
  __vaultPgCompatReady?: boolean;
  __vaultForceSqliteFallback?: boolean;
};

type SyncPreparedStatement = {
  all: (...params: unknown[]) => unknown[];
  get: (...params: unknown[]) => unknown;
  run: (...params: unknown[]) => { changes?: number };
};

type SyncDbCompat = {
  prepare: (query: string) => SyncPreparedStatement;
  exec: (query: string) => void;
};

export type DatabaseRuntimeStatus = {
  label: string;
  tone: "stable" | "warning";
};

const schemaSql = `
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
    total_bytes BIGINT NOT NULL DEFAULT 0,
    used_bytes BIGINT NOT NULL DEFAULT 0,
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
    bytes BIGINT NOT NULL DEFAULT 0,
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
`;

function shouldSeedDemoData() {
  if (process.env.SEED_DEMO_DATA === "true") return true;
  if (process.env.SEED_DEMO_DATA === "false") return false;
  return process.env.NODE_ENV !== "production";
}

function getBootstrapAdminConfig() {
  return {
    username: process.env.ADMIN_BOOTSTRAP_USERNAME || "admin",
    email: process.env.ADMIN_BOOTSTRAP_EMAIL || "admin@nimbus.local",
    password: process.env.ADMIN_BOOTSTRAP_PASSWORD || "admin123",
    fullName: process.env.ADMIN_BOOTSTRAP_FULL_NAME || "System Admin",
    avatar: process.env.ADMIN_BOOTSTRAP_AVATAR || "SA",
    roleLabel: process.env.ADMIN_BOOTSTRAP_ROLE_LABEL || "Administrator",
  };
}

function isPostgresMode() {
  return Boolean(process.env.DATABASE_URL);
}

function allowSqliteFallback() {
  return process.env.ALLOW_SQLITE_FALLBACK === "true";
}

function isNeonConnectionString(connectionString = process.env.DATABASE_URL) {
  return /neon\.tech/i.test(connectionString ?? "");
}

function shouldUsePostgres() {
  const globalWithDb = globalThis as GlobalWithDb;
  return isPostgresMode() && !globalWithDb.__vaultForceSqliteFallback;
}

function toPgPlaceholders(query: string) {
  let index = 0;
  return query.replace(/\?/g, () => `$${++index}`);
}

function runPostgresSyncCommand<T>(payload: Record<string, unknown>) {
  const script = `
    import postgres from "postgres";
    import { Pool, neonConfig } from "@neondatabase/serverless";
    import ws from "ws";

    const payload = JSON.parse(Buffer.from(process.env.NIMBUS_PG_PAYLOAD, "base64").toString("utf8"));
    const isNeon = /neon\\.tech/i.test(payload.connectionString ?? "");
    const sql = isNeon
      ? null
      : postgres(payload.connectionString, {
          ssl: payload.sslMode,
          max: 1,
          idle_timeout: 1,
          connect_timeout: 20,
        });
    const pool = (() => {
      if (!isNeon) return null;
      neonConfig.webSocketConstructor = ws;
      return new Pool({
        connectionString: payload.connectionString,
      });
    })();

    try {
      let result;
      if (payload.kind === "exec") {
        if (pool) {
          result = await pool.query(payload.query);
        } else {
          result = await sql.unsafe(payload.query);
        }
        process.stdout.write(JSON.stringify({ ok: true }));
      } else {
        const rows = pool
          ? await pool.query(payload.query, payload.params ?? [])
          : await sql.unsafe(payload.query, payload.params ?? []);
        process.stdout.write(JSON.stringify({
          ok: true,
          rows: pool ? rows.rows : rows,
          count: pool ? (rows.rowCount ?? rows.rows.length ?? 0) : (rows.count ?? rows.length ?? 0),
        }));
      }
    } catch (error) {
      process.stderr.write(JSON.stringify({
        message: error instanceof Error ? error.message : "Postgres command failed.",
      }));
      process.exit(1);
    } finally {
      if (pool) {
        await pool.end();
      }
      if (sql) {
        await sql.end({ timeout: 1 });
      }
    }
  `;

  const encoded = Buffer.from(
    JSON.stringify({
      connectionString: process.env.DATABASE_URL,
      sslMode: process.env.POSTGRES_SSL === "false" ? "prefer" : "require",
      ...payload,
    }),
    "utf8",
  ).toString("base64");

  const result = spawnSync(process.execPath, ["--input-type=module", "-e", script], {
    env: {
      ...process.env,
      NIMBUS_PG_PAYLOAD: encoded,
    },
    encoding: "utf8",
  });

  if (result.status !== 0) {
    const message =
      result.stderr?.trim()
        ? (() => {
            try {
              return JSON.parse(result.stderr).message as string;
            } catch {
              return result.stderr.trim();
            }
          })()
        : "Postgres command failed.";
    throw new Error(message);
  }

  if (!result.stdout.trim()) {
    return null as T;
  }

  return JSON.parse(result.stdout) as T;
}

function ensurePostgresReadySync() {
  const globalWithDb = globalThis as GlobalWithDb;

  if (globalWithDb.__vaultPgCompatReady) {
    return;
  }

  try {
    runPostgresSyncCommand({
      kind: "exec",
      query: schemaSql,
    });
    runPostgresSyncCommand({
      kind: "exec",
      query: `
        ALTER TABLE hidden_google_accounts ALTER COLUMN total_bytes TYPE BIGINT;
        ALTER TABLE hidden_google_accounts ALTER COLUMN used_bytes TYPE BIGINT;
        ALTER TABLE vault_items ALTER COLUMN bytes TYPE BIGINT;
      `,
    });

    const bootstrapAdmin = getBootstrapAdminConfig();
    const existingAdmin = runPostgresSyncCommand<{ rows: Array<{ id: string }> }>({
      kind: "query",
      query: "SELECT id FROM users WHERE username = $1 LIMIT 1",
      params: [bootstrapAdmin.username],
    });

    if (!existingAdmin?.rows?.length) {
      const now = new Date().toISOString();
      const adminPasswordHash = bcrypt.hashSync(bootstrapAdmin.password, 10);
      runPostgresSyncCommand({
        kind: "query",
        query: `
          INSERT INTO users (id, username, email, password_hash, full_name, avatar, role_label, is_admin, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `,
        params: [
          randomUUID(),
          bootstrapAdmin.username,
          bootstrapAdmin.email,
          adminPasswordHash,
          bootstrapAdmin.fullName,
          bootstrapAdmin.avatar,
          bootstrapAdmin.roleLabel,
          1,
          now,
        ],
      });
    }

    if (shouldSeedDemoData()) {
      const existingUser = runPostgresSyncCommand<{ rows: Array<{ id: string }> }>({
        kind: "query",
        query: "SELECT id FROM users WHERE username = $1 LIMIT 1",
        params: ["amber"],
      });

      if (!existingUser?.rows?.length) {
        const now = new Date().toISOString();
        const passwordHash = bcrypt.hashSync("vault123", 10);
        runPostgresSyncCommand({
          kind: "query",
          query: `
            INSERT INTO users (id, username, email, password_hash, full_name, avatar, role_label, is_admin, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          `,
          params: [
            randomUUID(),
            "amber",
            "amber@nimbus.local",
            passwordHash,
            "Amber Rahman",
            "AR",
            "Private Vault Member",
            0,
            now,
          ],
        });
      }
    }

    globalWithDb.__vaultPgCompatReady = true;
  } catch (error) {
    if (process.env.NODE_ENV === "production" || !allowSqliteFallback()) {
      throw error;
    }

    console.warn(
      "[Nimbus Vault] Hosted Postgres is unreachable in development. Falling back to local SQLite.",
      error instanceof Error ? error.message : error,
    );
    globalWithDb.__vaultForceSqliteFallback = true;
    getSqliteDb();
    globalWithDb.__vaultPgCompatReady = false;
    return;
  }
}

function normalizePgQuery(query: string) {
  return query.includes("?") ? toPgPlaceholders(query) : query;
}

function getNeonPool() {
  const globalWithDb = globalThis as GlobalWithDb;

  if (!globalWithDb.__vaultNeonPool) {
    neonConfig.webSocketConstructor = ws;
    globalWithDb.__vaultNeonPool = new NeonPool({
      connectionString: process.env.DATABASE_URL!,
    });
  }

  return globalWithDb.__vaultNeonPool;
}

async function runPgQuery<T>(query: string, params: unknown[] = []) {
  const normalized = normalizePgQuery(query);

  if (isNeonConnectionString()) {
    const pool = getNeonPool();
    const result = await pool.query(normalized, params as unknown[]);
    return {
      rows: result.rows as T[],
      count: result.rowCount ?? result.rows.length ?? 0,
    };
  }

  const sql = getPgClient();
  const rows = await sql.unsafe(normalized, params as never[]);
  return {
    rows: rows as unknown as T[],
    count: rows.count ?? rows.length ?? 0,
  };
}

async function runPgExec(query: string) {
  if (isNeonConnectionString()) {
    const pool = getNeonPool();
    await pool.query(query);
    return;
  }

  const sql = getPgClient();
  await sql.unsafe(query);
}

function createPostgresCompatDb(): SyncDbCompat {
  return {
    prepare(query: string) {
      const converted = toPgPlaceholders(query);
      return {
        all: (...params: unknown[]) => {
          const result = runPostgresSyncCommand<{ rows: unknown[] }>({
            kind: "query",
            query: converted,
            params,
          });
          return result?.rows ?? [];
        },
        get: (...params: unknown[]) => {
          const result = runPostgresSyncCommand<{ rows: unknown[] }>({
            kind: "query",
            query: converted,
            params,
          });
          return result?.rows?.[0];
        },
        run: (...params: unknown[]) => {
          const result = runPostgresSyncCommand<{ count: number }>({
            kind: "query",
            query: converted,
            params,
          });
          return {
            changes: result?.count ?? 0,
          };
        },
      };
    },
    exec(query: string) {
      runPostgresSyncCommand({
        kind: "exec",
        query,
      });
    },
  };
}

function createSqliteDatabase() {
  fs.mkdirSync(dataDir, { recursive: true });

  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(schemaSql);
  ensureSqliteColumn(db, "users", "is_admin", "INTEGER NOT NULL DEFAULT 0");
  ensureSqliteColumn(db, "hidden_google_accounts", "login_password_json", "TEXT");
  ensureSqliteColumn(db, "vault_items", "source_account_id", "TEXT");
  ensureSqliteColumn(db, "sync_runs", "account_id", "TEXT");
  ensureSqliteColumn(db, "sync_runs", "item_count", "INTEGER NOT NULL DEFAULT 0");
  seedSqliteDatabase(db);
  return db;
}

function ensureSqliteColumn(db: DatabaseSync, table: string, column: string, definition: string) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  const exists = columns.some((entry) => entry.name === column);

  if (!exists) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

async function ensurePgColumn(sql: Sql, table: string, column: string, definition: string) {
  const exists = await runPgQuery<{ exists: number }>(
    `
      SELECT 1 AS exists
      FROM information_schema.columns
      WHERE table_name = $1 AND column_name = $2
      LIMIT 1
    `,
    [table, column],
  );

  if (exists.rows.length === 0) {
    await runPgExec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

async function ensurePgColumnType(
  table: string,
  column: string,
  dataType: string,
  usingExpression?: string,
) {
  const existing = await runPgQuery<{ data_type: string }>(
    `
      SELECT data_type
      FROM information_schema.columns
      WHERE table_name = $1 AND column_name = $2
      LIMIT 1
    `,
    [table, column],
  );

  const currentType = existing.rows[0]?.data_type?.toLowerCase();
  if (!currentType || currentType === dataType.toLowerCase()) {
    return;
  }

  const usingClause = usingExpression ? ` USING ${usingExpression}` : "";
  await runPgExec(`ALTER TABLE ${table} ALTER COLUMN ${column} TYPE ${dataType}${usingClause}`);
}

function seedSqliteDatabase(db: DatabaseSync) {
  const bootstrapAdmin = getBootstrapAdminConfig();
  const existingAdmin = db
    .prepare("SELECT id FROM users WHERE username = ?")
    .get(bootstrapAdmin.username) as { id: string } | undefined;

  if (!existingAdmin) {
    const now = new Date().toISOString();
    const adminId = randomUUID();
    const adminPasswordHash = bcrypt.hashSync(bootstrapAdmin.password, 10);

    db.prepare(
      `
        INSERT INTO users (id, username, email, password_hash, full_name, avatar, role_label, is_admin, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    ).run(
      adminId,
      bootstrapAdmin.username,
      bootstrapAdmin.email,
      adminPasswordHash,
      bootstrapAdmin.fullName,
      bootstrapAdmin.avatar,
      bootstrapAdmin.roleLabel,
      1,
      now,
    );
  }

  if (!shouldSeedDemoData()) {
    return;
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
}

async function seedPostgresDatabase(sql: Sql) {
  const bootstrapAdmin = getBootstrapAdminConfig();
  const existingAdmin = await runPgQuery<{ id: string }>(
    `
      SELECT id
      FROM users
      WHERE username = $1
      LIMIT 1
    `,
    [bootstrapAdmin.username],
  );

  if (existingAdmin.rows.length === 0) {
    const now = new Date().toISOString();
    const adminPasswordHash = bcrypt.hashSync(bootstrapAdmin.password, 10);
    await runPgQuery(
      `
        INSERT INTO users (id, username, email, password_hash, full_name, avatar, role_label, is_admin, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `,
      [
        randomUUID(),
        bootstrapAdmin.username,
        bootstrapAdmin.email,
        adminPasswordHash,
        bootstrapAdmin.fullName,
        bootstrapAdmin.avatar,
        bootstrapAdmin.roleLabel,
        1,
        now,
      ],
    );
  }

  if (!shouldSeedDemoData()) {
    return;
  }

  const existingUser = await runPgQuery<{ id: string }>(
    `
      SELECT id
      FROM users
      WHERE username = $1
      LIMIT 1
    `,
    ["amber"],
  );

  if (existingUser.rows.length === 0) {
    const now = new Date().toISOString();
    const passwordHash = bcrypt.hashSync("vault123", 10);
    await runPgQuery(
      `
        INSERT INTO users (id, username, email, password_hash, full_name, avatar, role_label, is_admin, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `,
      [
        randomUUID(),
        "amber",
        "amber@nimbus.local",
        passwordHash,
        "Amber Rahman",
        "AR",
        "Private Vault Member",
        0,
        now,
      ],
    );
  }
}

async function ensurePostgresReady(sql: Sql) {
  await runPgExec(schemaSql);
  await ensurePgColumn(sql, "users", "is_admin", "INTEGER NOT NULL DEFAULT 0");
  await ensurePgColumn(sql, "hidden_google_accounts", "login_password_json", "TEXT");
  await ensurePgColumn(sql, "vault_items", "source_account_id", "TEXT");
  await ensurePgColumn(sql, "sync_runs", "account_id", "TEXT");
  await ensurePgColumn(sql, "sync_runs", "item_count", "INTEGER NOT NULL DEFAULT 0");
  await ensurePgColumnType("hidden_google_accounts", "total_bytes", "bigint", "total_bytes::bigint");
  await ensurePgColumnType("hidden_google_accounts", "used_bytes", "bigint", "used_bytes::bigint");
  await ensurePgColumnType("vault_items", "bytes", "bigint", "bytes::bigint");
  await seedPostgresDatabase(sql);
}

function getSqliteDb() {
  const globalWithDb = globalThis as GlobalWithDb;

  if (!globalWithDb.__vaultDb) {
    globalWithDb.__vaultDb = createSqliteDatabase();
  }

  return globalWithDb.__vaultDb;
}

function getPgClient() {
  const globalWithDb = globalThis as GlobalWithDb;

  if (!globalWithDb.__vaultPg) {
    globalWithDb.__vaultPg = postgres(process.env.DATABASE_URL!, {
      ssl: process.env.POSTGRES_SSL === "false" ? "prefer" : "require",
      max: 5,
      idle_timeout: 20,
      connect_timeout: 20,
    });
  }

  return globalWithDb.__vaultPg;
}

export async function initDb() {
  const globalWithDb = globalThis as GlobalWithDb;

  if (!globalWithDb.__vaultInitPromise) {
    globalWithDb.__vaultInitPromise = (async () => {
      if (shouldUsePostgres()) {
        try {
          await ensurePostgresReady(getPgClient());
        } catch (error) {
          if (process.env.NODE_ENV === "production" || !allowSqliteFallback()) {
            throw error;
          }

          console.warn(
            "[Nimbus Vault] Hosted Postgres is unreachable in development. Falling back to local SQLite.",
            error instanceof Error ? error.message : error,
          );
          globalWithDb.__vaultForceSqliteFallback = true;
          getSqliteDb();
          return;
        }
      } else {
        getSqliteDb();
      }
    })();
  }

  await globalWithDb.__vaultInitPromise;
}

export async function dbAll<T>(query: string, params: unknown[] = []) {
  await initDb();

  if (shouldUsePostgres()) {
    const result = await runPgQuery<T>(query, params);
    return result.rows;
  }

  const db = getSqliteDb();
  return db.prepare(query).all(...params) as T[];
}

export async function dbGet<T>(query: string, params: unknown[] = []) {
  const rows = await dbAll<T>(query, params);
  return rows[0] ?? null;
}

export async function dbRun(query: string, params: unknown[] = []) {
  await initDb();

  if (shouldUsePostgres()) {
    const result = await runPgQuery(query, params);
    return { changes: result.count };
  }

  const db = getSqliteDb();
  const result = db.prepare(query).run(...params) as { changes?: number };
  return { changes: result.changes ?? 0 };
}

export async function dbExec(query: string) {
  await initDb();

  if (shouldUsePostgres()) {
    await runPgExec(query);
    return;
  }

  const db = getSqliteDb();
  db.exec(query);
}

export function getDb() {
  if (shouldUsePostgres()) {
    ensurePostgresReadySync();
    if (shouldUsePostgres()) {
      return createPostgresCompatDb();
    }
  }

  return getSqliteDb();
}

export function getDatabaseRuntimeStatus(): DatabaseRuntimeStatus {
  const globalWithDb = globalThis as GlobalWithDb;

  if (isPostgresMode() && globalWithDb.__vaultForceSqliteFallback) {
    return {
      label: "SQLite Fallback",
      tone: "warning",
    };
  }

  if (isPostgresMode()) {
    return {
      label: "Neon Postgres",
      tone: "stable",
    };
  }

  return {
    label: "Local SQLite",
    tone: "warning",
  };
}
