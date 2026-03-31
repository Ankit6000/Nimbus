import bcrypt from "bcryptjs";
import fs from "node:fs";
import { createCipheriv, createDecipheriv, randomBytes, randomUUID, scryptSync } from "node:crypto";
import { dbAll, dbGet, dbRun, getDb } from "@/lib/db";
import {
  AdminManagedMember,
  AdminAuditEntry,
  DriveItem,
  HiddenAccountSyncSummary,
  MailItem,
  MessageItem,
  NoteItem,
  PasswordItem,
  PhotoItem,
  PortalUser,
  UploadHistoryEntry,
} from "@/lib/data";
import {
  isArchiveLikeFile,
  isImageLikeFile,
  isSheetLikeFile,
  isVideoLikeFile,
} from "@/lib/file-types";
import { deleteBinaryFile, storeBinaryFile } from "@/lib/storage";

type UserRow = {
  id: string;
  username: string;
  email: string;
  password_hash: string;
  full_name: string;
  avatar: string;
  role_label: string;
  is_admin: number;
  created_at: string;
};

type AccountRow = {
  id: string;
  total_bytes: number;
  used_bytes: number;
  kind: string;
};

type ItemRow = {
  id: string;
  section: string;
  title: string;
  subtitle: string | null;
  bytes: number;
  item_kind: string | null;
  source: string | null;
  source_account_id: string | null;
  occurred_at: string;
  unread: number;
  meta_json: string | null;
};

export type VaultItemRecord = {
  id: string;
  section: string;
  title: string;
  subtitle: string | null;
  bytes: number;
  itemKind: string | null;
  source: string | null;
  sourceAccountId: string | null;
  occurredAt: string;
  unread: boolean;
  meta: Record<string, unknown> | null;
};

export type DriveFolderRecord = {
  id: string;
  name: string;
  fullPath: string;
  parentPath: string;
  sourceAccountId: string | null;
  fileId: string | null;
};

type ConnectedGoogleUploadTarget = {
  id: string;
  user_id: string;
  account_label: string;
  google_email: string;
  refresh_token: string;
  total_bytes: number;
  used_bytes: number;
};

function parseMetaJson(value: string | null) {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function getVaultSecretKey() {
  return scryptSync(process.env.VAULT_DATA_SECRET || "local-dev-vault-secret", "vault-salt", 32);
}

function encryptVaultSecret(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getVaultSecretKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    iv: iv.toString("base64"),
    content: encrypted.toString("base64"),
    tag: tag.toString("base64"),
  };
}

function decryptVaultSecret(payload: Record<string, unknown> | null) {
  if (
    !payload ||
    typeof payload.iv !== "string" ||
    typeof payload.content !== "string" ||
    typeof payload.tag !== "string"
  ) {
    return null;
  }

  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      getVaultSecretKey(),
      Buffer.from(payload.iv, "base64"),
    );
    decipher.setAuthTag(Buffer.from(payload.tag, "base64"));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(payload.content, "base64")),
      decipher.final(),
    ]);
    return decrypted.toString("utf8");
  } catch {
    return null;
  }
}

function mapVaultItemRow(row: ItemRow): VaultItemRecord {
  return {
    id: row.id,
    section: row.section,
    title: row.title,
    subtitle: row.subtitle,
    bytes: Number(row.bytes),
    itemKind: row.item_kind,
    source: row.source,
    sourceAccountId: row.source_account_id,
    occurredAt: row.occurred_at,
    unread: Boolean(row.unread),
    meta: parseMetaJson(row.meta_json),
  };
}

export async function authenticateUser(identifier: string, password: string) {
  const user = (await dbGet<UserRow>(
    `
      SELECT *
      FROM users
      WHERE lower(username) = lower(?) OR lower(email) = lower(?)
      LIMIT 1
    `,
    [identifier, identifier],
  )) ?? undefined;

  if (!user) {
    return null;
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return null;
  }

  return {
    id: user.id,
    username: user.username,
    email: user.email,
    isAdmin: Boolean(user.is_admin),
  };
}

export function getUserAuthRecord(userId: string) {
  const db = getDb();
  return db.prepare("SELECT * FROM users WHERE id = ? LIMIT 1").get(userId) as UserRow | undefined;
}

export async function getUserAuthRecordAsync(userId: string) {
  return ((await dbGet<UserRow>("SELECT * FROM users WHERE id = ? LIMIT 1", [userId])) ??
    undefined) as UserRow | undefined;
}

export async function getPortalUserByIdAsync(userId: string): Promise<PortalUser | null> {
  const user = await getUserAuthRecordAsync(userId);

  if (!user || user.is_admin) {
    return null;
  }

  const [accounts, icloud, appleAccounts, items] = await Promise.all([
    dbAll<AccountRow>(
      `
        SELECT id, total_bytes, used_bytes, kind
        FROM hidden_google_accounts
        WHERE user_id = ?
        ORDER BY created_at ASC
      `,
      [userId],
    ),
    dbGet<{
      connected: number;
      last_sync: string | null;
      pending_items: number;
    }>(
      `
        SELECT connected, last_sync, pending_items
        FROM icloud_connections
        WHERE user_id = ?
      `,
      [userId],
    ),
    dbAll<{
      id: string;
      label: string;
      apple_email: string;
      status: string;
      last_sync: string | null;
    }>(
      `
        SELECT id, label, apple_email, status, last_sync
        FROM apple_accounts
        WHERE user_id = ?
        ORDER BY created_at ASC
      `,
      [userId],
    ),
    dbAll<ItemRow>(
      `
        SELECT id, section, title, subtitle, bytes, item_kind, source, source_account_id, occurred_at, unread, meta_json
        FROM vault_items
        WHERE user_id = ?
        ORDER BY occurred_at DESC
      `,
      [userId],
    ),
  ]);

  return {
    id: user.id,
    username: user.username,
    email: user.email,
    fullName: user.full_name,
    avatar: user.avatar,
    roleLabel: user.role_label,
    assignedChannels: accounts.length,
    managedPools: accounts.map((account) => ({
      id: account.id,
      totalBytes: Number(account.total_bytes),
      usedBytes: Number(account.used_bytes),
      kind: "google" as const,
    })),
    icloud: {
      lastSync: icloud?.last_sync ?? null,
      newItemsWaiting: Number(icloud?.pending_items ?? 0),
      accounts: appleAccounts.map((account) => ({
        id: account.id,
        label: account.label,
        appleEmail: account.apple_email,
        status: account.status,
        lastSync: account.last_sync,
      })),
    },
    sections: {
      photos: items
        .filter((item) => item.section === "photos")
        .map<PhotoItem>((item) => ({
          id: item.id,
          name: item.title,
          size: Number(item.bytes),
          kind: item.item_kind === "video" ? "video" : "image",
          takenAt: item.occurred_at,
          source: item.source ?? "import",
        })),
      videos: items
        .filter((item) => item.section === "videos")
        .map<PhotoItem>((item) => ({
          id: item.id,
          name: item.title,
          size: Number(item.bytes),
          kind: "video",
          takenAt: item.occurred_at,
          source: item.source ?? "import",
        })),
      drive: items
        .filter((item) => item.section === "drive")
        .map<DriveItem>((item) => ({
          id: item.id,
          name: item.title,
          size: Number(item.bytes),
          type:
            item.item_kind === "archive" ||
            item.item_kind === "document" ||
            item.item_kind === "folder" ||
            item.item_kind === "sheet" ||
            item.item_kind === "image" ||
            item.item_kind === "video"
              ? item.item_kind
              : "document",
          updatedAt: item.occurred_at,
        })),
      passwords: items
        .filter((item) => item.section === "passwords")
        .map<PasswordItem>((item) => ({
          id: item.id,
          label: item.title,
          username: item.subtitle ?? "",
          updatedAt: item.occurred_at,
          encryptedBytes: Number(item.bytes),
        })),
      notes: items
        .filter((item) => item.section === "notes")
        .map<NoteItem>((item) => ({
          id: item.id,
          title: item.title,
          preview: item.subtitle ?? "",
          updatedAt: item.occurred_at,
          size: Number(item.bytes),
        })),
      messages: items
        .filter((item) => item.section === "messages")
        .map<MessageItem>((item) => ({
          id: item.id,
          contact: item.title,
          channel: item.subtitle ?? "",
          updatedAt: item.occurred_at,
          size: Number(item.bytes),
        })),
      mail: items
        .filter((item) => item.section === "mail")
        .map<MailItem>((item) => ({
          id: item.id,
          subject: item.title,
          from: item.subtitle ?? "",
          receivedAt: item.occurred_at,
          size: Number(item.bytes),
          unread: Boolean(item.unread),
        })),
    },
  };
}

export async function getAdminByIdAsync(userId: string) {
  const user = await getUserAuthRecordAsync(userId);
  if (!user || !user.is_admin) {
    return null;
  }

  return {
    id: user.id,
    username: user.username,
    email: user.email,
    fullName: user.full_name,
    avatar: user.avatar,
    roleLabel: user.role_label,
  };
}

export function getPortalUserById(userId: string): PortalUser | null {
  const db = getDb();
  const user = getUserAuthRecord(userId);

  if (!user) {
    return null;
  }

  if (user.is_admin) {
    return null;
  }

  const accounts = db
    .prepare(
      `
        SELECT id, total_bytes, used_bytes, kind
        FROM hidden_google_accounts
        WHERE user_id = ?
        ORDER BY created_at ASC
      `,
    )
    .all(userId) as AccountRow[];

  const icloud = db
    .prepare(
      `
        SELECT connected, last_sync, pending_items
        FROM icloud_connections
        WHERE user_id = ?
      `,
    )
    .get(userId) as
    | {
        connected: number;
        last_sync: string | null;
        pending_items: number;
      }
    | undefined;
  const appleAccounts = db
    .prepare(
      `
        SELECT id, label, apple_email, status, last_sync
        FROM apple_accounts
        WHERE user_id = ?
        ORDER BY created_at ASC
      `,
    )
    .all(userId) as Array<{
    id: string;
    label: string;
    apple_email: string;
    status: string;
    last_sync: string | null;
  }>;

  const items = db
    .prepare(
      `
        SELECT id, section, title, subtitle, bytes, item_kind, source, source_account_id, occurred_at, unread, meta_json
        FROM vault_items
        WHERE user_id = ?
        ORDER BY occurred_at DESC
      `,
    )
    .all(userId) as ItemRow[];

  return {
    id: user.id,
    username: user.username,
    email: user.email,
    fullName: user.full_name,
    avatar: user.avatar,
    roleLabel: user.role_label,
    assignedChannels: accounts.length,
    managedPools: accounts.map((account) => ({
      id: account.id,
      totalBytes: Number(account.total_bytes),
      usedBytes: Number(account.used_bytes),
      kind: "google",
    })),
    icloud: {
      lastSync: icloud?.last_sync ?? null,
      newItemsWaiting: Number(icloud?.pending_items ?? 0),
      accounts: appleAccounts.map((account) => ({
        id: account.id,
        label: account.label,
        appleEmail: account.apple_email,
        status: account.status,
        lastSync: account.last_sync,
      })),
    },
    sections: {
      photos: items
        .filter((item) => item.section === "photos")
        .map<PhotoItem>((item) => ({
          id: item.id,
          name: item.title,
          size: Number(item.bytes),
          kind: item.item_kind === "video" ? "video" : "image",
          takenAt: item.occurred_at,
          source: item.source ?? "import",
        })),
      videos: items
        .filter((item) => item.section === "videos")
        .map<PhotoItem>((item) => ({
          id: item.id,
          name: item.title,
          size: Number(item.bytes),
          kind: "video",
          takenAt: item.occurred_at,
          source: item.source ?? "import",
        })),
      drive: items
        .filter((item) => item.section === "drive")
        .map<DriveItem>((item) => ({
          id: item.id,
          name: item.title,
          size: Number(item.bytes),
          type:
            item.item_kind === "archive" ||
            item.item_kind === "document" ||
            item.item_kind === "folder" ||
            item.item_kind === "sheet" ||
            item.item_kind === "image" ||
            item.item_kind === "video"
              ? item.item_kind
              : "document",
          updatedAt: item.occurred_at,
        })),
      passwords: items
        .filter((item) => item.section === "passwords")
        .map<PasswordItem>((item) => ({
          id: item.id,
          label: item.title,
          username: item.subtitle ?? "",
          updatedAt: item.occurred_at,
          encryptedBytes: Number(item.bytes),
        })),
      notes: items
        .filter((item) => item.section === "notes")
        .map<NoteItem>((item) => ({
          id: item.id,
          title: item.title,
          preview: item.subtitle ?? "",
          updatedAt: item.occurred_at,
          size: Number(item.bytes),
        })),
      messages: items
        .filter((item) => item.section === "messages")
        .map<MessageItem>((item) => ({
          id: item.id,
          contact: item.title,
          channel: item.subtitle ?? "",
          updatedAt: item.occurred_at,
          size: Number(item.bytes),
        })),
      mail: items
        .filter((item) => item.section === "mail")
        .map<MailItem>((item) => ({
          id: item.id,
          subject: item.title,
          from: item.subtitle ?? "",
          receivedAt: item.occurred_at,
          size: Number(item.bytes),
          unread: Boolean(item.unread),
        })),
    },
  };
}

export function getAdminById(userId: string) {
  const user = getUserAuthRecord(userId);
  if (!user || !user.is_admin) {
    return null;
  }

  return {
    id: user.id,
    username: user.username,
    email: user.email,
    fullName: user.full_name,
    avatar: user.avatar,
    roleLabel: user.role_label,
  };
}

export function listGoogleAccountsForUser(userId: string) {
  const db = getDb();
  return db
    .prepare(
      `
        SELECT id, google_email, refresh_token, scopes, kind, status
        FROM hidden_google_accounts
        WHERE user_id = ?
        ORDER BY created_at ASC
      `,
    )
    .all(userId) as Array<{
    id: string;
    google_email: string;
    refresh_token: string | null;
    scopes: string | null;
    kind: string;
    status: string;
  }>;
}

export async function listGoogleAccountsForUserAsync(userId: string) {
  return dbAll<{
    id: string;
    google_email: string;
    refresh_token: string | null;
    scopes: string | null;
    kind: string;
    status: string;
  }>(
    `
      SELECT id, google_email, refresh_token, scopes, kind, status
      FROM hidden_google_accounts
      WHERE user_id = ?
      ORDER BY created_at ASC
    `,
    [userId],
  );
}

export function getHiddenGoogleAccountAssignment(userId: string, label: string) {
  const db = getDb();
  return db
    .prepare(
      `
        SELECT id, account_label, google_email, refresh_token, scopes, status
        FROM hidden_google_accounts
        WHERE user_id = ? AND account_label = ?
        LIMIT 1
      `,
    )
    .get(userId, label) as
    | {
        id: string;
        account_label: string;
        google_email: string;
        refresh_token: string | null;
        scopes: string | null;
        status: string;
      }
    | undefined;
}

export async function getHiddenGoogleAccountAssignmentAsync(userId: string, label: string) {
  return ((await dbGet<{
    id: string;
    account_label: string;
    google_email: string;
    refresh_token: string | null;
    scopes: string | null;
    status: string;
  }>(
    `
      SELECT id, account_label, google_email, refresh_token, scopes, status
      FROM hidden_google_accounts
      WHERE user_id = ? AND account_label = ?
      LIMIT 1
    `,
    [userId, label],
  )) ?? undefined) as
    | {
        id: string;
        account_label: string;
        google_email: string;
        refresh_token: string | null;
        scopes: string | null;
        status: string;
      }
    | undefined;
}

export function listGoogleAssignmentsDetailed(userId?: string) {
  const db = getDb();
  const query = userId
    ? `
      SELECT h.id, h.account_label, h.google_email, h.kind, h.status, h.scopes, h.refresh_token, h.last_synced_at,
             u.id as user_id, u.username, u.full_name
      FROM hidden_google_accounts h
      INNER JOIN users u ON u.id = h.user_id
      WHERE u.is_admin = 0 AND u.id = ?
      ORDER BY u.full_name ASC, h.created_at ASC
    `
    : `
      SELECT h.id, h.account_label, h.google_email, h.kind, h.status, h.scopes, h.refresh_token, h.last_synced_at,
             u.id as user_id, u.username, u.full_name
      FROM hidden_google_accounts h
      INNER JOIN users u ON u.id = h.user_id
      WHERE u.is_admin = 0
      ORDER BY u.full_name ASC, h.created_at ASC
    `;

  return (userId ? db.prepare(query).all(userId) : db.prepare(query).all()) as Array<{
    id: string;
    account_label: string;
    google_email: string;
    kind: string;
    status: string;
    scopes: string | null;
    refresh_token: string | null;
    last_synced_at: string | null;
    user_id: string;
    username: string;
    full_name: string;
  }>;
}

export async function listGoogleAssignmentsDetailedAsync(userId?: string) {
  const query = userId
    ? `
      SELECT h.id, h.account_label, h.google_email, h.kind, h.status, h.scopes, h.refresh_token, h.last_synced_at,
             u.id as user_id, u.username, u.full_name
      FROM hidden_google_accounts h
      INNER JOIN users u ON u.id = h.user_id
      WHERE u.is_admin = 0 AND u.id = ?
      ORDER BY u.full_name ASC, h.created_at ASC
    `
    : `
      SELECT h.id, h.account_label, h.google_email, h.kind, h.status, h.scopes, h.refresh_token, h.last_synced_at,
             u.id as user_id, u.username, u.full_name
      FROM hidden_google_accounts h
      INNER JOIN users u ON u.id = h.user_id
      WHERE u.is_admin = 0
      ORDER BY u.full_name ASC, h.created_at ASC
    `;

  return userId
    ? dbAll<{
        id: string;
        account_label: string;
        google_email: string;
        kind: string;
        status: string;
        scopes: string | null;
        refresh_token: string | null;
        last_synced_at: string | null;
        user_id: string;
        username: string;
        full_name: string;
      }>(query, [userId])
    : dbAll<{
        id: string;
        account_label: string;
        google_email: string;
        kind: string;
        status: string;
        scopes: string | null;
        refresh_token: string | null;
        last_synced_at: string | null;
        user_id: string;
        username: string;
        full_name: string;
      }>(query);
}

export function listHiddenAccountSyncSummaries(userId: string): HiddenAccountSyncSummary[] {
  const db = getDb();
  const accounts = db
    .prepare(
      `
        SELECT id, account_label, google_email, refresh_token, last_synced_at
        FROM hidden_google_accounts
        WHERE user_id = ?
        ORDER BY created_at ASC
      `,
    )
    .all(userId) as Array<{
    id: string;
    account_label: string;
    google_email: string;
    refresh_token: string | null;
    last_synced_at: string | null;
  }>;

  const syncStmt = db.prepare(
    `
      SELECT status, message, item_count
      FROM sync_runs
      WHERE user_id = ? AND provider = 'google' AND account_id = ?
      ORDER BY started_at DESC
      LIMIT 1
    `,
  );

  return accounts.map((account) => {
    const sync = syncStmt.get(userId, account.id) as
      | {
          status: string;
          message: string | null;
          item_count: number;
        }
      | undefined;

    return {
      id: account.id,
      label: account.account_label,
      email: account.google_email,
      hasRefreshToken: Boolean(account.refresh_token),
      lastSyncedAt: account.last_synced_at,
      lastSyncStatus: sync?.status ?? null,
      lastSyncMessage: sync?.message ?? null,
      lastItemCount: Number(sync?.item_count ?? 0),
    };
  });
}

export function listManagedMembers(): AdminManagedMember[] {
  const db = getDb();
  const members = db
    .prepare(
      `
        SELECT id, username, email, full_name, avatar, role_label, created_at
        FROM users
        WHERE is_admin = 0
        ORDER BY created_at DESC
      `,
    )
    .all() as Array<{
    id: string;
    username: string;
    email: string;
    full_name: string;
    avatar: string;
    role_label: string;
    created_at: string;
  }>;

  const accountStmt = db.prepare(
    `
      SELECT id, account_label, google_email, kind, status, total_bytes, used_bytes, refresh_token, login_password_json
      FROM hidden_google_accounts
      WHERE user_id = ?
      ORDER BY created_at ASC
    `,
  );
  const appleStmt = db.prepare(
    `
      SELECT id, label, apple_email, status, last_sync
      FROM apple_accounts
      WHERE user_id = ?
      ORDER BY created_at ASC
    `,
  );

  return members.map((member) => {
    const hiddenAccounts = accountStmt.all(member.id) as Array<{
      id: string;
      account_label: string;
      google_email: string;
      kind: string;
      status: string;
      total_bytes: number;
      used_bytes: number;
      refresh_token: string | null;
      login_password_json: string | null;
    }>;
    const appleAccounts = appleStmt.all(member.id) as Array<{
      id: string;
      label: string;
      apple_email: string;
      status: string;
      last_sync: string | null;
    }>;

    return {
      id: member.id,
      username: member.username,
      email: member.email,
      fullName: member.full_name,
      avatar: member.avatar,
      roleLabel: member.role_label,
      createdAt: member.created_at,
      hiddenAccounts: hiddenAccounts.map((account) => ({
        id: account.id,
        label: account.account_label,
        email: account.google_email,
        kind: "google",
        status: account.status,
        totalBytes: Number(account.total_bytes),
        usedBytes: Number(account.used_bytes),
        hasRefreshToken: Boolean(account.refresh_token),
        savedPassword: decryptVaultSecret(parseMetaJson(account.login_password_json)),
      })),
      appleAccounts: appleAccounts.map((account) => ({
        id: account.id,
        label: account.label,
        appleEmail: account.apple_email,
        status: account.status,
        lastSync: account.last_sync,
      })),
    };
  });
}

export async function listManagedMembersAsync(): Promise<AdminManagedMember[]> {
  const members = await dbAll<{
    id: string;
    username: string;
    email: string;
    full_name: string;
    avatar: string;
    role_label: string;
    created_at: string;
  }>(
    `
      SELECT id, username, email, full_name, avatar, role_label, created_at
      FROM users
      WHERE is_admin = 0
      ORDER BY created_at DESC
    `,
  );

  return Promise.all(
    members.map(async (member) => {
      const [hiddenAccounts, appleAccounts] = await Promise.all([
        dbAll<{
          id: string;
          account_label: string;
          google_email: string;
          kind: string;
          status: string;
          total_bytes: number;
          used_bytes: number;
          refresh_token: string | null;
          login_password_json: string | null;
        }>(
          `
            SELECT id, account_label, google_email, kind, status, total_bytes, used_bytes, refresh_token, login_password_json
            FROM hidden_google_accounts
            WHERE user_id = ?
            ORDER BY created_at ASC
          `,
          [member.id],
        ),
        dbAll<{
          id: string;
          label: string;
          apple_email: string;
          status: string;
          last_sync: string | null;
        }>(
          `
            SELECT id, label, apple_email, status, last_sync
            FROM apple_accounts
            WHERE user_id = ?
            ORDER BY created_at ASC
          `,
          [member.id],
        ),
      ]);

      return {
        id: member.id,
        username: member.username,
        email: member.email,
        fullName: member.full_name,
        avatar: member.avatar,
        roleLabel: member.role_label,
        createdAt: member.created_at,
        hiddenAccounts: hiddenAccounts.map((account) => ({
          id: account.id,
          label: account.account_label,
          email: account.google_email,
          kind: "google" as const,
          status: account.status,
          totalBytes: Number(account.total_bytes),
          usedBytes: Number(account.used_bytes),
          hasRefreshToken: Boolean(account.refresh_token),
          savedPassword: decryptVaultSecret(parseMetaJson(account.login_password_json)),
        })),
        appleAccounts: appleAccounts.map((account) => ({
          id: account.id,
          label: account.label,
          appleEmail: account.apple_email,
          status: account.status,
          lastSync: account.last_sync,
        })),
      };
    }),
  );
}

export function listUploadHistory(userId: string): UploadHistoryEntry[] {
  const db = getDb();
  return db
    .prepare(
      `
        SELECT id, title, source, bytes AS size, occurred_at AS occurredAt, section
        FROM vault_items
        WHERE user_id = ?
          AND section IN ('photos', 'videos', 'drive')
          AND item_kind != 'folder'
        ORDER BY occurred_at DESC
        LIMIT 12
      `,
    )
    .all(userId) as UploadHistoryEntry[];
}

export function listFullUploadHistory(userId: string): UploadHistoryEntry[] {
  const db = getDb();
  return db
    .prepare(
      `
        SELECT id, title, source, bytes AS size, occurred_at AS occurredAt, section
        FROM vault_items
        WHERE user_id = ?
          AND section IN ('photos', 'videos', 'drive')
          AND item_kind != 'folder'
        ORDER BY occurred_at DESC
      `,
    )
    .all(userId) as UploadHistoryEntry[];
}

export async function listFullUploadHistoryAsync(userId: string): Promise<UploadHistoryEntry[]> {
  return dbAll<UploadHistoryEntry>(
    `
      SELECT id, title, source, bytes AS size, occurred_at AS occurredAt, section
      FROM vault_items
      WHERE user_id = ?
        AND section IN ('photos', 'videos', 'drive')
        AND item_kind != 'folder'
      ORDER BY occurred_at DESC
    `,
    [userId],
  );
}

export function listVaultItemsBySection(userId: string, section: string) {
  const db = getDb();
  return db
    .prepare(
      `
        SELECT id, section, title, subtitle, bytes, item_kind, source, source_account_id, occurred_at, unread, meta_json
        FROM vault_items
        WHERE user_id = ? AND section = ?
        ORDER BY occurred_at DESC
      `,
    )
    .all(userId, section)
    .map((row) => mapVaultItemRow(row as ItemRow));
}

export async function listVaultItemsBySectionAsync(userId: string, section: string) {
  const rows = await dbAll<ItemRow>(
    `
      SELECT id, section, title, subtitle, bytes, item_kind, source, source_account_id, occurred_at, unread, meta_json
      FROM vault_items
      WHERE user_id = ? AND section = ?
      ORDER BY occurred_at DESC
    `,
    [userId, section],
  );

  return rows.map((row) => mapVaultItemRow(row));
}

export function listDriveFoldersAtPath(userId: string, folderPath: string) {
  const db = getDb();
  const rows = db
    .prepare(
      `
        SELECT id, source_account_id, meta_json
        FROM vault_items
        WHERE user_id = ? AND section = 'drive' AND item_kind = 'folder'
        ORDER BY lower(title) ASC, title ASC
      `,
    )
    .all(userId) as Array<{
    id: string;
    source_account_id: string | null;
    meta_json: string | null;
  }>;

  return rows
    .map((row) => {
      const meta = parseMetaJson(row.meta_json);
      const fullPath = typeof meta?.fullPath === "string" ? meta.fullPath : "";
      const parentPath = typeof meta?.folderPath === "string" ? meta.folderPath : "";
      const parts = fullPath.split("/").filter(Boolean);
      return {
        id: row.id,
        name: parts.at(-1) ?? fullPath,
        fullPath,
        parentPath,
        sourceAccountId: row.source_account_id,
        fileId: typeof meta?.fileId === "string" ? meta.fileId : null,
      } satisfies DriveFolderRecord;
    })
    .filter((folder) => folder.parentPath === folderPath);
}

export async function listDriveFoldersAtPathAsync(userId: string, folderPath: string) {
  const rows = await dbAll<{
    id: string;
    source_account_id: string | null;
    meta_json: string | null;
  }>(
    `
      SELECT id, source_account_id, meta_json
      FROM vault_items
      WHERE user_id = ? AND section = 'drive' AND item_kind = 'folder'
      ORDER BY lower(title) ASC, title ASC
    `,
    [userId],
  );

  return rows
    .map((row) => {
      const meta = parseMetaJson(row.meta_json);
      const fullPath = typeof meta?.fullPath === "string" ? meta.fullPath : "";
      const parentPath = typeof meta?.folderPath === "string" ? meta.folderPath : "";
      const parts = fullPath.split("/").filter(Boolean);
      return {
        id: row.id,
        name: parts.at(-1) ?? fullPath,
        fullPath,
        parentPath,
        sourceAccountId: row.source_account_id,
        fileId: typeof meta?.fileId === "string" ? meta.fileId : null,
      } satisfies DriveFolderRecord;
    })
    .filter((folder) => folder.parentPath === folderPath);
}

export function listDriveFilesAtPath(userId: string, folderPath: string) {
  return listVaultItemsBySection(userId, "drive").filter((item) => {
    if (item.itemKind === "folder") {
      return false;
    }

    const itemFolderPath =
      typeof item.meta?.folderPath === "string" ? item.meta.folderPath : "";
    return itemFolderPath === folderPath;
  });
}

export async function listDriveFilesAtPathAsync(userId: string, folderPath: string) {
  const items = await listVaultItemsBySectionAsync(userId, "drive");
  return items.filter((item) => {
    if (item.itemKind === "folder") {
      return false;
    }

    const itemFolderPath =
      typeof item.meta?.folderPath === "string" ? item.meta.folderPath : "";
    return itemFolderPath === folderPath;
  });
}

export function getVaultItemById(userId: string, itemId: string) {
  const db = getDb();
  const row = db
    .prepare(
      `
        SELECT id, section, title, subtitle, bytes, item_kind, source, source_account_id, occurred_at, unread, meta_json
        FROM vault_items
        WHERE user_id = ? AND id = ?
        LIMIT 1
      `,
    )
    .get(userId, itemId) as ItemRow | undefined;

  return row ? mapVaultItemRow(row) : null;
}

export async function getVaultItemByIdAsync(userId: string, itemId: string) {
  const row = (await dbGet<ItemRow>(
    `
      SELECT id, section, title, subtitle, bytes, item_kind, source, source_account_id, occurred_at, unread, meta_json
      FROM vault_items
      WHERE user_id = ? AND id = ?
      LIMIT 1
    `,
    [userId, itemId],
  )) as ItemRow | null;

  return row ? mapVaultItemRow(row) : null;
}

export function deleteVaultItemAndRelated(userId: string, itemId: string) {
  const db = getDb();
  const target = getVaultItemById(userId, itemId);

  if (!target) {
    return null;
  }

  const relatedIds = new Set<string>([itemId]);
  const targetFileId = typeof target.meta?.fileId === "string" ? target.meta.fileId : null;

  if (
    targetFileId &&
    target.sourceAccountId &&
    (target.section === "drive" || target.section === "photos" || target.section === "videos")
  ) {
    const rows = db
      .prepare(
        `
          SELECT id, meta_json
          FROM vault_items
          WHERE user_id = ?
            AND source_account_id = ?
            AND section IN ('drive', 'photos', 'videos')
        `,
      )
      .all(userId, target.sourceAccountId) as Array<{ id: string; meta_json: string | null }>;

    for (const row of rows) {
      const meta = parseMetaJson(row.meta_json);
      if (typeof meta?.fileId === "string" && meta.fileId === targetFileId) {
        relatedIds.add(row.id);
      }
    }
  }

  for (const id of relatedIds) {
    const item = getVaultItemById(userId, id);
    if (typeof item?.meta?.storedObjectKey === "string") {
      void deleteBinaryFile(item.meta.storedObjectKey).catch(() => null);
    }
    if (typeof item?.meta?.storedPath === "string" && fs.existsSync(item.meta.storedPath)) {
      fs.unlinkSync(item.meta.storedPath);
    }
  }

  const deleteStmt = db.prepare("DELETE FROM vault_items WHERE user_id = ? AND id = ?");
  for (const id of relatedIds) {
    deleteStmt.run(userId, id);
  }

  return {
    target,
    deletedIds: Array.from(relatedIds),
  };
}

export function upsertVaultNote(input: {
  userId: string;
  itemId?: string;
  title: string;
  content: string;
  bytes?: number;
  itemKind?: string;
  source?: string;
  sourceAccountId?: string | null;
  subtitle?: string | null;
  meta?: Record<string, unknown>;
}) {
  const db = getDb();
  const now = new Date().toISOString();
  const preview = input.subtitle ?? input.content.slice(0, 180);
  const bytes = input.bytes ?? Buffer.byteLength(input.content, "utf8");
  const itemKind = input.itemKind ?? "note";
  const source = input.source ?? "vault-note";
  const sourceAccountId = input.sourceAccountId ?? null;
  const meta = JSON.stringify({ content: input.content, ...(input.meta ?? {}) });

  if (input.itemId) {
    db.prepare(
      `
        UPDATE vault_items
        SET title = ?, subtitle = ?, bytes = ?, item_kind = ?, source = ?, source_account_id = ?, occurred_at = ?, meta_json = ?
        WHERE id = ? AND user_id = ? AND section = 'notes'
      `,
    ).run(input.title, preview, bytes, itemKind, source, sourceAccountId, now, meta, input.itemId, input.userId);
    return input.itemId;
  }

  const id = randomUUID();
  db.prepare(
    `
      INSERT INTO vault_items
      (id, user_id, section, title, subtitle, bytes, item_kind, source, source_account_id, occurred_at, unread, meta_json)
      VALUES (?, ?, 'notes', ?, ?, ?, ?, ?, ?, ?, 0, ?)
    `,
  ).run(id, input.userId, input.title, preview, bytes, itemKind, source, sourceAccountId, now, meta);
  return id;
}

export async function upsertVaultNoteAsync(input: {
  userId: string;
  itemId?: string;
  title: string;
  content: string;
  bytes?: number;
  itemKind?: string;
  source?: string;
  sourceAccountId?: string | null;
  subtitle?: string | null;
  meta?: Record<string, unknown>;
}) {
  const now = new Date().toISOString();
  const preview = input.subtitle ?? input.content.slice(0, 180);
  const bytes = input.bytes ?? Buffer.byteLength(input.content, "utf8");
  const itemKind = input.itemKind ?? "note";
  const source = input.source ?? "vault-note";
  const sourceAccountId = input.sourceAccountId ?? null;
  const meta = JSON.stringify({ content: input.content, ...(input.meta ?? {}) });

  if (input.itemId) {
    await dbRun(
      `
        UPDATE vault_items
        SET title = ?, subtitle = ?, bytes = ?, item_kind = ?, source = ?, source_account_id = ?, occurred_at = ?, meta_json = ?
        WHERE id = ? AND user_id = ? AND section = 'notes'
      `,
      [input.title, preview, bytes, itemKind, source, sourceAccountId, now, meta, input.itemId, input.userId],
    );
    return input.itemId;
  }

  const id = randomUUID();
  await dbRun(
    `
      INSERT INTO vault_items
      (id, user_id, section, title, subtitle, bytes, item_kind, source, source_account_id, occurred_at, unread, meta_json)
      VALUES (?, ?, 'notes', ?, ?, ?, ?, ?, ?, ?, 0, ?)
    `,
    [id, input.userId, input.title, preview, bytes, itemKind, source, sourceAccountId, now, meta],
  );
  return id;
}

export function createVaultAudioNoteRecord(input: {
  userId: string;
  title: string;
  bytes: number;
  source?: string;
  sourceAccountId?: string | null;
  subtitle?: string;
  meta?: Record<string, unknown>;
}) {
  const db = getDb();
  const id = randomUUID();
  const now = new Date().toISOString();
  const meta = JSON.stringify(input.meta ?? {});

  db.prepare(
    `
      INSERT INTO vault_items
      (id, user_id, section, title, subtitle, bytes, item_kind, source, source_account_id, occurred_at, unread, meta_json)
      VALUES (?, ?, 'notes', ?, ?, ?, 'audio-note', ?, ?, ?, 0, ?)
    `,
  ).run(
    id,
    input.userId,
    input.title,
    input.subtitle ?? "Voice note",
    input.bytes,
    input.source ?? "vault-audio-note",
    input.sourceAccountId ?? null,
    now,
    meta,
  );

  return id;
}

export async function createVaultAudioNoteRecordAsync(input: {
  userId: string;
  title: string;
  bytes: number;
  source?: string;
  sourceAccountId?: string | null;
  subtitle?: string;
  meta?: Record<string, unknown>;
}) {
  const id = randomUUID();
  const now = new Date().toISOString();
  const meta = JSON.stringify(input.meta ?? {});

  await dbRun(
    `
      INSERT INTO vault_items
      (id, user_id, section, title, subtitle, bytes, item_kind, source, source_account_id, occurred_at, unread, meta_json)
      VALUES (?, ?, 'notes', ?, ?, ?, 'audio-note', ?, ?, ?, 0, ?)
    `,
    [
      id,
      input.userId,
      input.title,
      input.subtitle ?? "Voice note",
      input.bytes,
      input.source ?? "vault-audio-note",
      input.sourceAccountId ?? null,
      now,
      meta,
    ],
  );

  return id;
}

export function upsertVaultPassword(input: {
  userId: string;
  itemId?: string;
  label: string;
  username: string;
  password?: string;
  website?: string;
  note?: string;
}) {
  const db = getDb();
  const now = new Date().toISOString();

  if (input.itemId) {
    const existing = getVaultItemById(input.userId, input.itemId);
    const passwordPayload =
      input.password && input.password.length > 0
        ? encryptVaultSecret(input.password)
        : ((existing?.meta?.password as Record<string, unknown> | undefined) ?? null);
    const meta = JSON.stringify({
      website: input.website ?? "",
      note: input.note ?? "",
      password: passwordPayload,
    });
    db.prepare(
      `
        UPDATE vault_items
        SET title = ?, subtitle = ?, bytes = ?, item_kind = 'password', source = 'vault-password', occurred_at = ?, meta_json = ?
        WHERE id = ? AND user_id = ? AND section = 'passwords'
      `,
    ).run(
      input.label,
      input.username,
      Buffer.byteLength(input.password && input.password.length > 0 ? input.password : readVaultPassword(existing!) ?? "", "utf8"),
      now,
      meta,
      input.itemId,
      input.userId,
    );
    return input.itemId;
  }

  if (!input.password) {
    throw new Error("Password is required.");
  }

  const encrypted = encryptVaultSecret(input.password);
  const meta = JSON.stringify({
    website: input.website ?? "",
    note: input.note ?? "",
    password: encrypted,
  });

  const id = randomUUID();
  db.prepare(
    `
      INSERT INTO vault_items
      (id, user_id, section, title, subtitle, bytes, item_kind, source, source_account_id, occurred_at, unread, meta_json)
      VALUES (?, ?, 'passwords', ?, ?, ?, 'password', 'vault-password', NULL, ?, 0, ?)
    `,
  ).run(id, input.userId, input.label, input.username, Buffer.byteLength(input.password, "utf8"), now, meta);
  return id;
}

export function readVaultPassword(item: VaultItemRecord) {
  return decryptVaultSecret((item.meta?.password as Record<string, unknown> | undefined) ?? null);
}

export function getPreferredGoogleUploadTargets(userId: string) {
  const db = getDb();
  return db
    .prepare(
      `
        SELECT id, user_id, account_label, google_email, refresh_token, total_bytes, used_bytes
        FROM hidden_google_accounts
        WHERE user_id = ? AND refresh_token IS NOT NULL
        ORDER BY (total_bytes - used_bytes) DESC, created_at ASC
      `,
    )
    .all(userId)
    .map((row) => row as ConnectedGoogleUploadTarget);
}

export async function getPreferredGoogleUploadTargetsAsync(userId: string) {
  const rows = await dbAll<ConnectedGoogleUploadTarget>(
    `
      SELECT id, user_id, account_label, google_email, refresh_token, total_bytes, used_bytes
      FROM hidden_google_accounts
      WHERE user_id = ? AND refresh_token IS NOT NULL
      ORDER BY (total_bytes - used_bytes) DESC, created_at ASC
    `,
    [userId],
  );

  return rows.map((row) => ({
    ...row,
    total_bytes: Number(row.total_bytes),
    used_bytes: Number(row.used_bytes),
  }));
}

export function getGoogleUploadTargetForPath(userId: string, folderPath: string) {
  const folder = folderPath
    ? listDriveFoldersAtPath(userId, folderPath).find((entry) => entry.fullPath === folderPath)
    : null;

  if (folder?.sourceAccountId) {
    const db = getDb();
    const target = db
      .prepare(
        `
          SELECT id, user_id, account_label, google_email, refresh_token, total_bytes, used_bytes
          FROM hidden_google_accounts
          WHERE id = ? AND refresh_token IS NOT NULL
          LIMIT 1
        `,
      )
      .get(folder.sourceAccountId) as ConnectedGoogleUploadTarget | undefined;
    if (target) {
      return target;
    }
  }

  return getPreferredGoogleUploadTargets(userId)[0] ?? null;
}

export async function getGoogleUploadTargetForPathAsync(userId: string, folderPath: string) {
  const folder = folderPath
    ? (await listDriveFoldersAtPathAsync(userId, folderPath)).find((entry) => entry.fullPath === folderPath)
    : null;

  if (folder?.sourceAccountId) {
    const target = (await dbGet<ConnectedGoogleUploadTarget>(
      `
        SELECT id, user_id, account_label, google_email, refresh_token, total_bytes, used_bytes
        FROM hidden_google_accounts
        WHERE id = ? AND refresh_token IS NOT NULL
        LIMIT 1
      `,
      [folder.sourceAccountId],
    )) as ConnectedGoogleUploadTarget | null;
    if (target) {
      return {
        ...target,
        total_bytes: Number(target.total_bytes),
        used_bytes: Number(target.used_bytes),
      };
    }
  }

  return (await getPreferredGoogleUploadTargetsAsync(userId))[0] ?? null;
}

export function getSourceGoogleAccountById(accountId: string) {
  const db = getDb();
  return db
    .prepare(
      `
        SELECT id, user_id, account_label, google_email, refresh_token
        FROM hidden_google_accounts
        WHERE id = ?
        LIMIT 1
      `,
    )
    .get(accountId) as
    | {
        id: string;
        user_id: string;
        account_label: string;
        google_email: string;
        refresh_token: string | null;
      }
    | undefined;
}

export async function getSourceGoogleAccountByIdAsync(accountId: string) {
  return ((await dbGet<{
    id: string;
    user_id: string;
    account_label: string;
    google_email: string;
    refresh_token: string | null;
  }>(
    `
      SELECT id, user_id, account_label, google_email, refresh_token
      FROM hidden_google_accounts
      WHERE id = ?
      LIMIT 1
    `,
    [accountId],
  )) ?? undefined) as
    | {
        id: string;
        user_id: string;
        account_label: string;
        google_email: string;
        refresh_token: string | null;
      }
    | undefined;
}

export async function createManagedMember(input: {
  username: string;
  email: string;
  password: string;
  fullName: string;
}) {
  const id = randomUUID();
  const now = new Date().toISOString();
  const passwordHash = await bcrypt.hash(input.password, 10);
  const avatar = input.fullName
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 2);

  await dbRun(
    `
      INSERT INTO users (id, username, email, password_hash, full_name, avatar, role_label, is_admin, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)
    `,
    [id, input.username, input.email, passwordHash, input.fullName, avatar || "NV", "Private Vault Member", now],
  );

  await dbRun(
    `
      INSERT INTO icloud_connections (user_id, connected, apple_email, last_sync, pending_items)
      VALUES (?, 0, NULL, NULL, 0)
    `,
    [id],
  );

  return id;
}

export function createHiddenAccountAssignment(input: {
  userId: string;
  label: string;
  googleEmail: string;
  accountPassword?: string;
}) {
  const db = getDb();
  const passwordPayload = input.accountPassword?.trim()
    ? JSON.stringify(encryptVaultSecret(input.accountPassword.trim()))
    : null;
  db.prepare(
    `
      INSERT INTO hidden_google_accounts
      (id, user_id, account_label, google_email, login_password_json, refresh_token, scopes, total_bytes, used_bytes, kind, status, last_synced_at, created_at)
      VALUES (?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?, 'seeded', NULL, ?)
    `,
  ).run(
    randomUUID(),
    input.userId,
    input.label,
    input.googleEmail,
    passwordPayload,
    0,
    0,
    "google",
    new Date().toISOString(),
  );
}

export async function createHiddenAccountAssignmentAsync(input: {
  userId: string;
  label: string;
  googleEmail: string;
  accountPassword?: string;
}) {
  const passwordPayload = input.accountPassword?.trim()
    ? JSON.stringify(encryptVaultSecret(input.accountPassword.trim()))
    : null;
  await dbRun(
    `
      INSERT INTO hidden_google_accounts
      (id, user_id, account_label, google_email, login_password_json, refresh_token, scopes, total_bytes, used_bytes, kind, status, last_synced_at, created_at)
      VALUES (?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?, 'seeded', NULL, ?)
    `,
    [randomUUID(), input.userId, input.label, input.googleEmail, passwordPayload, 0, 0, "google", new Date().toISOString()],
  );
}

export function updateManagedMember(input: {
  userId: string;
  username: string;
  email: string;
  fullName: string;
  roleLabel: string;
}) {
  const db = getDb();
  db.prepare(
    `
      UPDATE users
      SET username = ?, email = ?, full_name = ?, role_label = ?
      WHERE id = ? AND is_admin = 0
    `,
  ).run(input.username, input.email, input.fullName, input.roleLabel, input.userId);
}

export function deleteManagedMember(userId: string) {
  const db = getDb();
  db.prepare("DELETE FROM users WHERE id = ? AND is_admin = 0").run(userId);
}

export async function deleteManagedMemberAsync(userId: string) {
  await dbRun("DELETE FROM users WHERE id = ? AND is_admin = 0", [userId]);
}

export function updateHiddenAccountAssignment(input: {
  id: string;
  label: string;
  googleEmail: string;
  accountPassword?: string;
}) {
  const db = getDb();
  const passwordPayload = input.accountPassword?.trim()
    ? JSON.stringify(encryptVaultSecret(input.accountPassword.trim()))
    : null;
  db.prepare(
    `
      UPDATE hidden_google_accounts
      SET account_label = ?, google_email = ?, login_password_json = ?, kind = 'google'
      WHERE id = ?
    `,
  ).run(input.label, input.googleEmail, passwordPayload, input.id);
}

export async function updateHiddenAccountAssignmentAsync(input: {
  id: string;
  label: string;
  googleEmail: string;
  accountPassword?: string;
}) {
  const passwordPayload = input.accountPassword?.trim()
    ? JSON.stringify(encryptVaultSecret(input.accountPassword.trim()))
    : null;
  await dbRun(
    `
      UPDATE hidden_google_accounts
      SET account_label = ?, google_email = ?, login_password_json = ?, kind = 'google'
      WHERE id = ?
    `,
    [input.label, input.googleEmail, passwordPayload, input.id],
  );
}

export function deleteHiddenAccountAssignment(id: string) {
  const db = getDb();
  db.prepare("DELETE FROM hidden_google_accounts WHERE id = ?").run(id);
}

export async function deleteHiddenAccountAssignmentAsync(id: string) {
  await dbRun("DELETE FROM hidden_google_accounts WHERE id = ?", [id]);
}

export function disconnectHiddenGoogleAccount(id: string) {
  const db = getDb();
  db.prepare(
    `
      UPDATE hidden_google_accounts
      SET refresh_token = NULL, scopes = NULL, status = 'disconnected'
      WHERE id = ?
    `,
  ).run(id);

  db.prepare(
    `
      DELETE FROM vault_items
      WHERE source_account_id = ? AND source IN ('google-drive', 'gmail')
    `,
  ).run(id);
}

export async function disconnectHiddenGoogleAccountAsync(id: string) {
  await dbRun(
    `
      UPDATE hidden_google_accounts
      SET refresh_token = NULL, scopes = NULL, status = 'disconnected'
      WHERE id = ?
    `,
    [id],
  );

  await dbRun(
    `
      DELETE FROM vault_items
      WHERE source_account_id = ? AND source IN ('google-drive', 'gmail')
    `,
    [id],
  );
}

export async function resetManagedMemberPassword(userId: string, password: string) {
  const db = getDb();
  const passwordHash = await bcrypt.hash(password, 10);
  db.prepare(
    `
      UPDATE users
      SET password_hash = ?
      WHERE id = ? AND is_admin = 0
    `,
  ).run(passwordHash, userId);
}

export async function resetOwnPassword(userId: string, currentPassword: string, nextPassword: string) {
  const user = getUserAuthRecord(userId);

  if (!user) {
    throw new Error("Account not found.");
  }

  const valid = await bcrypt.compare(currentPassword, user.password_hash);
  if (!valid) {
    throw new Error("Current password is incorrect.");
  }

  const passwordHash = await bcrypt.hash(nextPassword, 10);
  getDb()
    .prepare(
      `
        UPDATE users
        SET password_hash = ?
        WHERE id = ?
      `,
    )
    .run(passwordHash, userId);
}

export function createAppleAccountLink(input: {
  userId: string;
  label: string;
  appleEmail: string;
}) {
  const db = getDb();
  db.prepare(
    `
      INSERT INTO apple_accounts (id, user_id, label, apple_email, status, last_sync, created_at)
      VALUES (?, ?, ?, ?, 'linked', NULL, ?)
    `,
  ).run(randomUUID(), input.userId, input.label, input.appleEmail, new Date().toISOString());
  db.prepare(
    `
      UPDATE icloud_connections
      SET connected = 1
      WHERE user_id = ?
    `,
  ).run(input.userId);
}

export function queueAppleImport(input: { userId: string; appleAccountId?: string | null }) {
  const db = getDb();
  db.prepare(
    `
      UPDATE icloud_connections
      SET pending_items = pending_items + 1, last_sync = ?
      WHERE user_id = ?
    `,
  ).run(new Date().toISOString(), input.userId);

  if (input.appleAccountId) {
    db.prepare(
      `
        UPDATE apple_accounts
        SET status = 'queued', last_sync = ?
        WHERE id = ? AND user_id = ?
      `,
    ).run(new Date().toISOString(), input.appleAccountId, input.userId);
  } else {
    db.prepare(
      `
        UPDATE apple_accounts
        SET status = 'queued', last_sync = ?
        WHERE user_id = ?
      `,
    ).run(new Date().toISOString(), input.userId);
  }
}

export function upsertHiddenGoogleAccountCredential(input: {
  userId: string;
  label: string;
  googleEmail: string;
  refreshToken: string;
  scopes: string;
}) {
  const db = getDb();
  const existing = db
    .prepare(
      `
        SELECT id
        FROM hidden_google_accounts
        WHERE user_id = ? AND account_label = ?
        LIMIT 1
      `,
    )
    .get(input.userId, input.label) as { id: string } | undefined;

  if (existing) {
    db.prepare(
      `
        UPDATE hidden_google_accounts
        SET refresh_token = ?, scopes = ?, status = 'connected', last_synced_at = ?
        WHERE id = ?
      `,
    ).run(
      input.refreshToken,
      input.scopes,
      new Date().toISOString(),
      existing.id,
    );

    return existing.id;
  }

  const id = randomUUID();
  db.prepare(
    `
      INSERT INTO hidden_google_accounts
      (id, user_id, account_label, google_email, refresh_token, scopes, total_bytes, used_bytes, kind, status, last_synced_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 0, 0, 'drive', 'connected', ?, ?)
    `,
  ).run(
    id,
    input.userId,
    input.label,
    input.googleEmail,
    input.refreshToken,
    input.scopes,
    new Date().toISOString(),
    new Date().toISOString(),
  );

  return id;
}

export async function upsertHiddenGoogleAccountCredentialAsync(input: {
  userId: string;
  label: string;
  googleEmail: string;
  refreshToken: string;
  scopes: string;
}) {
  const existing = (await dbGet<{ id: string }>(
    `
      SELECT id
      FROM hidden_google_accounts
      WHERE user_id = ? AND account_label = ?
      LIMIT 1
    `,
    [input.userId, input.label],
  )) ?? undefined;

  if (existing) {
    await dbRun(
      `
        UPDATE hidden_google_accounts
        SET refresh_token = ?, scopes = ?, status = 'connected', last_synced_at = ?
        WHERE id = ?
      `,
      [input.refreshToken, input.scopes, new Date().toISOString(), existing.id],
    );

    return existing.id;
  }

  const id = randomUUID();
  const now = new Date().toISOString();
  await dbRun(
    `
      INSERT INTO hidden_google_accounts
      (id, user_id, account_label, google_email, refresh_token, scopes, total_bytes, used_bytes, kind, status, last_synced_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 0, 0, 'drive', 'connected', ?, ?)
    `,
    [id, input.userId, input.label, input.googleEmail, input.refreshToken, input.scopes, now, now],
  );

  return id;
}

export function upsertDriveSnapshot(
  accountId: string,
  totalBytes: number,
  usedBytes: number,
  items: Array<{
    name: string;
    size: number;
    type: string;
    updatedAt: string;
    targetSection: "photos" | "drive";
    sourceLabel: string;
    meta?: Record<string, unknown>;
  }>,
) {
  const db = getDb();
  const account = db
    .prepare("SELECT user_id FROM hidden_google_accounts WHERE id = ? LIMIT 1")
    .get(accountId) as { user_id: string } | undefined;

  if (!account) return;

  db.prepare(
    `
      UPDATE hidden_google_accounts
      SET total_bytes = ?, used_bytes = ?, status = 'synced', last_synced_at = ?
      WHERE id = ?
    `,
  ).run(totalBytes, usedBytes, new Date().toISOString(), accountId);

  db.prepare(
    "DELETE FROM vault_items WHERE user_id = ? AND section = 'drive' AND source = 'google-drive' AND source_account_id = ?",
  ).run(account.user_id, accountId);
  db.prepare(
    "DELETE FROM vault_items WHERE user_id = ? AND section = 'photos' AND source = 'google-drive' AND source_account_id = ?",
  ).run(account.user_id, accountId);
  db.prepare(
    "DELETE FROM vault_items WHERE user_id = ? AND section = 'videos' AND source = 'google-drive' AND source_account_id = ?",
  ).run(account.user_id, accountId);

  const stmt = db.prepare(
    `
      INSERT INTO vault_items
      (id, user_id, section, title, subtitle, bytes, item_kind, source, source_account_id, occurred_at, unread, meta_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'google-drive', ?, ?, 0, ?)
    `,
  );

  for (const item of items) {
    stmt.run(
      randomUUID(),
      account.user_id,
      "drive",
      item.name,
      item.sourceLabel,
      item.size,
      item.type,
      accountId,
      item.updatedAt,
      JSON.stringify(item.meta ?? {}),
    );

    if (item.targetSection === "photos") {
      const mirroredSection = item.type === "video" ? "videos" : "photos";
      stmt.run(
        randomUUID(),
        account.user_id,
        mirroredSection,
        item.name,
        item.sourceLabel,
        item.size,
        item.type,
        accountId,
        item.updatedAt,
        JSON.stringify(item.meta ?? {}),
      );
    }
  }
}

export async function upsertDriveSnapshotAsync(
  accountId: string,
  totalBytes: number,
  usedBytes: number,
  items: Array<{
    name: string;
    size: number;
    type: string;
    updatedAt: string;
    targetSection: "photos" | "drive";
    sourceLabel: string;
    meta?: Record<string, unknown>;
  }>,
) {
  const account = (await dbGet<{ user_id: string }>(
    "SELECT user_id FROM hidden_google_accounts WHERE id = ? LIMIT 1",
    [accountId],
  )) ?? null;

  if (!account) return;

  await dbRun(
    `
      UPDATE hidden_google_accounts
      SET total_bytes = ?, used_bytes = ?, status = 'synced', last_synced_at = ?
      WHERE id = ?
    `,
    [totalBytes, usedBytes, new Date().toISOString(), accountId],
  );

  await dbRun(
    "DELETE FROM vault_items WHERE user_id = ? AND section = 'drive' AND source = 'google-drive' AND source_account_id = ?",
    [account.user_id, accountId],
  );
  await dbRun(
    "DELETE FROM vault_items WHERE user_id = ? AND section = 'photos' AND source = 'google-drive' AND source_account_id = ?",
    [account.user_id, accountId],
  );
  await dbRun(
    "DELETE FROM vault_items WHERE user_id = ? AND section = 'videos' AND source = 'google-drive' AND source_account_id = ?",
    [account.user_id, accountId],
  );

  for (const item of items) {
    const baseMeta = item.meta ?? {};
    const fileId = typeof baseMeta.fileId === "string" ? baseMeta.fileId : null;

    await dbRun(
      `
        INSERT INTO vault_items
        (id, user_id, section, title, subtitle, bytes, item_kind, source, source_account_id, occurred_at, unread, meta_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'google-drive', ?, ?, 0, ?)
      `,
      [
        randomUUID(),
        account.user_id,
        "drive",
        item.name,
        item.sourceLabel,
        item.size,
        item.type,
        accountId,
        item.updatedAt,
        JSON.stringify(baseMeta),
      ],
    );

    if (item.type === "image") {
      await dbRun(
        `
          INSERT INTO vault_items
          (id, user_id, section, title, subtitle, bytes, item_kind, source, source_account_id, occurred_at, unread, meta_json)
          VALUES (?, ?, 'photos', ?, ?, ?, 'image', 'google-drive', ?, ?, 0, ?)
        `,
        [
          randomUUID(),
          account.user_id,
          item.name,
          item.sourceLabel,
          item.size,
          accountId,
          item.updatedAt,
          JSON.stringify(baseMeta),
        ],
      );
    }

    if (item.type === "video") {
      const videoMeta = { ...baseMeta, fileId };
      await dbRun(
        `
          INSERT INTO vault_items
          (id, user_id, section, title, subtitle, bytes, item_kind, source, source_account_id, occurred_at, unread, meta_json)
          VALUES (?, ?, 'photos', ?, ?, ?, 'video', 'google-drive', ?, ?, 0, ?)
        `,
        [
          randomUUID(),
          account.user_id,
          item.name,
          item.sourceLabel,
          item.size,
          accountId,
          item.updatedAt,
          JSON.stringify(videoMeta),
        ],
      );
      await dbRun(
        `
          INSERT INTO vault_items
          (id, user_id, section, title, subtitle, bytes, item_kind, source, source_account_id, occurred_at, unread, meta_json)
          VALUES (?, ?, 'videos', ?, ?, ?, 'video', 'google-drive', ?, ?, 0, ?)
        `,
        [
          randomUUID(),
          account.user_id,
          item.name,
          item.sourceLabel,
          item.size,
          accountId,
          item.updatedAt,
          JSON.stringify(videoMeta),
        ],
      );
    }
  }
}

export function createVirtualFolderRecord(input: {
  userId: string;
  sourceAccountId: string;
  folderName: string;
  folderPath: string;
  fileId: string;
}) {
  const db = getDb();
  db.prepare(
    `
      INSERT INTO vault_items
      (id, user_id, section, title, subtitle, bytes, item_kind, source, source_account_id, occurred_at, unread, meta_json)
      VALUES (?, ?, 'drive', ?, ?, 0, 'folder', 'google-drive', ?, ?, 0, ?)
    `,
  ).run(
    randomUUID(),
    input.userId,
    input.folderName,
    "folder",
    input.sourceAccountId,
    new Date().toISOString(),
    JSON.stringify({
      fileId: input.fileId,
      folderPath: input.folderPath,
      fullPath: input.folderPath ? `${input.folderPath}/${input.folderName}` : input.folderName,
      mimeType: "application/vnd.google-apps.folder",
    }),
  );
}

export function deleteFolderSnapshot(userId: string, accountId: string) {
  getDb()
    .prepare(
      "DELETE FROM vault_items WHERE user_id = ? AND section = 'drive' AND item_kind = 'folder' AND source = 'google-drive' AND source_account_id = ?",
    )
    .run(userId, accountId);
}

export async function deleteFolderSnapshotAsync(userId: string, accountId: string) {
  await dbRun(
    "DELETE FROM vault_items WHERE user_id = ? AND section = 'drive' AND item_kind = 'folder' AND source = 'google-drive' AND source_account_id = ?",
    [userId, accountId],
  );
}

export function listGoogleBackedPhotoItems(userId: string) {
  return listVaultItemsBySection(userId, "photos");
}

export function listGoogleBackedVideoItems(userId: string) {
  return listVaultItemsBySection(userId, "videos");
}

export function getFolderIdForPath(userId: string, folderPath: string) {
  const target = listDriveFoldersAtPath(userId, folderPath).find((folder) => folder.fullPath === folderPath);
  return target?.id ?? null;
}

export function getDriveFolderMetaByPath(userId: string, folderPath: string) {
  const db = getDb();
  const row = db
    .prepare(
      `
        SELECT id, source_account_id, meta_json
        FROM vault_items
        WHERE user_id = ? AND section = 'drive' AND item_kind = 'folder'
        ORDER BY occurred_at DESC
      `,
    )
    .all(userId) as Array<{
    id: string;
    source_account_id: string | null;
    meta_json: string | null;
  }>;

  return row
    .map((entry) => ({
      id: entry.id,
      sourceAccountId: entry.source_account_id,
      meta: parseMetaJson(entry.meta_json),
    }))
    .find((entry) => entry.meta?.fullPath === folderPath) ?? null;
}

export async function getDriveFolderMetaByPathAsync(userId: string, folderPath: string) {
  const rows = await dbAll<{
    id: string;
    source_account_id: string | null;
    meta_json: string | null;
  }>(
    `
      SELECT id, source_account_id, meta_json
      FROM vault_items
      WHERE user_id = ? AND section = 'drive' AND item_kind = 'folder'
      ORDER BY occurred_at DESC
    `,
    [userId],
  );

  return rows
    .map((entry) => ({
      id: entry.id,
      sourceAccountId: entry.source_account_id,
      meta: parseMetaJson(entry.meta_json),
    }))
    .find((entry) => entry.meta?.fullPath === folderPath) ?? null;
}

export function replaceDriveFolderSnapshot(
  userId: string,
  accountId: string,
  folders: Array<{
    name: string;
    folderPath: string;
    fullPath: string;
    fileId: string;
    updatedAt: string;
  }>,
) {
  deleteFolderSnapshot(userId, accountId);

  const db = getDb();
  const stmt = db.prepare(
    `
      INSERT INTO vault_items
      (id, user_id, section, title, subtitle, bytes, item_kind, source, source_account_id, occurred_at, unread, meta_json)
      VALUES (?, ?, 'drive', ?, ?, 0, 'folder', 'google-drive', ?, ?, 0, ?)
    `,
  );

  for (const folder of folders) {
    stmt.run(
      randomUUID(),
      userId,
      folder.name,
      "folder",
      accountId,
      folder.updatedAt,
      JSON.stringify({
        fileId: folder.fileId,
        folderPath: folder.folderPath,
        fullPath: folder.fullPath,
        mimeType: "application/vnd.google-apps.folder",
      }),
    );
  }
}

export async function replaceDriveFolderSnapshotAsync(
  userId: string,
  accountId: string,
  folders: Array<{
    name: string;
    folderPath: string;
    fullPath: string;
    fileId: string;
    updatedAt: string;
  }>,
) {
  await deleteFolderSnapshotAsync(userId, accountId);

  for (const folder of folders) {
    await dbRun(
      `
        INSERT INTO vault_items
        (id, user_id, section, title, subtitle, bytes, item_kind, source, source_account_id, occurred_at, unread, meta_json)
        VALUES (?, ?, 'drive', ?, ?, 0, 'folder', 'google-drive', ?, ?, 0, ?)
      `,
      [
        randomUUID(),
        userId,
        folder.name,
        "folder",
        accountId,
        folder.updatedAt,
        JSON.stringify({
          fileId: folder.fileId,
          folderPath: folder.folderPath,
          fullPath: folder.fullPath,
          mimeType: "application/vnd.google-apps.folder",
        }),
      ],
    );
  }
}

export function replaceMailSnapshot(
  userId: string,
  accountId: string,
  messages: Array<{
    subject: string;
    from: string;
    size: number;
    receivedAt: string;
    unread: boolean;
    snippet?: string;
    messageId?: string;
  }>,
) {
  const db = getDb();
  db.prepare(
    "DELETE FROM vault_items WHERE user_id = ? AND section = 'mail' AND source = 'gmail' AND source_account_id = ?",
  ).run(userId, accountId);

  const stmt = db.prepare(
    `
      INSERT INTO vault_items
      (id, user_id, section, title, subtitle, bytes, item_kind, source, source_account_id, occurred_at, unread, meta_json)
      VALUES (?, ?, 'mail', ?, ?, ?, 'mail', 'gmail', ?, ?, ?, ?)
    `,
  );

  for (const message of messages) {
    stmt.run(
      randomUUID(),
      userId,
      message.subject,
      message.from,
      message.size,
      accountId,
      message.receivedAt,
      message.unread ? 1 : 0,
      JSON.stringify({
        snippet: message.snippet ?? "",
        messageId: message.messageId ?? null,
      }),
    );
  }
}

export async function replaceMailSnapshotAsync(
  userId: string,
  accountId: string,
  messages: Array<{
    subject: string;
    from: string;
    size: number;
    receivedAt: string;
    unread: boolean;
    snippet?: string;
    messageId?: string;
  }>,
) {
  await dbRun(
    "DELETE FROM vault_items WHERE user_id = ? AND section = 'mail' AND source = 'gmail' AND source_account_id = ?",
    [userId, accountId],
  );

  for (const message of messages) {
    await dbRun(
      `
        INSERT INTO vault_items
        (id, user_id, section, title, subtitle, bytes, item_kind, source, source_account_id, occurred_at, unread, meta_json)
        VALUES (?, ?, 'mail', ?, ?, ?, 'mail', 'gmail', ?, ?, ?, ?)
      `,
      [
        randomUUID(),
        userId,
        message.subject,
        message.from,
        message.size,
        accountId,
        message.receivedAt,
        message.unread ? 1 : 0,
        JSON.stringify({
          snippet: message.snippet ?? "",
          messageId: message.messageId ?? null,
        }),
      ],
    );
  }
}

export function updateIcloudQueue(userId: string) {
  const db = getDb();
  db.prepare(
    `
      UPDATE icloud_connections
      SET pending_items = pending_items + 1, last_sync = ?
      WHERE user_id = ?
    `,
  ).run(new Date().toISOString(), userId);
}

export function createSyncRun(userId: string, provider: string, status: string, message: string) {
  return createSyncRunDetailed({
    userId,
    provider,
    status,
    message,
  });
}

export async function createSyncRunAsync(
  userId: string,
  provider: string,
  status: string,
  message: string,
) {
  return createSyncRunDetailedAsync({
    userId,
    provider,
    status,
    message,
  });
}

export function createSyncRunDetailed(input: {
  userId: string;
  provider: string;
  status: string;
  message: string;
  accountId?: string | null;
  itemCount?: number;
}) {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(
    `
      INSERT INTO sync_runs (id, user_id, provider, account_id, status, item_count, message, started_at, finished_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
  ).run(
    randomUUID(),
    input.userId,
    input.provider,
    input.accountId ?? null,
    input.status,
    input.itemCount ?? 0,
    input.message,
    now,
    now,
  );
}

export async function createSyncRunDetailedAsync(input: {
  userId: string;
  provider: string;
  status: string;
  message: string;
  accountId?: string | null;
  itemCount?: number;
}) {
  const now = new Date().toISOString();
  await dbRun(
    `
      INSERT INTO sync_runs (id, user_id, provider, account_id, status, item_count, message, started_at, finished_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      randomUUID(),
      input.userId,
      input.provider,
      input.accountId ?? null,
      input.status,
      input.itemCount ?? 0,
      input.message,
      now,
      now,
    ],
  );
}

export async function importVaultFiles(input: {
  userId: string;
  section: "photos" | "drive";
  source: "apple-photo-picker" | "apple-file-picker" | "device-upload";
  files: File[];
}) {
  const db = getDb();

  const stmt = db.prepare(
    `
      INSERT INTO vault_items
      (id, user_id, section, title, subtitle, bytes, item_kind, source, source_account_id, occurred_at, unread, meta_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, 0, ?)
    `,
  );

  let imported = 0;

  for (const file of input.files) {
    if (!file || file.size === 0) continue;

    const buffer = Buffer.from(await file.arrayBuffer());
    const storedFile = await storeBinaryFile({
      scope: ["imports", input.userId, input.section],
      fileName: file.name,
      contentType: file.type || "application/octet-stream",
      buffer,
    });

    const mimeType = file.type || "";
    const isPhotoSection = input.section === "photos";
    const kind = isPhotoSection
      ? isVideoLikeFile(mimeType, file.name)
        ? "video"
        : "image"
      : isArchiveLikeFile(mimeType, file.name)
        ? "archive"
        : mimeType.includes("folder")
          ? "folder"
          : isSheetLikeFile(mimeType, file.name)
            ? "sheet"
            : isImageLikeFile(mimeType, file.name)
              ? "image"
              : isVideoLikeFile(mimeType, file.name)
                ? "video"
                : "document";

    stmt.run(
      randomUUID(),
      input.userId,
      input.section,
      file.name,
      mimeType || "manual-import",
      file.size,
      kind,
      input.source,
      new Date().toISOString(),
      JSON.stringify({
        storedObjectKey: storedFile.objectKey,
        storageProvider: storedFile.provider,
        originalType: mimeType,
        originalName: file.name,
      }),
    );
    imported += 1;
  }

  return imported;
}

export function createAuditLog(input: {
  actorUserId: string;
  targetUserId?: string | null;
  action: string;
  details?: string | null;
}) {
  const db = getDb();
  db.prepare(
    `
      INSERT INTO audit_logs (id, actor_user_id, target_user_id, action, details, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
  ).run(
    randomUUID(),
    input.actorUserId,
    input.targetUserId ?? null,
    input.action,
    input.details ?? null,
    new Date().toISOString(),
  );
}

export async function createAuditLogAsync(input: {
  actorUserId: string;
  targetUserId?: string | null;
  action: string;
  details?: string | null;
}) {
  await dbRun(
    `
      INSERT INTO audit_logs (id, actor_user_id, target_user_id, action, details, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
    [
      randomUUID(),
      input.actorUserId,
      input.targetUserId ?? null,
      input.action,
      input.details ?? null,
      new Date().toISOString(),
    ],
  );
}

export function listAuditLogs(limit = 20): AdminAuditEntry[] {
  const db = getDb();
  return db
    .prepare(
      `
        SELECT l.id,
               actor.username AS actor_username,
               target.username AS target_username,
               l.action,
               l.details,
               l.created_at
        FROM audit_logs l
        INNER JOIN users actor ON actor.id = l.actor_user_id
        LEFT JOIN users target ON target.id = l.target_user_id
        ORDER BY l.created_at DESC
        LIMIT ?
      `,
    )
    .all(limit)
    .map((row) => row as {
      id: string;
      actor_username: string;
      target_username: string | null;
      action: string;
      details: string | null;
      created_at: string;
    })
    .map((row) => ({
      id: row.id,
      actorLabel: row.actor_username,
      targetLabel: row.target_username,
      action: row.action,
      details: row.details,
      createdAt: row.created_at,
    }));
}

export async function listAuditLogsAsync(limit = 20): Promise<AdminAuditEntry[]> {
  const rows = await dbAll<{
    id: string;
    actor_username: string;
    target_username: string | null;
    action: string;
    details: string | null;
    created_at: string;
  }>(
    `
      SELECT l.id,
             actor.username AS actor_username,
             target.username AS target_username,
             l.action,
             l.details,
             l.created_at
      FROM audit_logs l
      INNER JOIN users actor ON actor.id = l.actor_user_id
      LEFT JOIN users target ON target.id = l.target_user_id
      ORDER BY l.created_at DESC
      LIMIT ?
    `,
    [limit],
  );

  return rows.map((row) => ({
    id: row.id,
    actorLabel: row.actor_username,
    targetLabel: row.target_username,
    action: row.action,
    details: row.details,
    createdAt: row.created_at,
  }));
}
