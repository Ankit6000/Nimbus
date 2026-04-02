import Link from "next/link";
import { createDriveFolderAction } from "@/app/actions";
import { GoogleUploadForm } from "@/components/google-upload-form";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { VaultItemMenu } from "@/components/vault-item-menu";
import { requireUser } from "@/lib/auth";
import { formatBytes, formatDateTime } from "@/lib/format";
import { listDriveFilesAtPathAsync, listDriveFoldersAtPathAsync } from "@/lib/repository";

type DriveFolderPageProps = {
  params: Promise<{
    folderPath: string[];
  }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function DriveFolderPage({ params, searchParams }: DriveFolderPageProps) {
  const user = await requireUser();
  const { folderPath: segments } = await params;
  const folderPath = segments.map(decodeURIComponent).join("/");
  const paramsMap = searchParams ? await searchParams : undefined;
  const created = paramsMap?.drive === "folder-created";
  const invalid = paramsMap?.drive === "folder-invalid";
  const errored = paramsMap?.drive === "folder-error";
  const folders = await listDriveFoldersAtPathAsync(user.id, folderPath);
  const files = await listDriveFilesAtPathAsync(user.id, folderPath);
  const breadcrumbParts = folderPath.split("/").filter(Boolean);

  return (
    <div className="grid gap-6">
      <section className="rounded-[32px] border border-[#ead9c8] bg-[#fffaf2] p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[#8b6d52]">Folder</p>
        <h1 className="font-heading mt-3 text-4xl font-semibold tracking-tight text-[#241b14]">
          {breadcrumbParts.at(-1) ?? "Folder"}
        </h1>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-[#5b4635]">
          <Link href="/vault/drive" className="rounded-full bg-[#f4ebe0] px-3 py-1 font-semibold text-[#241b14]">
            Root
          </Link>
          {breadcrumbParts.map((part, index) => {
            const path = breadcrumbParts.slice(0, index + 1).join("/");
            return (
              <Link
                key={path}
                href={`/vault/drive/${breadcrumbParts.slice(0, index + 1).map(encodeURIComponent).join("/")}`}
                className="rounded-full bg-[#f4ebe0] px-3 py-1 font-semibold text-[#241b14]"
              >
                {part}
              </Link>
            );
          })}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <form action={createDriveFolderAction} className="rounded-[28px] border border-[#ead9c8] bg-[#fffaf2] p-5">
          <input type="hidden" name="folderPath" value={folderPath} />
          <input type="hidden" name="redirectTo" value={`/vault/drive/${segments.map(encodeURIComponent).join("/")}`} />
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#8b6d52]">Folders</p>
          <h2 className="font-heading mt-2 text-3xl font-semibold text-[#241b14]">Create subfolder</h2>
          {created ? <p className="mt-4 rounded-2xl bg-[#e3f3ea] px-4 py-3 text-sm text-[#335443]">Folder created.</p> : null}
          {invalid ? <p className="mt-4 rounded-2xl bg-[#f7e1dc] px-4 py-3 text-sm text-[#7b3d31]">Enter a folder name.</p> : null}
          {errored ? <p className="mt-4 rounded-2xl bg-[#f7e1dc] px-4 py-3 text-sm text-[#7b3d31]">Folder creation failed.</p> : null}
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <input name="folderName" placeholder="Folder name" className="flex-1 rounded-2xl border border-[#ddccb9] bg-white px-4 py-3 outline-none" />
            <PendingSubmitButton
              idleLabel="Create Folder"
              pendingLabel="Creating..."
              className="rounded-full bg-[#241b14] px-5 py-3 text-sm font-semibold text-[#fff6ed]"
            />
          </div>
        </form>

        <div className="rounded-[28px] border border-[#ead9c8] bg-[#fffaf2] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#8b6d52]">Upload</p>
          <h2 className="font-heading mt-2 text-3xl font-semibold text-[#241b14]">Upload here</h2>
          <p className="mt-2 text-sm leading-6 text-[#5b4635]">
            Upload files directly into this folder. Photos and videos also stay visible in their media sections.
          </p>
          <div className="mt-4">
            <GoogleUploadForm
              folderPath={folderPath}
              redirectTo={`/vault/drive/${segments.map(encodeURIComponent).join("/")}`}
              buttonLabel="Upload Files"
              buttonClassName="mt-1 rounded-full bg-[#436b5c] px-5 py-3 text-sm font-semibold text-[#f7f2ea]"
              inputClassName="block w-full rounded-2xl border border-[#ddccb9] bg-white px-4 py-3 text-sm"
            />
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
        <div className="rounded-[28px] border border-[#ead9c8] bg-[#fffaf2] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#8b6d52]">Subfolders</p>
          <div className="mt-4 grid gap-3">
            {folders.length === 0 ? (
              <div className="rounded-2xl bg-[#f4ebe0] px-4 py-4 text-sm text-[#5b4635]">No subfolders here yet.</div>
            ) : (
              folders.map((folder) => (
                <article key={folder.id} data-item-id={folder.id} className="relative rounded-2xl bg-[#f4ebe0] px-4 py-4 text-sm font-semibold text-[#241b14] transition hover:bg-[#eadfce]">
                  <div className="absolute right-3 top-3">
                    <VaultItemMenu
                      item={{
                        id: folder.id,
                        section: "drive",
                        title: folder.name,
                        subtitle: folder.fullPath,
                        bytes: 0,
                        itemKind: "folder",
                        source: "google-drive",
                        sourceAccountId: folder.sourceAccountId,
                        occurredAt: new Date().toISOString(),
                        unread: false,
                        meta: { folderPath: folder.parentPath, fullPath: folder.fullPath, fileId: folder.fileId },
                      }}
                      redirectTo={`/vault/drive/${segments.map(encodeURIComponent).join("/")}`}
                    />
                  </div>
                  <Link href={`/vault/drive/${folder.fullPath.split("/").map(encodeURIComponent).join("/")}`} className="block pr-12">
                    {folder.name}
                  </Link>
                </article>
              ))
            )}
          </div>
        </div>

        <div className="rounded-[28px] border border-[#ead9c8] bg-[#fffaf2] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#8b6d52]">Files</p>
          <div className="mt-4 grid gap-3">
            {files.length === 0 ? (
              <div className="rounded-2xl bg-[#f4ebe0] px-4 py-4 text-sm text-[#5b4635]">No files in this folder yet.</div>
            ) : (
              files.map((item) => (
                <article key={item.id} data-item-id={item.id} className="relative rounded-2xl bg-[#f4ebe0] px-4 py-4 text-sm text-[#5b4635] transition hover:bg-[#eadfce]">
                  <div className="absolute right-3 top-3">
                    <VaultItemMenu item={item} redirectTo={`/vault/drive/${segments.map(encodeURIComponent).join("/")}`} />
                  </div>
                  <Link key={item.id} href={`/vault/item/${item.id}`} className="block pr-12">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-semibold text-[#241b14]">{item.title}</p>
                      <p className="mt-1">{item.itemKind ?? item.source ?? "file"}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-[#241b14]">{formatBytes(item.bytes)}</p>
                      <p className="mt-1 text-xs text-[#8b6d52]">{formatDateTime(item.occurredAt)}</p>
                    </div>
                  </div>
                  </Link>
                </article>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
