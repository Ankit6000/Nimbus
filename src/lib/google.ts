import { Readable } from "node:stream";
import { google } from "googleapis";
import {
  isArchiveLikeFile,
  isImageLikeFile,
  isSheetLikeFile,
  isVideoLikeFile,
} from "@/lib/file-types";
import {
  createVaultAudioNoteRecordAsync,
  getVaultItemByIdAsync,
  getDriveFolderMetaByPathAsync,
  createSyncRunDetailedAsync,
  getHiddenGoogleAccountAssignmentAsync,
  getGoogleUploadTargetForPathAsync,
  getSourceGoogleAccountByIdAsync,
  listGoogleAccountsForUserAsync,
  replaceDriveFolderSnapshotAsync,
  replaceMailSnapshotAsync,
  upsertDriveSnapshotAsync,
  upsertHiddenGoogleAccountCredentialAsync,
  upsertVaultNoteAsync,
} from "@/lib/repository";

const INTERNAL_VAULT_ROOT = "Nimbus Vault Internal";
const INTERNAL_NOTES_PATH = `${INTERNAL_VAULT_ROOT}/Notes`;
const INTERNAL_VOICE_NOTES_PATH = `${INTERNAL_VAULT_ROOT}/Voice Notes`;

function isInternalVaultPath(folderPath: string) {
  return folderPath === INTERNAL_VAULT_ROOT || folderPath.startsWith(`${INTERNAL_VAULT_ROOT}/`);
}

function sanitizeGoogleFileName(value: string) {
  return (value || "Untitled")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function classifyDriveFile(mimeType: string, fileName: string) {
  if (isImageLikeFile(mimeType, fileName)) return "image";
  if (isVideoLikeFile(mimeType, fileName)) return "video";
  if (isArchiveLikeFile(mimeType, fileName)) return "archive";
  if (isSheetLikeFile(mimeType, fileName)) return "sheet";

  return "document";
}

async function listAllGoogleDriveFiles(drive: ReturnType<typeof google.drive>) {
  const files: Array<{
    id?: string | null;
    name?: string | null;
    mimeType?: string | null;
    size?: string | number | null;
    modifiedTime?: string | null;
    parents?: string[] | null;
    thumbnailLink?: string | null;
    webViewLink?: string | null;
    webContentLink?: string | null;
    iconLink?: string | null;
  }> = [];
  let pageToken: string | undefined;

  do {
    const response = await drive.files.list({
      pageSize: 1000,
      fields:
        "nextPageToken,files(id,name,mimeType,size,modifiedTime,parents,thumbnailLink,webViewLink,webContentLink,iconLink)",
      q: "trashed = false",
      pageToken,
    });

    files.push(...(response.data.files ?? []));
    pageToken = response.data.nextPageToken ?? undefined;
  } while (pageToken);

  return files;
}

function extensionForMimeType(mimeType: string) {
  if (mimeType.includes("mpeg")) return "mp3";
  if (mimeType.includes("mp4")) return "m4a";
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.startsWith("text/")) return "txt";
  return "webm";
}

async function getWritableGoogleTarget(userId: string, preferredAccountId?: string | null) {
  if (preferredAccountId) {
    const preferred = await getSourceGoogleAccountByIdAsync(preferredAccountId);
    if (preferred?.refresh_token) {
      return {
        ...preferred,
        refresh_token: preferred.refresh_token,
      };
    }
  }

  const target = await getGoogleUploadTargetForPathAsync(userId, "");
  if (!target?.refresh_token) {
    throw new Error("No connected hidden Google accounts are ready yet.");
  }
  return {
    ...target,
    refresh_token: target.refresh_token,
  };
}

function getGoogleConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    return null;
  }

  return { clientId, clientSecret, redirectUri };
}

function createOAuthClient(refreshToken: string) {
  const config = getGoogleConfig();
  if (!config) {
    throw new Error("Missing Google OAuth environment variables.");
  }

  const client = new google.auth.OAuth2(
    config.clientId,
    config.clientSecret,
    config.redirectUri,
  );

  client.setCredentials({ refresh_token: refreshToken });
  return client;
}

function decodeJwtPayload(token: string) {
  const parts = token.split(".");
  if (parts.length < 2) {
    return null;
  }

  const payload = parts[1];
  const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");

  try {
    return JSON.parse(Buffer.from(padded, "base64").toString("utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function createGoogleConsentUrl(input: {
  userId: string;
  label: string;
  googleEmailHint?: string;
}) {
  const config = getGoogleConfig();
  if (!config) {
    throw new Error("Missing Google OAuth environment variables.");
  }

  const client = new google.auth.OAuth2(
    config.clientId,
    config.clientSecret,
    config.redirectUri,
  );

  const state = Buffer.from(JSON.stringify(input)).toString("base64url");

  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [
      "openid",
      "email",
      "profile",
      "https://www.googleapis.com/auth/drive.metadata.readonly",
      "https://www.googleapis.com/auth/drive.file",
      "https://www.googleapis.com/auth/gmail.readonly",
    ],
    state,
    login_hint: input.googleEmailHint,
  });
}

export async function exchangeGoogleCode(code: string, state: string) {
  const config = getGoogleConfig();
  if (!config) {
    throw new Error("Missing Google OAuth environment variables.");
  }

  const parsedState = JSON.parse(Buffer.from(state, "base64url").toString("utf8")) as {
    userId: string;
    label: string;
    googleEmailHint?: string;
  };

  const client = new google.auth.OAuth2(
    config.clientId,
    config.clientSecret,
    config.redirectUri,
  );

  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);
  const accessToken =
    tokens.access_token ?? (await client.getAccessToken()).token ?? undefined;
  const refreshToken = tokens.refresh_token;
  const idPayload =
    typeof tokens.id_token === "string" ? decodeJwtPayload(tokens.id_token) : null;
  const assignment = await getHiddenGoogleAccountAssignmentAsync(parsedState.userId, parsedState.label);

  if (!refreshToken) {
    throw new Error("Google did not return a refresh token. Reconnect with prompt=consent.");
  }

  if (!accessToken) {
    throw new Error("Google did not return an access token.");
  }
  const connectedEmail = typeof idPayload?.email === "string" ? idPayload.email : "";

  if (!assignment) {
    throw new Error("Hidden Google account assignment not found.");
  }

  if (!connectedEmail) {
    throw new Error(
      "Google did not return an account email. Reconnect and approve the identity scopes.",
    );
  }

  if (connectedEmail.toLowerCase() !== assignment.google_email.toLowerCase()) {
    throw new Error(
      `Wrong Google account used. Expected ${assignment.google_email} but got ${connectedEmail}.`,
    );
  }

  await upsertHiddenGoogleAccountCredentialAsync({
    userId: parsedState.userId,
    label: parsedState.label,
    googleEmail: connectedEmail,
    refreshToken,
    scopes: tokens.scope ?? "",
  });

  return parsedState.userId;
}

export async function syncAssignedGoogleAccountsForUser(userId: string) {
  const accounts = await listGoogleAccountsForUserAsync(userId);
  const config = getGoogleConfig();

  if (!config) {
    await createSyncRunDetailedAsync({
      userId,
      provider: "google",
      status: "skipped",
      message: "Google OAuth credentials are not configured yet.",
    });
    return {
      status: "skipped",
      message: "Google credentials are missing. Add them to .env.local first.",
    };
  }

  let synced = 0;
  let skipped = 0;
  let errored = 0;
  const errorMessages: string[] = [];

  for (const account of accounts) {
    if (!account.refresh_token) {
      skipped += 1;
      continue;
    }

    const auth = createOAuthClient(account.refresh_token);

    try {
      const drive = google.drive({ version: "v3", auth });
      const gmail = google.gmail({ version: "v1", auth });

      const [aboutResponse, files, profileResponse, listResponse] = await Promise.all([
        drive.about.get({ fields: "storageQuota" }),
        listAllGoogleDriveFiles(drive),
        gmail.users.getProfile({ userId: "me" }),
        gmail.users.messages.list({
          userId: "me",
          maxResults: 8,
          labelIds: ["INBOX"],
        }),
      ]);

      const storageQuota = aboutResponse.data.storageQuota;
      const fileMap = new Map(
        files
          .filter((file): file is NonNullable<typeof file> => Boolean(file?.id))
          .map((file) => [file.id!, file]),
      );

      const pathCache = new Map<string, string>();
      const resolveFolderPath = (fileId: string | null | undefined): string => {
        if (!fileId) return "";
        if (pathCache.has(fileId)) {
          return pathCache.get(fileId) ?? "";
        }

        const current = fileMap.get(fileId);
        if (!current) {
          pathCache.set(fileId, "");
          return "";
        }

        const parentId = current.parents?.[0];
        const parentPath = resolveFolderPath(parentId);
        const currentPath = parentPath ? `${parentPath}/${current.name ?? fileId}` : current.name ?? fileId;
        pathCache.set(fileId, currentPath);
        return currentPath;
      };

      const folderRecords = files
        .filter((file) => file.mimeType === "application/vnd.google-apps.folder")
        .map((file) => {
          const fullPath = resolveFolderPath(file.id);
          const parts = fullPath.split("/").filter(Boolean);
          return {
            name: file.name ?? "Untitled folder",
            folderPath: parts.slice(0, -1).join("/"),
            fullPath,
            fileId: file.id ?? "",
            updatedAt: file.modifiedTime ?? new Date().toISOString(),
          };
        })
        .filter((folder) => !isInternalVaultPath(folder.fullPath));

      await upsertDriveSnapshotAsync(
        account.id,
        Number(storageQuota?.limit ?? 0),
        Number(storageQuota?.usage ?? 0),
        files
          .filter((file) => file.mimeType !== "application/vnd.google-apps.folder")
          .filter((file) => {
            const parentId = file.parents?.[0];
            const folderPath = parentId ? resolveFolderPath(parentId) : "";
            return !isInternalVaultPath(folderPath);
          })
          .map((file) => {
            const parentId = file.parents?.[0];
            const folderPath = parentId ? resolveFolderPath(parentId) : "";
            const fileType = classifyDriveFile(file.mimeType ?? "", file.name ?? "");

            return {
          name: file.name ?? "Untitled",
          size: Number(file.size ?? 0),
          type: fileType,
          targetSection:
            fileType === "image" || fileType === "video"
              ? "photos"
              : "drive",
          sourceLabel: file.mimeType ?? "google-drive",
          updatedAt: file.modifiedTime ?? new Date().toISOString(),
          meta: {
            fileId: file.id ?? null,
            mimeType: file.mimeType ?? "",
            thumbnailLink: file.thumbnailLink ?? "",
            webViewLink: file.webViewLink ?? "",
            webContentLink: file.webContentLink ?? "",
            iconLink: file.iconLink ?? "",
            folderPath,
          },
            };
          }),
      );
      await replaceDriveFolderSnapshotAsync(userId, account.id, folderRecords);

      const messages = listResponse.data.messages ?? [];
      const details = await Promise.all(
        messages.slice(0, 6).map(async (message) => {
          const result = await gmail.users.messages.get({
            userId: "me",
            id: message.id ?? "",
            format: "metadata",
            metadataHeaders: ["Subject", "From", "Date"],
          });

          const headers = result.data.payload?.headers ?? [];
          const subject =
            headers.find((header) => header.name === "Subject")?.value ?? "No subject";
          const from =
            headers.find((header) => header.name === "From")?.value ?? "Unknown sender";
          const receivedAt =
            headers.find((header) => header.name === "Date")?.value ?? new Date().toUTCString();

          return {
            subject,
            from,
            size: Number(result.data.sizeEstimate ?? 0),
            receivedAt: new Date(receivedAt).toISOString(),
            unread: true,
            snippet: result.data.snippet ?? "",
            messageId: result.data.id ?? "",
          };
        }),
      );

      await replaceMailSnapshotAsync(userId, account.id, details);
      const totalImported = files.length + details.length;

      await createSyncRunDetailedAsync({
        userId,
        provider: "google",
        accountId: account.id,
        status: "success",
        itemCount: totalImported,
        message: `Synced Google account ${account.google_email} with shared storage and mailbox data.`,
      });
      synced += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown sync failure.";
      await createSyncRunDetailedAsync({
        userId,
        provider: "google",
        accountId: account.id,
        status: "error",
        message,
      });
      errored += 1;
      errorMessages.push(`${account.google_email}: ${message}`);
    }
  }

  if (synced > 0) {
    return {
      status: "success" as const,
      message:
        errored > 0
          ? `Synced ${synced} connected account${synced === 1 ? "" : "s"}, but ${errored} account${errored === 1 ? "" : "s"} still had issues.`
          : `Synced ${synced} hidden Google account${synced === 1 ? "" : "s"}.`,
    };
  }

  if (errored > 0) {
    return {
      status: "error" as const,
      message: errorMessages[0] ?? "Connected account sync failed.",
    };
  }

  return {
    status: "skipped" as const,
    message: skipped > 0
      ? "No hidden Google accounts have refresh tokens yet."
      : "Nothing changed during sync.",
  };
}

async function ensureGoogleFolderPath(userId: string, accountId: string, requestedPath: string, auth: ReturnType<typeof createOAuthClient>) {
  if (!requestedPath) {
    return null;
  }

  const drive = google.drive({ version: "v3", auth });
  const segments = requestedPath.split("/").filter(Boolean);
  let currentPath = "";
  let parentId: string | null = null;

  for (const segment of segments) {
    currentPath = currentPath ? `${currentPath}/${segment}` : segment;
    const existing = await getDriveFolderMetaByPathAsync(userId, currentPath);

    if (existing?.meta?.fileId && existing.sourceAccountId === accountId) {
      parentId = String(existing.meta.fileId);
      continue;
    }

    const created = (await drive.files.create({
      requestBody: {
        name: segment,
        mimeType: "application/vnd.google-apps.folder",
        parents: parentId ? [parentId] : undefined,
      },
      fields: "id",
    })) as { data: { id?: string | null } };

    parentId = created.data.id ?? null;
  }

  return parentId;
}

export async function uploadFilesToConnectedGoogleDrive(
  userId: string,
  files: File[],
  folderPath = "",
) {
  const target = await getGoogleUploadTargetForPathAsync(userId, folderPath);

  if (!target?.refresh_token) {
    throw new Error("No connected hidden Google accounts are ready for Drive uploads yet.");
  }

  let uploaded = 0;
  const auth = createOAuthClient(target.refresh_token);
  const drive = google.drive({ version: "v3", auth });
  const parentId = await ensureGoogleFolderPath(userId, target.id, folderPath, auth);

  for (const file of files) {
    if (!file || file.size === 0) {
      continue;
    }
    const buffer = Buffer.from(await file.arrayBuffer());

    await drive.files.create({
      requestBody: {
        name: file.name,
        parents: parentId ? [parentId] : undefined,
      },
      media: {
        mimeType: file.type || "application/octet-stream",
        body: Readable.from(buffer),
      },
      fields: "id",
    });

    uploaded += 1;
    target.used_bytes += file.size;
  }

  try {
    await syncAssignedGoogleAccountsForUser(userId);
  } catch {
    // The Google write already succeeded, so we keep the user-facing result as success
    // and let them manually refresh if the follow-up sync has a temporary issue.
  }
  return uploaded;
}

export async function createGoogleDriveFolder(userId: string, folderName: string, parentFolderPath = "") {
  const target = await getGoogleUploadTargetForPathAsync(userId, parentFolderPath);

  if (!target?.refresh_token) {
    throw new Error("No connected hidden Google accounts are ready for folder creation yet.");
  }

  const auth = createOAuthClient(target.refresh_token);
  const drive = google.drive({ version: "v3", auth });
  const parentId = await ensureGoogleFolderPath(userId, target.id, parentFolderPath, auth);

  await drive.files.create({
    requestBody: {
      name: folderName,
      mimeType: "application/vnd.google-apps.folder",
      parents: parentId ? [parentId] : undefined,
    },
    fields: "id",
  });

  try {
    await syncAssignedGoogleAccountsForUser(userId);
  } catch {
    // Folder creation already succeeded in Google Drive; ignore refresh-only failures.
  }
}

export async function saveVaultNoteToGoogleDrive(input: {
  userId: string;
  itemId?: string;
  title: string;
  content: string;
}) {
  const existing = input.itemId ? await getVaultItemByIdAsync(input.userId, input.itemId) : null;
  const target = await getWritableGoogleTarget(input.userId, existing?.sourceAccountId ?? null);
  const auth = createOAuthClient(target.refresh_token);
  const drive = google.drive({ version: "v3", auth });
  const parentId = await ensureGoogleFolderPath(input.userId, target.id, INTERNAL_NOTES_PATH, auth);
  const fileName = `${sanitizeGoogleFileName(input.title || "Note")}.txt`;
  const contentBuffer = Buffer.from(input.content, "utf8");

  let uploadResult:
    | { data: { id?: string | null; webViewLink?: string | null; mimeType?: string | null } }
    | undefined;

  const existingFileId =
    existing?.sourceAccountId === target.id && typeof existing.meta?.fileId === "string"
      ? existing.meta.fileId
      : null;

  if (existingFileId) {
    uploadResult = (await drive.files.update({
      fileId: existingFileId,
      requestBody: {
        name: fileName,
      },
      media: {
        mimeType: "text/plain",
        body: Readable.from(contentBuffer),
      },
      fields: "id,webViewLink,mimeType",
    })) as { data: { id?: string | null; webViewLink?: string | null; mimeType?: string | null } };
  } else {
    uploadResult = (await drive.files.create({
      requestBody: {
        name: fileName,
        parents: parentId ? [parentId] : undefined,
      },
      media: {
        mimeType: "text/plain",
        body: Readable.from(contentBuffer),
      },
      fields: "id,webViewLink,mimeType",
    })) as { data: { id?: string | null; webViewLink?: string | null; mimeType?: string | null } };
  }

  return upsertVaultNoteAsync({
    userId: input.userId,
    itemId: input.itemId,
    title: input.title,
    content: input.content,
    bytes: contentBuffer.byteLength,
    itemKind: "note",
    source: "google-drive-note",
    sourceAccountId: target.id,
    subtitle: input.content.slice(0, 180),
    meta: {
      fileId: uploadResult.data.id ?? existingFileId,
      originalType: uploadResult.data.mimeType ?? "text/plain",
      webViewLink: uploadResult.data.webViewLink ?? "",
      folderPath: INTERNAL_NOTES_PATH,
      googleManaged: true,
      originalName: fileName,
    },
  });
}

export async function saveVaultAudioNoteToGoogleDrive(input: {
  userId: string;
  title: string;
  file: File;
  durationMs?: number;
}) {
  const target = await getWritableGoogleTarget(input.userId);
  const auth = createOAuthClient(target.refresh_token);
  const drive = google.drive({ version: "v3", auth });
  const parentId = await ensureGoogleFolderPath(input.userId, target.id, INTERNAL_VOICE_NOTES_PATH, auth);
  const buffer = Buffer.from(await input.file.arrayBuffer());
  const actualMimeType = input.file.type || "audio/webm";
  const baseName = sanitizeGoogleFileName(input.title || "Voice Note");
  const fileName = `${baseName}.${extensionForMimeType(actualMimeType)}`;

  const uploadResult = (await drive.files.create({
    requestBody: {
      name: fileName,
      parents: parentId ? [parentId] : undefined,
    },
    media: {
      mimeType: actualMimeType,
      body: Readable.from(buffer),
    },
    fields: "id,webViewLink,mimeType",
  })) as { data: { id?: string | null; webViewLink?: string | null; mimeType?: string | null } };

  return createVaultAudioNoteRecordAsync({
    userId: input.userId,
    title: input.title || "Voice Note",
    bytes: buffer.byteLength,
    source: "google-drive-audio-note",
    sourceAccountId: target.id,
    subtitle:
      input.durationMs && input.durationMs > 0
        ? `Voice note - ${Math.round(input.durationMs / 1000)}s`
        : "Voice note",
    meta: {
      fileId: uploadResult.data.id ?? null,
      originalType: uploadResult.data.mimeType ?? actualMimeType,
      webViewLink: uploadResult.data.webViewLink ?? "",
      folderPath: INTERNAL_VOICE_NOTES_PATH,
      googleManaged: true,
      durationMs: input.durationMs ?? 0,
      originalName: fileName,
    },
  });
}

export async function loadGoogleDriveFile(accountId: string, fileId: string) {
  const account = await getSourceGoogleAccountByIdAsync(accountId);

  if (!account?.refresh_token) {
    throw new Error("Connected Google account not found for this file.");
  }

  const auth = createOAuthClient(account.refresh_token);
  const drive = google.drive({ version: "v3", auth });
  const metadata = await drive.files.get({
    fileId,
    fields: "id,name,mimeType,webViewLink,thumbnailLink",
  });
  const mimeType = metadata.data.mimeType ?? "application/octet-stream";

  if (mimeType.startsWith("application/vnd.google-apps")) {
    return {
      kind: "link" as const,
      mimeType,
      fileName: metadata.data.name ?? "Google file",
      webViewLink: metadata.data.webViewLink ?? null,
      thumbnailLink: metadata.data.thumbnailLink ?? null,
    };
  }

  const media = await drive.files.get(
    {
      fileId,
      alt: "media",
    },
    {
      responseType: "arraybuffer",
    },
  );

  return {
    kind: "binary" as const,
    mimeType,
    fileName: metadata.data.name ?? "download",
    buffer: Buffer.from(media.data as ArrayBuffer),
  };
}

export async function deleteGoogleDriveFile(accountId: string, fileId: string) {
  const account = await getSourceGoogleAccountByIdAsync(accountId);

  if (!account?.refresh_token) {
    throw new Error("Connected Google account not found for this file.");
  }

  const auth = createOAuthClient(account.refresh_token);
  const drive = google.drive({ version: "v3", auth });
  await drive.files.delete({ fileId });
}

function decodeBase64Url(input: string) {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return Buffer.from(padded, "base64").toString("utf8");
}

function extractMessageBody(payload: Record<string, unknown> | null | undefined): { text: string; html: string } {
  if (!payload) {
    return { text: "", html: "" };
  }

  const body = payload.body as Record<string, unknown> | undefined;
  const mimeType = typeof payload.mimeType === "string" ? payload.mimeType : "";
  const data = typeof body?.data === "string" ? body.data : null;
  const parts = Array.isArray(payload.parts) ? (payload.parts as Record<string, unknown>[]) : [];

  if (data) {
    const decoded = decodeBase64Url(data);
    if (mimeType === "text/html") {
      return { text: "", html: decoded };
    }
    return { text: decoded, html: "" };
  }

  return parts.reduce<{ text: string; html: string }>(
    (acc, part) => {
      const child = extractMessageBody(part);
      return {
        text: acc.text || child.text,
        html: acc.html || child.html,
      };
    },
    { text: "", html: "" },
  );
}

export async function loadFullGmailMessage(accountId: string, messageId: string) {
  const account = await getSourceGoogleAccountByIdAsync(accountId);

  if (!account?.refresh_token) {
    throw new Error("Connected Gmail account not found for this message.");
  }

  const auth = createOAuthClient(account.refresh_token);
  const gmail = google.gmail({ version: "v1", auth });
  const result = await gmail.users.messages.get({
    userId: "me",
    id: messageId,
    format: "full",
  });

  const payload = (result.data.payload ?? null) as Record<string, unknown> | null;
  const headers = Array.isArray(payload?.headers) ? (payload?.headers as Array<{ name?: string; value?: string }>) : [];
  const body = extractMessageBody(payload);

  return {
    snippet: result.data.snippet ?? "",
    text: body.text,
    html: body.html,
    from: headers.find((header) => header.name === "From")?.value ?? "",
    to: headers.find((header) => header.name === "To")?.value ?? "",
    subject: headers.find((header) => header.name === "Subject")?.value ?? "",
    date: headers.find((header) => header.name === "Date")?.value ?? "",
  };
}
