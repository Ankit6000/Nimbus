import Link from "next/link";
import {
  requestGoogleSyncAction,
  resetOwnPasswordAction,
  uploadFilesToGoogleDriveAction,
} from "@/app/actions";
import { requireUser } from "@/lib/auth";
import { sectionMeta, SectionKey } from "@/lib/data";
import { PHOTO_VIDEO_ACCEPT } from "@/lib/file-types";
import { formatBytes, formatCompactNumber } from "@/lib/format";
import { buildUserStats } from "@/lib/stats";

type DashboardPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const sectionOrder: SectionKey[] = [
  "photos",
  "videos",
  "drive",
  "passwords",
  "notes",
  "messages",
  "mail",
];

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const user = await requireUser();
  const stats = buildUserStats(user);
  const params = searchParams ? await searchParams : undefined;
  const syncQueued = params?.sync === "queued";
  const googleSuccess = params?.sync === "google-success";
  const googleSkipped = params?.sync === "google-skipped";
  const googleError = params?.sync === "google-error";
  const googleUploaded = params?.sync === "google-uploaded";
  const googleUploadInvalid = params?.sync === "google-upload-invalid";
  const googleUploadError = params?.sync === "google-upload-error";
  const passwordUpdated = params?.sync === "password-updated";
  const passwordInvalid = params?.sync === "password-invalid";
  const passwordError = params?.sync === "password-error";
  const syncMessage =
    typeof params?.message === "string"
      ? params.message
      : Array.isArray(params?.message)
        ? params.message[0]
        : "";

  return (
    <div className="grid gap-6">
      <section className="grid items-start gap-6 xl:grid-cols-[1.4fr_0.8fr]">
        <div className="grid gap-4">
          <div className="self-start rounded-[32px] bg-[#1f1712] p-6 text-[#f8efe5] sm:p-7">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-2xl">
                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[#d4b69f]">
                  Combined Vault
                </p>
                <h1 className="font-heading mt-3 text-4xl font-semibold tracking-tight sm:text-[3.4rem]">
                  Welcome back, {user.fullName.split(" ")[0]}.
                </h1>
                <p className="mt-3 max-w-xl text-sm leading-7 text-[#dccfc4] sm:text-base">
                  One private dashboard for all assigned storage, files, mail, notes, and uploads.
                </p>
              </div>

              <div className="grid w-full max-w-[290px] gap-3 sm:grid-cols-2 lg:grid-cols-1">
                <div className="rounded-[24px] bg-[rgba(255,255,255,0.06)] px-5 py-4">
                  <p className="text-[11px] uppercase tracking-[0.26em] text-[#c9ab93]">Used</p>
                  <div className="mt-3 flex items-end justify-between gap-3">
                    <p className="text-4xl font-semibold">{stats.percentageUsed}%</p>
                    <p className="pb-1 text-sm text-[#cdb9a8]">{formatBytes(stats.usedStorage)}</p>
                  </div>
                </div>
                <div className="rounded-[24px] bg-[rgba(255,255,255,0.06)] px-5 py-4">
                  <p className="text-[11px] uppercase tracking-[0.26em] text-[#c9ab93]">Space left</p>
                  <p className="mt-3 text-3xl font-semibold">{formatBytes(stats.freeStorage)}</p>
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-4">
              <div className="rounded-[22px] bg-[#2c2119] p-4">
                <p className="text-[11px] uppercase tracking-[0.24em] text-[#c9ab93]">Total space</p>
                <p className="mt-2 text-2xl font-semibold">{formatBytes(stats.totalStorage)}</p>
              </div>
              <div className="rounded-[22px] bg-[#2c2119] p-4">
                <p className="text-[11px] uppercase tracking-[0.24em] text-[#c9ab93]">Photos</p>
                <p className="mt-2 text-2xl font-semibold">{formatCompactNumber(stats.photoCount)}</p>
              </div>
              <div className="rounded-[22px] bg-[#2c2119] p-4">
                <p className="text-[11px] uppercase tracking-[0.24em] text-[#c9ab93]">Mail items</p>
                <p className="mt-2 text-2xl font-semibold">{formatCompactNumber(stats.mailCount)}</p>
              </div>
              <div className="rounded-[22px] bg-[#2c2119] p-4">
                <p className="text-[11px] uppercase tracking-[0.24em] text-[#c9ab93]">Passwords</p>
                <p className="mt-2 text-2xl font-semibold">{formatCompactNumber(stats.passwordCount)}</p>
              </div>
            </div>
          </div>

          <div className="rounded-[32px] border border-[#ead9c8] bg-[#fffaf2] p-6">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-xl">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#8b6d52]">
                  Quick Access
                </p>
                <h2 className="font-heading mt-3 text-3xl font-semibold text-[#241b14]">
                  Jump straight into the vault
                </h2>
                <p className="mt-3 text-sm leading-6 text-[#5b4635]">
                  Open the areas you use most often, or scan the section counts to see where your storage is actually going.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[320px]">
                <Link
                  href="/vault/photos"
                  className="rounded-[24px] bg-[#f7f0e7] px-4 py-4 transition hover:bg-[#efe4d7]"
                >
                  <p className="text-[11px] uppercase tracking-[0.22em] text-[#8b6d52]">Photos</p>
                  <p className="mt-2 text-2xl font-semibold text-[#241b14]">{formatCompactNumber(stats.photoCount)}</p>
                  <p className="mt-1 text-sm text-[#5b4635]">Gallery and image uploads</p>
                </Link>
                <Link
                  href="/vault/drive"
                  className="rounded-[24px] bg-[#f7f0e7] px-4 py-4 transition hover:bg-[#efe4d7]"
                >
                  <p className="text-[11px] uppercase tracking-[0.22em] text-[#8b6d52]">Files</p>
                  <p className="mt-2 text-2xl font-semibold text-[#241b14]">{formatCompactNumber(stats.bySection.drive.count)}</p>
                  <p className="mt-1 text-sm text-[#5b4635]">All files and folders in your vault</p>
                </Link>
                <Link
                  href="/vault/notes"
                  className="rounded-[24px] bg-[#f7f0e7] px-4 py-4 transition hover:bg-[#efe4d7]"
                >
                  <p className="text-[11px] uppercase tracking-[0.22em] text-[#8b6d52]">Notes</p>
                  <p className="mt-2 text-2xl font-semibold text-[#241b14]">{formatCompactNumber(stats.bySection.notes.count)}</p>
                  <p className="mt-1 text-sm text-[#5b4635]">Text notes and voice notes</p>
                </Link>
                <Link
                  href="/activity"
                  className="rounded-[24px] bg-[#f7f0e7] px-4 py-4 transition hover:bg-[#efe4d7]"
                >
                  <p className="text-[11px] uppercase tracking-[0.22em] text-[#8b6d52]">Recent Activity</p>
                  <p className="mt-2 text-2xl font-semibold text-[#241b14]">{formatCompactNumber(stats.bySection.photos.count + stats.bySection.videos.count + stats.bySection.drive.count)}</p>
                  <p className="mt-1 text-sm text-[#5b4635]">Latest uploads and synced items</p>
                </Link>
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-[22px] border border-[#ead9c8] bg-white px-4 py-4">
                <p className="text-[11px] uppercase tracking-[0.22em] text-[#8b6d52]">Videos</p>
                <p className="mt-2 text-2xl font-semibold text-[#241b14]">{formatCompactNumber(stats.videoCount)}</p>
                <p className="mt-1 text-sm text-[#5b4635]">{formatBytes(stats.bySection.videos.used)}</p>
              </div>
              <div className="rounded-[22px] border border-[#ead9c8] bg-white px-4 py-4">
                <p className="text-[11px] uppercase tracking-[0.22em] text-[#8b6d52]">Notes Storage</p>
                <p className="mt-2 text-2xl font-semibold text-[#241b14]">{formatCompactNumber(stats.bySection.notes.count)}</p>
                <p className="mt-1 text-sm text-[#5b4635]">{formatBytes(stats.bySection.notes.used)}</p>
              </div>
              <div className="rounded-[22px] border border-[#ead9c8] bg-white px-4 py-4">
                <p className="text-[11px] uppercase tracking-[0.22em] text-[#8b6d52]">Mail Storage</p>
                <p className="mt-2 text-2xl font-semibold text-[#241b14]">{formatCompactNumber(stats.mailCount)}</p>
                <p className="mt-1 text-sm text-[#5b4635]">{formatBytes(stats.bySection.mail.used)}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4">
          <div className="rounded-[32px] border border-[#ead9c8] bg-[#fffaf2] p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#8b6d52]">
              Vault Refresh
            </p>
            <h2 className="font-heading mt-3 text-3xl font-semibold text-[#241b14]">
              Refresh your vault
            </h2>
            <p className="mt-3 text-sm leading-6 text-[#5b4635]">
              Pull the latest storage, file, and mailbox changes into your vault.
            </p>

            {googleSuccess ? (
              <p className="mt-4 rounded-2xl border border-[#9bc5af] bg-[#e3f3ea] px-4 py-3 text-sm text-[#335443]">
                {syncMessage || "Refresh completed. Fresh storage and mailbox data has been pulled into your vault."}
              </p>
            ) : null}

            {googleSkipped ? (
              <p className="mt-4 rounded-2xl border border-[#d4bf7f] bg-[#f7efd0] px-4 py-3 text-sm text-[#6c5821]">
                {syncMessage || "Refresh was skipped because the assigned storage channels are not fully connected yet."}
              </p>
            ) : null}

            {googleError ? (
              <p className="mt-4 rounded-2xl border border-[#d89a8d] bg-[#f7e1dc] px-4 py-3 text-sm text-[#7b3d31]">
                {syncMessage || "Refresh failed while talking to one of the connected accounts."}
              </p>
            ) : null}

            {googleUploaded ? (
              <p className="mt-4 rounded-2xl border border-[#9bc5af] bg-[#e3f3ea] px-4 py-3 text-sm text-[#335443]">
                Files were uploaded and your vault view was refreshed.
              </p>
            ) : null}

            {googleUploadInvalid ? (
              <p className="mt-4 rounded-2xl border border-[#d89a8d] bg-[#f7e1dc] px-4 py-3 text-sm text-[#7b3d31]">
                Choose at least one local file before uploading.
              </p>
            ) : null}

              {googleUploadError ? (
                <p className="mt-4 rounded-2xl border border-[#d89a8d] bg-[#f7e1dc] px-4 py-3 text-sm text-[#7b3d31]">
                  {syncMessage || "Upload failed. Reconnect the assigned storage channel, then try again."}
                </p>
              ) : null}

            <form action={requestGoogleSyncAction} className="mt-5">
              <input type="hidden" name="userId" value={user.id} />
              <button
                type="submit"
                className="rounded-full bg-[#436b5c] px-5 py-3 text-sm font-semibold text-[#f7f2ea] transition hover:bg-[#355548]"
              >
                Refresh Vault
              </button>
            </form>

            <div className="mt-5 rounded-2xl bg-[#f7f0e7] px-4 py-4 text-sm text-[#5b4635]">
              All uploads now live in the Imports area below so everything stays in one place.
            </div>
          </div>

          <div className="rounded-[32px] border border-[#ead9c8] bg-[#fffaf2] p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#8b6d52]">
              Account Security
            </p>
            <h2 className="font-heading mt-3 text-3xl font-semibold text-[#241b14]">
              Reset your password
            </h2>
            <p className="mt-3 text-sm leading-6 text-[#5b4635]">
              Change the vault password you use for this member account.
            </p>

            {passwordUpdated ? (
              <p className="mt-4 rounded-2xl border border-[#9bc5af] bg-[#e3f3ea] px-4 py-3 text-sm text-[#335443]">
                Your password has been updated.
              </p>
            ) : null}

            {passwordInvalid ? (
              <p className="mt-4 rounded-2xl border border-[#d89a8d] bg-[#f7e1dc] px-4 py-3 text-sm text-[#7b3d31]">
                Fill in all password fields and make sure the new password matches the confirmation.
              </p>
            ) : null}

            {passwordError ? (
              <p className="mt-4 rounded-2xl border border-[#d89a8d] bg-[#f7e1dc] px-4 py-3 text-sm text-[#7b3d31]">
                Password reset failed. Double-check your current password and try again.
              </p>
            ) : null}

            <form action={resetOwnPasswordAction} className="mt-5 grid gap-3">
              <input
                name="currentPassword"
                type="password"
                placeholder="Current password"
                className="rounded-2xl border border-[#d8c2ae] bg-[#f7f0e7] px-4 py-3 text-sm text-[#241b14] outline-none"
              />
              <input
                name="nextPassword"
                type="password"
                placeholder="New password"
                className="rounded-2xl border border-[#d8c2ae] bg-[#f7f0e7] px-4 py-3 text-sm text-[#241b14] outline-none"
              />
              <input
                name="confirmPassword"
                type="password"
                placeholder="Confirm new password"
                className="rounded-2xl border border-[#d8c2ae] bg-[#f7f0e7] px-4 py-3 text-sm text-[#241b14] outline-none"
              />
              <button
                type="submit"
                className="w-fit rounded-full bg-[#436b5c] px-5 py-3 text-sm font-semibold text-[#f7f2ea] transition hover:bg-[#355548]"
              >
                Update Password
              </button>
            </form>
          </div>
        </div>
      </section>

      <section className="rounded-[32px] border border-[#ead9c8] bg-[#fffaf2] p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#8b6d52]">
            Imports
          </p>
          <h2 className="font-heading mt-3 text-3xl font-semibold text-[#241b14]">
            Upload Into Your Vault
          </h2>
          <p className="mt-3 text-sm leading-6 text-[#5b4635]">
            Everything uploaded here is added to your vault library. After refresh, images and videos appear in Photos, while documents and other files appear in Files.
          </p>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <form action={uploadFilesToGoogleDriveAction} className="rounded-2xl bg-[#f7f0e7] p-4">
              <p className="font-heading text-2xl font-semibold text-[#241b14]">
                Upload Photos And Videos
              </p>
              <p className="mt-2 text-sm text-[#5b4635]">
                Send local photos and videos into your vault library. After refresh, they show up in Photos.
              </p>
              <input
                name="files"
                type="file"
                multiple
                accept={PHOTO_VIDEO_ACCEPT}
                className="mt-4 block w-full rounded-2xl border border-[#ddccb9] bg-white px-4 py-3 text-sm"
              />
              <button
                type="submit"
                className="mt-4 rounded-full bg-[#241b14] px-5 py-3 text-sm font-semibold text-[#fff6ed]"
              >
                Upload Media
              </button>
            </form>

            <form action={uploadFilesToGoogleDriveAction} className="rounded-2xl bg-[#f7f0e7] p-4">
              <p className="font-heading text-2xl font-semibold text-[#241b14]">
                Upload Files
              </p>
              <p className="mt-2 text-sm text-[#5b4635]">
                Send local files and documents into your vault library. After refresh, they show up in Files.
              </p>
              <input
                name="files"
                type="file"
                multiple
                className="mt-4 block w-full rounded-2xl border border-[#ddccb9] bg-white px-4 py-3 text-sm"
              />
              <button
                type="submit"
                className="mt-4 rounded-full bg-[#436b5c] px-5 py-3 text-sm font-semibold text-[#f7f2ea]"
              >
                Upload Files
              </button>
            </form>
          </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        {sectionOrder.map((key) => {
          const meta = sectionMeta[key];
          const sectionStat = stats.bySection[key];

          return (
            <Link
              key={key}
              href={`/vault/${key}`}
              className="group rounded-[30px] border border-[#ead9c8] bg-[#fffaf2] p-5 transition hover:-translate-y-1 hover:shadow-xl"
            >
              <div className={`h-2 rounded-full bg-gradient-to-r ${meta.accent}`} />
              <div className="mt-5 flex items-start justify-between gap-4">
                <div>
                  <p className="font-heading text-3xl font-semibold text-[#241b14]">{meta.title}</p>
                  <p className="mt-3 text-sm leading-6 text-[#5b4635]">{meta.description}</p>
                </div>
                <div className="rounded-full bg-[#f4ebe0] px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[#8b6d52]">
                  {sectionStat.count}
                </div>
              </div>
              <div className="mt-5 flex items-center justify-between text-sm">
                <span className="text-[#8b6d52]">Used</span>
                <span className="font-semibold text-[#241b14]">{formatBytes(sectionStat.used)}</span>
              </div>
            </Link>
          );
        })}
      </section>
    </div>
  );
}
