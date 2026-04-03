import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { saveVaultNoteAction, saveVaultPasswordAction } from "@/app/actions";
import { GoogleUploadForm } from "@/components/google-upload-form";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { VaultSelectionScope } from "@/components/vault-selection-scope";
import { VaultItemMenu } from "@/components/vault-item-menu";
import { VoiceNoteRecorder } from "@/components/voice-note-recorder";
import { requireUser } from "@/lib/auth";
import { SectionKey, sectionMeta } from "@/lib/data";
import { PHOTO_ACCEPT, VIDEO_ACCEPT } from "@/lib/file-types";
import { formatBytes, formatDateTime } from "@/lib/format";
import { listVaultItemsBySectionAsync } from "@/lib/repository";
import { buildUserStats } from "@/lib/stats";

const validSections: SectionKey[] = [
  "photos",
  "videos",
  "drive",
  "passwords",
  "notes",
  "messages",
  "mail",
];

type VaultSectionPageProps = {
  params: Promise<{
    section: string;
  }>;
};

export default async function VaultSectionPage({ params }: VaultSectionPageProps) {
  const user = await requireUser();
  const { section } = await params;

  if (!validSections.includes(section as SectionKey)) {
    notFound();
  }

  const key = section as SectionKey;
  const meta = sectionMeta[key];
  const stats = buildUserStats(user).bySection[key];
  const items = await listVaultItemsBySectionAsync(user.id, key);

  return (
    <div className="grid min-w-0 gap-4 sm:gap-6">
      <section className="fluid-card-pad min-w-0 rounded-[26px] border border-[#ead9c8] bg-[#fffaf2] sm:rounded-[32px] sm:p-8">
        <div className={`h-2 rounded-full bg-gradient-to-r ${meta.accent}`} />
        <div className="mt-5 flex flex-col gap-5 lg:mt-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[#8b6d52]">
              Vault Section
            </p>
            <h1 className="font-heading fluid-hero-title mt-3 font-semibold tracking-tight text-[#241b14] sm:text-4xl">
              {meta.title}
            </h1>
            <p className="fluid-hero-copy mt-3 max-w-2xl text-[#5b4635] sm:mt-4 sm:text-base sm:leading-7">{meta.description}</p>
          </div>
          <div className="adaptive-stat-grid">
            <div className="rounded-2xl bg-[#f4ebe0] px-5 py-4">
              <p className="text-xs uppercase tracking-[0.22em] text-[#8b6d52]">Items</p>
              <p className="mt-2 text-xl font-semibold text-[#241b14] sm:text-2xl">{stats.count}</p>
            </div>
            <div className="rounded-2xl bg-[#f4ebe0] px-5 py-4">
              <p className="text-xs uppercase tracking-[0.22em] text-[#8b6d52]">Used</p>
              <p className="mt-2 text-xl font-semibold text-[#241b14] sm:text-2xl">{formatBytes(stats.used)}</p>
            </div>
          </div>
        </div>
      </section>

      {(key === "photos" || key === "videos") ? (
        <section className="fluid-card-pad min-w-0 rounded-[24px] border border-[#ead9c8] bg-[#fffaf2] sm:rounded-[28px] sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#8b6d52]">
                Upload
              </p>
              <h2 className="font-heading mt-2 text-[1.7rem] font-semibold text-[#241b14] sm:text-3xl">
                Add directly into your vault
              </h2>
              <p className="mt-2 text-sm leading-6 text-[#5b4635]">
                Upload from here and the files land in your vault library first, then appear in {meta.title} after refresh.
              </p>
            </div>
            <GoogleUploadForm
              folderPath=""
              redirectTo={`/vault/${key}`}
              accept={key === "photos" ? PHOTO_ACCEPT : VIDEO_ACCEPT}
              buttonLabel="Upload To Vault"
              buttonClassName="w-full rounded-full bg-[#241b14] px-5 py-3 text-sm font-semibold text-[#fff6ed] sm:w-fit"
              inputClassName="rounded-2xl border border-[#ddccb9] bg-white px-4 py-3 text-sm"
            />
          </div>
        </section>
      ) : null}

      {key === "notes" ? (
        <section className="fluid-card-pad grid gap-5 rounded-[24px] border border-[#ead9c8] bg-[#fffaf2] sm:rounded-[28px] sm:p-5 lg:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#8b6d52]">Create Text Note</p>
            <form action={saveVaultNoteAction} className="mt-4 grid gap-3">
              <input
                name="title"
                placeholder="Note title"
                className="rounded-2xl border border-[#ddccb9] bg-white px-4 py-3 outline-none"
              />
              <textarea
                name="content"
                placeholder="Write your note..."
                rows={6}
                className="rounded-2xl border border-[#ddccb9] bg-white px-4 py-3 outline-none"
              />
              <PendingSubmitButton
                idleLabel="Save Note"
                pendingLabel="Saving..."
                className="w-full rounded-full bg-[#241b14] px-5 py-3 text-sm font-semibold text-[#fff6ed] sm:w-fit"
              />
            </form>
          </div>
          <VoiceNoteRecorder uploadUrl="/api/notes/audio" redirectTo="/vault/notes" />
        </section>
      ) : null}

      {key === "passwords" ? (
        <section className="fluid-card-pad rounded-[24px] border border-[#ead9c8] bg-[#fffaf2] sm:rounded-[28px] sm:p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#8b6d52]">Save Password</p>
          <form action={saveVaultPasswordAction} className="mt-4 grid gap-3 md:grid-cols-2">
            <input name="label" placeholder="Label" className="rounded-2xl border border-[#ddccb9] bg-white px-4 py-3 outline-none" />
            <input name="website" placeholder="Website or app" className="rounded-2xl border border-[#ddccb9] bg-white px-4 py-3 outline-none" />
            <input name="username" placeholder="Username or email" className="rounded-2xl border border-[#ddccb9] bg-white px-4 py-3 outline-none" />
            <input name="password" type="password" placeholder="Password" className="rounded-2xl border border-[#ddccb9] bg-white px-4 py-3 outline-none" />
            <textarea name="note" placeholder="Optional note" rows={4} className="md:col-span-2 rounded-2xl border border-[#ddccb9] bg-white px-4 py-3 outline-none" />
            <PendingSubmitButton
              idleLabel="Save Password"
              pendingLabel="Saving..."
              className="w-full rounded-full bg-[#241b14] px-5 py-3 text-sm font-semibold text-[#fff6ed] md:w-fit"
            />
          </form>
        </section>
      ) : null}

      {items.length === 0 ? (
        <div className="rounded-[28px] border border-[#ead9c8] bg-[#fffaf2] p-6 text-sm text-[#5b4635]">
          No items have been stored in this section yet.
        </div>
      ) : null}

      {key === "photos" ? (
        <VaultSelectionScope empty={items.length === 0} scopeLabel="photos">
          <div className="adaptive-media-grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {items.map((item) => {
              const mimeType = typeof item.meta?.originalType === "string"
                ? item.meta.originalType
                : typeof item.meta?.mimeType === "string"
                  ? item.meta.mimeType
                  : "";
              const proxiedPreview = `/api/vault-file/${item.id}`;
              const canProxyPreview =
                typeof item.meta?.storedPath === "string" || typeof item.meta?.fileId === "string";
              const googleThumbnail =
                typeof item.meta?.thumbnailLink === "string" && item.meta.thumbnailLink
                  ? item.meta.thumbnailLink
                  : typeof item.meta?.iconLink === "string" && item.meta.iconLink
                    ? item.meta.iconLink
                    : null;
              const previewUrl = canProxyPreview ? proxiedPreview : googleThumbnail;
              const isVideo = item.itemKind === "video" || mimeType.startsWith("video/");

              return (
                <article
                  key={item.id}
                  data-item-id={item.id}
                  className="group relative min-w-0 overflow-hidden rounded-[24px] border border-[#ead9c8] bg-[#fffaf2] transition hover:-translate-y-1 hover:shadow-xl sm:rounded-[28px]"
                >
                  <div className="absolute right-3 top-3">
                    <VaultItemMenu item={item} redirectTo="/vault/photos" />
                  </div>
                  <Link href={`/vault/item/${item.id}`} className="block">
                  <div className="relative aspect-[1/1.08] bg-gradient-to-br from-[#f4c9b4] via-[#f7efe6] to-[#d6e7de] sm:aspect-[4/5]">
                    {previewUrl && !isVideo ? (
                      <Image
                        src={previewUrl}
                        alt={item.title}
                        fill
                        className="object-cover transition duration-300 group-hover:scale-[1.03]"
                        unoptimized
                      />
                    ) : null}
                    {previewUrl && isVideo && canProxyPreview ? (
                      <video
                        src={previewUrl}
                        className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                        muted
                        playsInline
                        loop
                        preload="metadata"
                        poster={googleThumbnail ?? undefined}
                      />
                    ) : null}
                    {previewUrl && isVideo && !canProxyPreview ? (
                      <Image
                        src={previewUrl}
                        alt={item.title}
                        fill
                        className="object-cover transition duration-300 group-hover:scale-[1.03]"
                        unoptimized
                      />
                    ) : null}
                    {!previewUrl ? (
                      <div className="flex h-full items-end p-5">
                        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8b6d52]">
                          {item.itemKind ?? "media"}
                        </p>
                      </div>
                    ) : null}
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent p-3.5 text-white sm:p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="line-clamp-2 break-all text-[13px] font-semibold sm:text-sm">{item.title}</p>
                        <span className="rounded-full bg-white/20 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]">
                          {isVideo ? "video" : "photo"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="grid gap-1.5 p-3.5 text-sm text-[#5b4635] sm:p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate font-semibold text-[#241b14]">{formatBytes(item.bytes)}</p>
                        <p className="truncate text-xs uppercase tracking-[0.16em] text-[#8b6d52]">vault</p>
                    </div>
                    <p className="text-xs text-[#8b6d52]">{formatDateTime(item.occurredAt)}</p>
                  </div>
                  </Link>
                </article>
              );
            })}
          </div>
        </VaultSelectionScope>
      ) : null}

      {key === "videos" ? (
        <VaultSelectionScope empty={items.length === 0} scopeLabel="videos">
        <div className="adaptive-media-grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((item) => {
            const poster =
              typeof item.meta?.thumbnailLink === "string" && item.meta.thumbnailLink
                ? item.meta.thumbnailLink
                : null;
            const previewUrl =
              typeof item.meta?.fileId === "string" || typeof item.meta?.storedPath === "string"
                ? `/api/vault-file/${item.id}`
                : poster;

            return (
              <article
                key={item.id}
                data-item-id={item.id}
                className="group relative min-w-0 overflow-hidden rounded-[24px] border border-[#ead9c8] bg-[#fffaf2] transition hover:-translate-y-1 hover:shadow-xl sm:rounded-[28px]"
              >
                <div className="absolute right-3 top-3">
                  <VaultItemMenu item={item} redirectTo="/vault/videos" />
                </div>
                <Link href={`/vault/item/${item.id}`} className="block">
                <div className="relative aspect-[16/10] bg-black sm:aspect-[4/5]">
                  {previewUrl ? (
                    <video
                      src={typeof item.meta?.fileId === "string" || typeof item.meta?.storedPath === "string" ? previewUrl : undefined}
                      poster={poster ?? undefined}
                      className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                      muted
                      playsInline
                      loop
                      preload="metadata"
                    />
                  ) : null}
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent p-3.5 text-white sm:p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="line-clamp-2 break-all text-[13px] font-semibold sm:text-sm">{item.title}</p>
                      <span className="rounded-full bg-white/20 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]">
                        video
                      </span>
                    </div>
                  </div>
                </div>
                <div className="grid gap-1.5 p-3.5 text-sm text-[#5b4635] sm:p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate font-semibold text-[#241b14]">{formatBytes(item.bytes)}</p>
                    <p className="truncate text-xs uppercase tracking-[0.16em] text-[#8b6d52]">vault</p>
                  </div>
                  <p className="text-xs text-[#8b6d52]">{formatDateTime(item.occurredAt)}</p>
                </div>
                </Link>
              </article>
            );
          })}
        </div>
        </VaultSelectionScope>
      ) : null}

      {key !== "photos" && key !== "videos" ? (
        <VaultSelectionScope empty={items.length === 0} scopeLabel={key === "drive" ? "files" : key}>
        <div className="grid gap-4 md:grid-cols-2">
          {items.map((item) => (
            key === "notes" ? (
              item.itemKind === "audio-note" ? (
                <article
                  key={item.id}
                  data-item-id={item.id}
                  className="relative rounded-[24px] border border-[#ead9c8] bg-[#fffaf2] p-4 transition hover:-translate-y-1 hover:shadow-xl sm:rounded-[28px] sm:p-5"
                >
                  <div className="absolute right-3 top-3">
                    <VaultItemMenu item={item} redirectTo="/vault/notes" />
                  </div>
                  <Link
                    href={`/vault/item/${item.id}`}
                    className="block"
                  >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-heading text-[1.7rem] font-semibold text-[#241b14] sm:text-2xl">{item.title}</p>
                      <p className="mt-2 text-sm text-[#5b4635]">{item.subtitle || "Voice note"}</p>
                    </div>
                    <div className="rounded-full bg-[#f4ebe0] px-4 py-2 text-sm font-semibold text-[#241b14]">
                      {formatBytes(item.bytes)}
                    </div>
                  </div>
                  <audio controls src={`/api/vault-file/${item.id}`} className="mt-4 w-full" />
                  <p className="mt-4 text-sm text-[#8b6d52]">Updated: {formatDateTime(item.occurredAt)}</p>
                  </Link>
                </article>
              ) : (
                <form key={item.id} data-item-id={item.id} action={saveVaultNoteAction} className="rounded-[24px] border border-[#ead9c8] bg-[#fffaf2] p-4 sm:rounded-[28px] sm:p-5">
                  <input type="hidden" name="itemId" value={item.id} />
                  <input
                    name="title"
                    defaultValue={item.title}
                    className="w-full rounded-2xl border border-[#ddccb9] bg-white px-4 py-3 font-heading text-[1.7rem] font-semibold text-[#241b14] outline-none sm:text-2xl"
                  />
                  <div className="mt-4">
                    <textarea
                      name="content"
                      defaultValue={typeof item.meta?.content === "string" ? item.meta.content : ""}
                      placeholder="Write your note..."
                      rows={7}
                      className="w-full rounded-2xl border border-[#ddccb9] bg-white px-4 py-3 outline-none"
                    />
                  </div>
                  <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-[#8b6d52]">Updated: {formatDateTime(item.occurredAt)}</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <VaultItemMenu item={item} redirectTo="/vault/notes" align="left" />
                      <PendingSubmitButton
                        idleLabel="Save Changes"
                        pendingLabel="Saving..."
                        className="rounded-full bg-[#241b14] px-4 py-2 text-sm font-semibold text-[#fff6ed]"
                      />
                    </div>
                  </div>
                </form>
              )
            ) : key === "passwords" ? (
              <form key={item.id} data-item-id={item.id} action={saveVaultPasswordAction} className="rounded-[24px] border border-[#ead9c8] bg-[#fffaf2] p-4 sm:rounded-[28px] sm:p-5">
                <input type="hidden" name="itemId" value={item.id} />
                <div className="grid gap-3">
                  <input name="label" defaultValue={item.title} className="rounded-2xl border border-[#ddccb9] bg-white px-4 py-3 font-heading text-[1.7rem] font-semibold text-[#241b14] outline-none sm:text-2xl" />
                  <input name="website" defaultValue={typeof item.meta?.website === "string" ? item.meta.website : ""} placeholder="Website or app" className="rounded-2xl border border-[#ddccb9] bg-white px-4 py-3 outline-none" />
                  <input name="username" defaultValue={item.subtitle ?? ""} placeholder="Username or email" className="rounded-2xl border border-[#ddccb9] bg-white px-4 py-3 outline-none" />
                  <input name="password" defaultValue="" placeholder="Enter new password to replace current one" type="password" className="rounded-2xl border border-[#ddccb9] bg-white px-4 py-3 outline-none" />
                  <textarea name="note" defaultValue={typeof item.meta?.note === "string" ? item.meta.note : ""} rows={4} className="rounded-2xl border border-[#ddccb9] bg-white px-4 py-3 outline-none" />
                </div>
                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-[#8b6d52]">Updated: {formatDateTime(item.occurredAt)}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <VaultItemMenu item={item} redirectTo="/vault/passwords" align="left" />
                    <Link href={`/vault/item/${item.id}`} className="rounded-full border border-[#d8c0ae] bg-white px-4 py-2 text-sm font-semibold text-[#3b2d20]">
                      Open
                    </Link>
                  </div>
                </div>
                <PendingSubmitButton
                  idleLabel="Save Changes"
                  pendingLabel="Saving..."
                  className="mt-4 w-full rounded-full bg-[#241b14] px-4 py-2 text-sm font-semibold text-[#fff6ed] sm:w-auto"
                />
              </form>
            ) : (
              <article
                key={item.id}
                data-item-id={item.id}
                className="relative rounded-[24px] border border-[#ead9c8] bg-[#fffaf2] p-4 transition hover:-translate-y-1 hover:shadow-xl sm:rounded-[28px] sm:p-5"
              >
                <div className="absolute right-3 top-3">
                  <VaultItemMenu item={item} redirectTo={`/vault/${key}`} />
                </div>
                <Link
                  href={`/vault/item/${item.id}`}
                  className="block"
                >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-heading text-[1.7rem] font-semibold text-[#241b14] sm:text-2xl">{item.title}</p>
                    <p className="mt-2 text-sm text-[#5b4635]">
                      {item.subtitle || item.itemKind || item.source || "vault item"}
                    </p>
                  </div>
                  <div className="rounded-full bg-[#f4ebe0] px-4 py-2 text-sm font-semibold text-[#241b14]">
                    {formatBytes(item.bytes)}
                  </div>
                </div>
                <p className="mt-4 text-sm text-[#5b4635]">
                  Updated: {formatDateTime(item.occurredAt)}
                </p>
                </Link>
              </article>
            )
          ))}
        </div>
        </VaultSelectionScope>
      ) : null}
    </div>
  );
}
