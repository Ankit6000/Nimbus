import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { SectionKey, sectionMeta } from "@/lib/data";
import { formatBytes, formatDateTime } from "@/lib/format";
import { getVaultItemById } from "@/lib/repository";

const validSections: SectionKey[] = [
  "photos",
  "videos",
  "drive",
  "passwords",
  "notes",
  "messages",
  "mail",
];

type VaultItemPageProps = {
  params: Promise<{
    section: string;
    itemId: string;
  }>;
};

export default async function VaultItemPage({ params }: VaultItemPageProps) {
  const user = await requireUser();
  const { section, itemId } = await params;

  if (!validSections.includes(section as SectionKey)) {
    notFound();
  }

  const item = getVaultItemById(user.id, itemId);

  if (!item || item.section !== section) {
    notFound();
  }

  const key = section as SectionKey;
  const meta = sectionMeta[key];
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
  const noteText = typeof item.meta?.snippet === "string" ? item.meta.snippet : null;
  const webViewLink = typeof item.meta?.webViewLink === "string" ? item.meta.webViewLink : null;

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
          <Link
            href={`/vault/${section}`}
            className="rounded-full bg-[#241b14] px-5 py-3 text-sm font-semibold text-[#fff6ed]"
          >
            Back to {meta.title}
          </Link>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="rounded-[32px] border border-[#ead9c8] bg-[#fffaf2] p-6">
          {(hasStoredBinary || thumbnailLink) && isImage ? (
            <div className="relative aspect-[4/3] overflow-hidden rounded-[28px] bg-[#f7f0e7]">
              <Image
                src={hasStoredBinary ? fileUrl : thumbnailLink ?? ""}
                alt={item.title}
                fill
                className="object-contain"
                unoptimized
              />
            </div>
          ) : null}

          {hasStoredBinary && isVideo ? (
            <video src={fileUrl} controls playsInline className="w-full rounded-[28px] bg-black" />
          ) : null}

          {!hasStoredBinary && thumbnailLink && isVideo ? (
            <div className="relative aspect-[4/3] overflow-hidden rounded-[28px] bg-[#f7f0e7]">
              <Image src={thumbnailLink} alt={item.title} fill className="object-cover" unoptimized />
              <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                <span className="rounded-full bg-white/85 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#241b14]">
                  Video Preview
                </span>
              </div>
            </div>
          ) : null}

          {!isImage && !isVideo ? (
            <div className="rounded-[28px] bg-[#f7f0e7] p-6">
              <p className="text-sm leading-7 text-[#5b4635]">
                {noteText || item.subtitle || "This item does not have an inline preview yet, but its full metadata is available on the right."}
              </p>
            </div>
          ) : null}

          <div className="mt-5 flex flex-wrap gap-3">
            {hasStoredBinary ? (
              <a
                href={fileUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-full bg-[#436b5c] px-5 py-3 text-sm font-semibold text-[#f7f2ea]"
              >
                Open Full Item
              </a>
            ) : null}
            {webViewLink ? (
              <a
                href={webViewLink}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-[#d8c0ae] bg-white px-5 py-3 text-sm font-semibold text-[#3b2d20]"
              >
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
            {mimeType ? (
              <div className="rounded-2xl bg-[#f7f0e7] p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-[#8b6d52]">Content type</p>
                <p className="mt-2 break-all text-lg font-semibold text-[#241b14]">{mimeType}</p>
              </div>
            ) : null}
            {item.unread ? (
              <div className="rounded-2xl bg-[#f7f0e7] p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-[#8b6d52]">Status</p>
                <p className="mt-2 text-lg font-semibold text-[#241b14]">Unread</p>
              </div>
            ) : null}
          </div>
        </aside>
      </section>
    </div>
  );
}
