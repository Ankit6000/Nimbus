import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { VaultItemMenu } from "@/components/vault-item-menu";
import { requireUser } from "@/lib/auth";
import { loadFullGmailMessage } from "@/lib/google";
import { sectionMeta } from "@/lib/data";
import { formatBytes, formatDateTime } from "@/lib/format";
import { getVaultItemById, readVaultPassword } from "@/lib/repository";

type VaultItemPageProps = {
  params: Promise<{
    itemId: string;
  }>;
};

export default async function VaultItemPage({ params }: VaultItemPageProps) {
  const user = await requireUser();
  const { itemId } = await params;
  const item = getVaultItemById(user.id, itemId);

  if (!item) {
    notFound();
  }

  const key = item.section as keyof typeof sectionMeta;
  const meta = sectionMeta[key] ?? sectionMeta.drive;
  const mimeType = typeof item.meta?.originalType === "string"
    ? item.meta.originalType
    : typeof item.meta?.mimeType === "string"
      ? item.meta.mimeType
      : "";
  const fileUrl = `/api/vault-file/${item.id}`;
  const hasStoredBinary =
    typeof item.meta?.storedPath === "string" ||
    typeof item.meta?.fileId === "string";
  const thumbnailLink = typeof item.meta?.thumbnailLink === "string" ? item.meta.thumbnailLink : null;
  const isImage = mimeType.startsWith("image/") || item.itemKind === "image";
  const isVideo = mimeType.startsWith("video/") || item.itemKind === "video";
  const isAudio = mimeType.startsWith("audio/") || item.itemKind === "audio-note";
  const noteText = typeof item.meta?.snippet === "string" ? item.meta.snippet : null;
  const webViewLink = typeof item.meta?.webViewLink === "string" ? item.meta.webViewLink : null;
  const folderPath = typeof item.meta?.folderPath === "string" ? item.meta.folderPath : "";
  const mailMessageId = typeof item.meta?.messageId === "string" ? item.meta.messageId : null;
  const fullMail =
    item.section === "mail" && item.sourceAccountId && mailMessageId
      ? await loadFullGmailMessage(item.sourceAccountId, mailMessageId).catch(() => null)
      : null;
  const savedPassword = item.section === "passwords" ? readVaultPassword(item) : null;
  const backHref =
    item.section === "drive" && folderPath
      ? `/vault/drive/${folderPath.split("/").map(encodeURIComponent).join("/")}`
      : `/vault/${item.section}`;

  return (
    <div className="grid gap-6">
      <section className="rounded-[32px] border border-[#ead9c8] bg-[#fffaf2] p-6 sm:p-8">
        <div className={`h-2 rounded-full bg-gradient-to-r ${meta.accent}`} />
        <div className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[#8b6d52]">
              {meta.title} Item
            </p>
            <h1 className="font-heading mt-3 text-4xl font-semibold tracking-tight text-[#241b14]">
              {item.title}
            </h1>
            <p className="mt-3 text-sm leading-6 text-[#5b4635]">
              {item.subtitle || item.source || item.itemKind || "Stored inside your vault."}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <VaultItemMenu item={item} redirectTo={backHref} />
            <Link href={backHref} className="rounded-full bg-[#241b14] px-5 py-3 text-sm font-semibold text-[#fff6ed]">
              Back
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="rounded-[32px] border border-[#ead9c8] bg-[#fffaf2] p-6">
          {(hasStoredBinary || thumbnailLink) && isImage ? (
            <div className="relative aspect-[4/3] overflow-hidden rounded-[28px] bg-[#f7f0e7]">
              <Image src={hasStoredBinary ? fileUrl : thumbnailLink ?? ""} alt={item.title} fill className="object-contain" unoptimized />
            </div>
          ) : null}

          {hasStoredBinary && isVideo ? (
            <video src={fileUrl} controls playsInline className="w-full rounded-[28px] bg-black" />
          ) : null}

          {!hasStoredBinary && thumbnailLink && isVideo ? (
            <div className="relative aspect-[4/3] overflow-hidden rounded-[28px] bg-[#f7f0e7]">
              <Image src={thumbnailLink} alt={item.title} fill className="object-cover" unoptimized />
            </div>
          ) : null}

          {hasStoredBinary && isAudio ? (
            <div className="rounded-[28px] bg-[#f7f0e7] p-6">
              <audio src={fileUrl} controls className="w-full" />
            </div>
          ) : null}

          {item.section === "mail" && fullMail ? (
            <div className="rounded-[28px] bg-[#f7f0e7] p-6">
              <div className="grid gap-2 border-b border-[#e2d5c6] pb-4 text-sm text-[#5b4635]">
                <p><span className="font-semibold text-[#241b14]">From:</span> {fullMail.from || item.subtitle}</p>
                <p><span className="font-semibold text-[#241b14]">To:</span> {fullMail.to || "Hidden"}</p>
                <p><span className="font-semibold text-[#241b14]">Date:</span> {fullMail.date || formatDateTime(item.occurredAt)}</p>
              </div>
              {fullMail.html ? (
                <article
                  className="prose prose-sm mt-5 max-w-none text-[#241b14]"
                  dangerouslySetInnerHTML={{ __html: fullMail.html }}
                />
              ) : (
                <pre className="mt-5 whitespace-pre-wrap break-words text-sm leading-7 text-[#241b14]">
                  {fullMail.text || fullMail.snippet || "No body available."}
                </pre>
              )}
            </div>
          ) : null}

          {item.section === "passwords" ? (
            <div className="rounded-[28px] bg-[#f7f0e7] p-6 text-sm text-[#5b4635]">
              <div className="grid gap-3">
                <p><span className="font-semibold text-[#241b14]">Username:</span> {item.subtitle || "Not set"}</p>
                {typeof item.meta?.website === "string" && item.meta.website ? (
                  <p><span className="font-semibold text-[#241b14]">Website:</span> {item.meta.website}</p>
                ) : null}
                <p><span className="font-semibold text-[#241b14]">Password:</span> {savedPassword ?? "Unavailable"}</p>
                {typeof item.meta?.note === "string" && item.meta.note ? (
                  <p><span className="font-semibold text-[#241b14]">Note:</span> {item.meta.note}</p>
                ) : null}
              </div>
            </div>
          ) : null}

          {item.section === "notes" && !isAudio ? (
            <div className="rounded-[28px] bg-[#f7f0e7] p-6">
              <pre className="whitespace-pre-wrap break-words text-sm leading-7 text-[#241b14]">
                {typeof item.meta?.content === "string" ? item.meta.content : item.subtitle || ""}
              </pre>
            </div>
          ) : null}

          {!isImage && !isVideo && !isAudio && item.section !== "mail" && item.section !== "passwords" && item.section !== "notes" ? (
            <div className="rounded-[28px] bg-[#f7f0e7] p-6">
              <p className="text-sm leading-7 text-[#5b4635]">
                {noteText || item.subtitle || "This item does not have an inline preview yet, but its full metadata is available on the right."}
              </p>
            </div>
          ) : null}

          <div className="mt-5 flex flex-wrap gap-3">
            {hasStoredBinary ? (
              <a href={fileUrl} target="_blank" rel="noreferrer" className="rounded-full bg-[#436b5c] px-5 py-3 text-sm font-semibold text-[#f7f2ea]">
                Open Full Item
              </a>
            ) : null}
            {webViewLink ? (
              <a href={webViewLink} target="_blank" rel="noreferrer" className="rounded-full border border-[#d8c0ae] bg-white px-5 py-3 text-sm font-semibold text-[#3b2d20]">
                Open Source File
              </a>
            ) : null}
          </div>
        </div>

        <aside className="rounded-[32px] border border-[#ead9c8] bg-[#fffaf2] p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#8b6d52]">Details</p>
          <div className="mt-5 grid gap-4 text-sm text-[#5b4635]">
            <div className="rounded-2xl bg-[#f7f0e7] p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-[#8b6d52]">Stored size</p>
              <p className="mt-2 text-lg font-semibold text-[#241b14]">{formatBytes(item.bytes)}</p>
            </div>
            <div className="rounded-2xl bg-[#f7f0e7] p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-[#8b6d52]">Updated</p>
              <p className="mt-2 text-lg font-semibold text-[#241b14]">{formatDateTime(item.occurredAt)}</p>
            </div>
            <div className="rounded-2xl bg-[#f7f0e7] p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-[#8b6d52]">Kind</p>
              <p className="mt-2 text-lg font-semibold text-[#241b14]">{item.itemKind ?? "vault-item"}</p>
            </div>
            <div className="rounded-2xl bg-[#f7f0e7] p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-[#8b6d52]">Source</p>
              <p className="mt-2 text-lg font-semibold text-[#241b14]">{item.source ?? "vault"}</p>
            </div>
            {folderPath ? (
              <div className="rounded-2xl bg-[#f7f0e7] p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-[#8b6d52]">Folder</p>
                <p className="mt-2 break-all text-lg font-semibold text-[#241b14]">{folderPath}</p>
              </div>
            ) : null}
            {mimeType ? (
              <div className="rounded-2xl bg-[#f7f0e7] p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-[#8b6d52]">Content type</p>
                <p className="mt-2 break-all text-lg font-semibold text-[#241b14]">{mimeType}</p>
              </div>
            ) : null}
          </div>
        </aside>
      </section>
    </div>
  );
}
