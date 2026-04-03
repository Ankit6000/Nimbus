import Link from "next/link";
import { createDriveFolderAction } from "@/app/actions";
import { DriveLibraryPanels } from "@/components/drive-library-panels";
import { GoogleUploadForm } from "@/components/google-upload-form";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { VaultSelectionScope } from "@/components/vault-selection-scope";
import { VaultItemMenu } from "@/components/vault-item-menu";
import { requireUser } from "@/lib/auth";
import { formatBytes, formatDateTime } from "@/lib/format";
import { listDriveFilesAtPathAsync, listDriveFoldersAtPathAsync } from "@/lib/repository";

type DriveRootPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function DriveRootPage({ searchParams }: DriveRootPageProps) {
  const user = await requireUser();
  const params = searchParams ? await searchParams : undefined;
  const created = params?.drive === "folder-created";
  const invalid = params?.drive === "folder-invalid";
  const errored = params?.drive === "folder-error";
  const folders = await listDriveFoldersAtPathAsync(user.id, "");
  const files = await listDriveFilesAtPathAsync(user.id, "");

  return (
    <div className="grid min-w-0 gap-4 sm:gap-6">
      <section className="min-w-0 rounded-[26px] border border-[#ead9c8] bg-[#fffaf2] p-5 sm:rounded-[32px] sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[#8b6d52]">Files</p>
        <h1 className="font-heading mt-3 text-[2rem] font-semibold tracking-tight text-[#241b14] sm:text-4xl">
          Full file library
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-[#5b4635] sm:mt-4 sm:text-base sm:leading-7">
          Files includes everything in your vault library, including photos and videos.
        </p>
      </section>

      <section className="grid min-w-0 gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <form action={createDriveFolderAction} className="min-w-0 rounded-[24px] border border-[#ead9c8] bg-[#fffaf2] p-4 sm:rounded-[28px] sm:p-5">
          <input type="hidden" name="folderPath" value="" />
          <input type="hidden" name="redirectTo" value="/vault/drive" />
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#8b6d52]">Folders</p>
          <h2 className="font-heading mt-2 text-[1.7rem] font-semibold text-[#241b14] sm:text-3xl">Create folder</h2>
          <p className="mt-2 text-sm leading-6 text-[#5b4635]">
            Create a folder in the root library so uploads can be organized inside it.
          </p>
          {created ? <p className="mt-4 rounded-2xl bg-[#e3f3ea] px-4 py-3 text-sm text-[#335443]">Folder created.</p> : null}
          {invalid ? <p className="mt-4 rounded-2xl bg-[#f7e1dc] px-4 py-3 text-sm text-[#7b3d31]">Enter a folder name.</p> : null}
          {errored ? <p className="mt-4 rounded-2xl bg-[#f7e1dc] px-4 py-3 text-sm text-[#7b3d31]">Folder creation failed.</p> : null}
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <input
              name="folderName"
              placeholder="Folder name"
              className="flex-1 rounded-2xl border border-[#ddccb9] bg-white px-4 py-3 outline-none"
            />
            <PendingSubmitButton
              idleLabel="Create Folder"
              pendingLabel="Creating..."
              className="w-full rounded-full bg-[#241b14] px-5 py-3 text-sm font-semibold text-[#fff6ed] sm:w-auto"
            />
          </div>
        </form>

        <div className="min-w-0 rounded-[24px] border border-[#ead9c8] bg-[#fffaf2] p-4 sm:rounded-[28px] sm:p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#8b6d52]">Upload</p>
          <h2 className="font-heading mt-2 text-[1.7rem] font-semibold text-[#241b14] sm:text-3xl">Upload to root</h2>
          <p className="mt-2 text-sm leading-6 text-[#5b4635]">
            Upload any files into the root library. Images will also appear in Photos, and videos will also appear in Videos after refresh.
          </p>
          <div className="mt-4">
            <GoogleUploadForm
              folderPath=""
              redirectTo="/vault/drive"
              buttonLabel="Upload Files"
              buttonClassName="mt-1 w-full rounded-full bg-[#436b5c] px-5 py-3 text-sm font-semibold text-[#f7f2ea] sm:w-auto"
              inputClassName="block w-full rounded-2xl border border-[#ddccb9] bg-white px-4 py-3 text-sm"
            />
          </div>
        </div>
      </section>

      <VaultSelectionScope empty={!folders.length && !files.length} scopeLabel="files">
        <DriveLibraryPanels
          leftLabel="Folders"
          rightLabel="Files"
          leftCount={folders.length}
          rightCount={files.length}
          leftPanel={
          <div className="min-w-0 rounded-[24px] border border-[#ead9c8] bg-[#fffaf2] p-4 sm:rounded-[28px] sm:p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#8b6d52]">Folders</p>
            <div className="mt-4 grid gap-3">
              {folders.length === 0 ? (
                <div className="rounded-2xl bg-[#f4ebe0] px-4 py-4 text-sm text-[#5b4635]">No folders in root yet.</div>
              ) : (
                folders.map((folder) => (
                  <article key={folder.id} data-item-id={folder.id} className="relative min-w-0 rounded-2xl bg-[#f4ebe0] px-4 py-4 text-sm font-semibold text-[#241b14] transition hover:bg-[#eadfce]">
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
                        redirectTo="/vault/drive"
                      />
                    </div>
                    <Link href={`/vault/drive/${folder.fullPath.split("/").map(encodeURIComponent).join("/")}`} className="block break-words pr-12 leading-6">
                      {folder.name}
                    </Link>
                  </article>
                ))
              )}
            </div>
          </div>
          }
          rightPanel={
          <div className="min-w-0 rounded-[24px] border border-[#ead9c8] bg-[#fffaf2] p-4 sm:rounded-[28px] sm:p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#8b6d52]">Files</p>
            <div className="mt-4 grid gap-3">
              {files.length === 0 ? (
                <div className="rounded-2xl bg-[#f4ebe0] px-4 py-4 text-sm text-[#5b4635]">No root files yet.</div>
              ) : (
                files.map((item) => (
                  <article key={item.id} data-item-id={item.id} className="relative min-w-0 rounded-2xl bg-[#f4ebe0] px-4 py-4 text-sm text-[#5b4635] transition hover:bg-[#eadfce]">
                    <div className="absolute right-3 top-3">
                      <VaultItemMenu item={item} redirectTo="/vault/drive" />
                    </div>
                    <Link href={`/vault/item/${item.id}`} className="block min-w-0 pr-12">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="break-all font-semibold leading-6 text-[#241b14]">{item.title}</p>
                        <p className="mt-1">{item.itemKind ?? item.source ?? "file"}</p>
                      </div>
                      <div className="sm:text-right">
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
          }
        />
      </VaultSelectionScope>
    </div>
  );
}
