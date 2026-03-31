"use server";

import { redirect } from "next/navigation";
import { clearSession, createSession, requireAdmin, requireUser } from "@/lib/auth";
import {
  createGoogleDriveFolder,
  deleteGoogleDriveFile,
  saveVaultNoteToGoogleDrive,
  syncAssignedGoogleAccountsForUser,
  uploadFilesToConnectedGoogleDrive,
} from "@/lib/google";
import {
  createAuditLog,
  createAuditLogAsync,
  createAppleAccountLink,
  authenticateUser,
  createHiddenAccountAssignmentAsync,
  createManagedMember,
  createSyncRunAsync,
  deleteVaultItemAndRelated,
  getVaultItemByIdAsync,
  disconnectHiddenGoogleAccountAsync,
  deleteHiddenAccountAssignmentAsync,
  deleteManagedMember,
  deleteManagedMemberAsync,
  importVaultFiles,
  listManagedMembers,
  queueAppleImport,
  resetOwnPassword,
  resetManagedMemberPassword,
  upsertVaultPassword,
  updateHiddenAccountAssignmentAsync,
  updateManagedMember,
} from "@/lib/repository";

export async function loginAction(formData: FormData) {
  const identifier = String(formData.get("identifier") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "").trim();

  const user = await authenticateUser(identifier, password);

  if (!user) {
    redirect("/?error=invalid");
  }

  await createSession(user.id);
  redirect(user.isAdmin ? "/admin/dashboard" : "/dashboard");
}

export async function adminLoginAction(formData: FormData) {
  const identifier = String(formData.get("identifier") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "").trim();

  const user = await authenticateUser(identifier, password);

  if (!user || !user.isAdmin) {
    redirect("/admin?error=invalid");
  }

  await createSession(user.id);
  redirect("/admin/dashboard");
}

export async function logoutAction() {
  await clearSession();
  redirect("/");
}

export async function requestIcloudSyncAction(formData: FormData) {
  const userId = String(formData.get("userId") ?? "");
  queueAppleImport({ userId, appleAccountId: null });
  await createSyncRunAsync(userId, "icloud", "queued", "iCloud sync was requested from the dashboard.");
  redirect("/dashboard?sync=queued");
}

export async function requestGoogleSyncAction(formData: FormData) {
  const userId = String(formData.get("userId") ?? "");
  const result = await syncAssignedGoogleAccountsForUser(userId);
  const status =
    result.status === "success"
      ? "google-success"
      : result.status === "error"
        ? "google-error"
        : "google-skipped";
  const params = new URLSearchParams({ sync: status });
  if (result.message) {
    params.set("message", result.message);
  }
  redirect(`/dashboard?${params.toString()}`);
}

export async function createManagedMemberAction(formData: FormData) {
  const admin = await requireAdmin();
  const username = String(formData.get("username") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "").trim();
  const fullName = String(formData.get("fullName") ?? "").trim();

  if (!username || !email || !password || !fullName) {
    redirect("/admin/dashboard?admin=member-invalid");
  }

  try {
    const userId = await createManagedMember({ username, email, password, fullName });
    await createAuditLogAsync({
      actorUserId: admin.id,
      targetUserId: userId,
      action: "member.create",
      details: `Created member ${username}.`,
    });
    redirect("/admin/dashboard?admin=member-created");
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : "";
    const isDuplicate =
      message.includes("unique") ||
      message.includes("duplicate") ||
      message.includes("already exists");
    redirect(`/admin/dashboard?admin=${isDuplicate ? "member-duplicate" : "member-error"}`);
  }
}

export async function addHiddenAccountAction(formData: FormData) {
  const admin = await requireAdmin();
  const userId = String(formData.get("userId") ?? "").trim();
  const label = String(formData.get("label") ?? "").trim();
  const googleEmail = String(formData.get("googleEmail") ?? "").trim();
  const accountPassword = String(formData.get("accountPassword") ?? "");

  if (!userId || !label || !googleEmail) {
    redirect("/admin/dashboard?admin=account-invalid");
  }

  await createHiddenAccountAssignmentAsync({
    userId,
    label,
    googleEmail,
    accountPassword,
  });
  await createAuditLogAsync({
    actorUserId: admin.id,
    targetUserId: userId,
    action: "google-account.create",
    details: `Assigned hidden Google account ${googleEmail}.`,
  });

  redirect("/admin/dashboard?admin=account-added");
}

export async function linkAppleAccountAction(formData: FormData) {
  const userId = String(formData.get("userId") ?? "").trim();
  const label = String(formData.get("label") ?? "").trim();
  const appleEmail = String(formData.get("appleEmail") ?? "").trim().toLowerCase();

  if (!userId || !label || !appleEmail) {
    redirect("/dashboard?sync=apple-invalid");
  }

  createAppleAccountLink({ userId, label, appleEmail });
  await createSyncRunAsync(userId, "icloud", "linked", `Apple account ${appleEmail} linked to the vault.`);
  redirect("/dashboard?sync=apple-linked");
}

export async function queueAppleAccountImportAction(formData: FormData) {
  const userId = String(formData.get("userId") ?? "").trim();
  const appleAccountId = String(formData.get("appleAccountId") ?? "").trim();

  if (!userId) {
    redirect("/dashboard?sync=apple-invalid");
  }

  queueAppleImport({ userId, appleAccountId: appleAccountId || null });
  await createSyncRunAsync(userId, "icloud", "queued", "Apple account import was queued from the dashboard.");
  redirect("/dashboard?sync=apple-queued");
}

export async function updateManagedMemberAction(formData: FormData) {
  const admin = await requireAdmin();
  const userId = String(formData.get("userId") ?? "").trim();
  const username = String(formData.get("username") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const fullName = String(formData.get("fullName") ?? "").trim();
  const roleLabel = String(formData.get("roleLabel") ?? "").trim() || "Private Vault Member";

  if (!userId || !username || !email || !fullName) {
    redirect("/admin/dashboard?admin=member-invalid");
  }

  try {
    updateManagedMember({ userId, username, email, fullName, roleLabel });
    createAuditLog({
      actorUserId: admin.id,
      targetUserId: userId,
      action: "member.update",
      details: `Updated member ${username}.`,
    });
    redirect("/admin/dashboard?admin=member-updated");
  } catch {
    redirect("/admin/dashboard?admin=member-error");
  }
}

export async function deleteManagedMemberAction(formData: FormData) {
  const admin = await requireAdmin();
  const userId = String(formData.get("userId") ?? "").trim();
  if (!userId) {
    redirect("/admin/dashboard?admin=member-invalid");
  }

  await createAuditLogAsync({
    actorUserId: admin.id,
    action: "member.delete",
    details: `Deleted member ${userId}.`,
  });
  await deleteManagedMemberAsync(userId);
  redirect("/admin/dashboard?admin=member-deleted");
}

export async function updateHiddenAccountAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "").trim();
  const label = String(formData.get("label") ?? "").trim();
  const googleEmail = String(formData.get("googleEmail") ?? "").trim();
  const accountPassword = String(formData.get("accountPassword") ?? "");

  if (!id || !label || !googleEmail) {
    redirect("/admin/dashboard?admin=account-invalid");
  }

  await updateHiddenAccountAssignmentAsync({ id, label, googleEmail, accountPassword });
  await createAuditLogAsync({
    actorUserId: admin.id,
    action: "google-account.update",
    details: `Updated hidden Google account ${googleEmail}.`,
  });
  redirect("/admin/dashboard?admin=account-updated");
}

export async function deleteHiddenAccountAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) {
    redirect("/admin/dashboard?admin=account-invalid");
  }

  await deleteHiddenAccountAssignmentAsync(id);
  await createAuditLogAsync({
    actorUserId: admin.id,
    action: "google-account.delete",
    details: `Deleted hidden Google account ${id}.`,
  });
  redirect("/admin/dashboard?admin=account-deleted");
}

export async function disconnectGoogleAccountAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "").trim();

  if (!id) {
    redirect("/admin/google?google=missing-params");
  }

  await disconnectHiddenGoogleAccountAsync(id);
  await createAuditLogAsync({
    actorUserId: admin.id,
    action: "google-account.disconnect",
    details: `Disconnected hidden Google account ${id}.`,
  });
  redirect("/admin/google?google=disconnected");
}

export async function resetMemberPasswordAction(formData: FormData) {
  const admin = await requireAdmin();
  const userId = String(formData.get("userId") ?? "").trim();
  const password = String(formData.get("password") ?? "").trim();

  if (!userId || !password) {
    redirect("/admin/dashboard?admin=password-invalid");
  }

  await resetManagedMemberPassword(userId, password);
  createAuditLog({
    actorUserId: admin.id,
    targetUserId: userId,
    action: "member.password-reset",
    details: "Reset member password from admin dashboard.",
  });
  redirect("/admin/dashboard?admin=password-reset");
}

export async function importApplePhotosAction(formData: FormData) {
  const userId = String(formData.get("userId") ?? "").trim();
  const entries = formData.getAll("files").filter((entry): entry is File => entry instanceof File);

  if (!userId || entries.length === 0) {
    redirect("/dashboard?sync=apple-import-invalid");
  }

  const imported = await importVaultFiles({
    userId,
    section: "photos",
    source: "apple-photo-picker",
    files: entries,
  });

    await createSyncRunAsync(
      userId,
      "apple-import",
      imported > 0 ? "success" : "skipped",
    `Imported ${imported} photo/video file(s) through the browser picker.`,
  );
  redirect(`/dashboard?sync=${imported > 0 ? "apple-imported" : "apple-import-invalid"}`);
}

export async function importAppleFilesAction(formData: FormData) {
  const userId = String(formData.get("userId") ?? "").trim();
  const entries = formData.getAll("files").filter((entry): entry is File => entry instanceof File);

  if (!userId || entries.length === 0) {
    redirect("/dashboard?sync=file-import-invalid");
  }

  const imported = await importVaultFiles({
    userId,
    section: "drive",
    source: "apple-file-picker",
    files: entries,
  });

    await createSyncRunAsync(
      userId,
      "apple-files",
      imported > 0 ? "success" : "skipped",
    `Imported ${imported} file(s) through the browser file picker.`,
  );
  redirect(`/dashboard?sync=${imported > 0 ? "file-imported" : "file-import-invalid"}`);
}

export async function uploadFilesToGoogleDriveAction(formData: FormData) {
  const user = await requireUser();
  const entries = formData.getAll("files").filter((entry): entry is File => entry instanceof File);
  const folderPath = String(formData.get("folderPath") ?? "").trim();
  const redirectTo = String(formData.get("redirectTo") ?? "/dashboard");

  if (entries.length === 0) {
    redirect(`${redirectTo}?sync=google-upload-invalid`);
  }

    try {
      const uploaded = await uploadFilesToConnectedGoogleDrive(user.id, entries, folderPath);
      await createSyncRunAsync(
        user.id,
        "google-upload",
      uploaded > 0 ? "success" : "skipped",
      `Uploaded ${uploaded} file(s) directly into the connected Google Drive pool.`,
      );
      redirect(`${redirectTo}?sync=${uploaded > 0 ? "google-uploaded" : "google-upload-invalid"}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Google Drive upload failed.";
      await createSyncRunAsync(user.id, "google-upload", "error", message);
      redirect(`${redirectTo}?sync=google-upload-error&message=${encodeURIComponent(message)}`);
    }
  }

export async function createDriveFolderAction(formData: FormData) {
  const user = await requireUser();
  const folderName = String(formData.get("folderName") ?? "").trim();
  const folderPath = String(formData.get("folderPath") ?? "").trim();
  const redirectTo = String(formData.get("redirectTo") ?? "/vault/drive");

  if (!folderName) {
    redirect(`${redirectTo}?drive=folder-invalid`);
  }

  try {
    await createGoogleDriveFolder(user.id, folderName, folderPath);
    redirect(`${redirectTo}?drive=folder-created`);
  } catch {
    redirect(`${redirectTo}?drive=folder-error`);
  }
}

export async function resetOwnPasswordAction(formData: FormData) {
  const user = await requireUser();
  const currentPassword = String(formData.get("currentPassword") ?? "").trim();
  const nextPassword = String(formData.get("nextPassword") ?? "").trim();
  const confirmPassword = String(formData.get("confirmPassword") ?? "").trim();

  if (!currentPassword || !nextPassword || nextPassword !== confirmPassword) {
    redirect("/dashboard?sync=password-invalid");
  }

  try {
    await resetOwnPassword(user.id, currentPassword, nextPassword);
    redirect("/dashboard?sync=password-updated");
  } catch {
    redirect("/dashboard?sync=password-error");
  }
}

export async function saveVaultNoteAction(formData: FormData) {
  const user = await requireUser();
  const itemId = String(formData.get("itemId") ?? "").trim() || undefined;
  const title = String(formData.get("title") ?? "").trim();
  const content = String(formData.get("content") ?? "").trim();

  if (!title || !content) {
    redirect("/vault/notes?note=invalid");
  }

  try {
    await saveVaultNoteToGoogleDrive({
      userId: user.id,
      itemId,
      title,
      content,
    });
    redirect("/vault/notes?note=saved");
  } catch {
    redirect("/vault/notes?note=save-error");
  }
}

export async function saveVaultPasswordAction(formData: FormData) {
  const user = await requireUser();
  const itemId = String(formData.get("itemId") ?? "").trim() || undefined;
  const label = String(formData.get("label") ?? "").trim();
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "").trim();
  const website = String(formData.get("website") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();

  if (!label || !username || (!itemId && !password)) {
    redirect("/vault/passwords?password=invalid");
  }

  upsertVaultPassword({
    userId: user.id,
    itemId,
    label,
    username,
    password,
    website,
    note,
  });
  redirect("/vault/passwords?password=saved");
}

export async function deleteVaultItemAction(formData: FormData) {
  const user = await requireUser();
  const itemId = String(formData.get("itemId") ?? "").trim();
  const redirectTo = String(formData.get("redirectTo") ?? "/dashboard");

  if (!itemId) {
    redirect(`${redirectTo}?item=delete-invalid`);
  }

  const target = await getVaultItemByIdAsync(user.id, itemId);

  if (!target) {
    redirect(`${redirectTo}?item=delete-missing`);
  }

  try {
    const fileId = typeof target.meta?.fileId === "string" ? target.meta.fileId : null;
    if (
      fileId &&
      target.sourceAccountId &&
      (target.source?.startsWith("google-drive") || target.source === "google-drive")
    ) {
      await deleteGoogleDriveFile(target.sourceAccountId, fileId);
    }
  } catch {
    redirect(`${redirectTo}?item=delete-error`);
  }

  deleteVaultItemAndRelated(user.id, itemId);

  if (target.section === "drive" || target.section === "photos" || target.section === "videos") {
    await syncAssignedGoogleAccountsForUser(user.id).catch(() => null);
  }

  redirect(`${redirectTo}?item=deleted`);
}
