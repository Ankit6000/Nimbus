import Link from "next/link";
import { createDriveFolderAction, uploadFilesToGoogleDriveAction } from "@/app/actions";
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
    <div className="grid gap-6">
      <section className="rounded-[32px] border border-[#ead9c8] bg-[#fffaf2] p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[#8b6d52]">Files</p>
        <h1 className="font-heading mt-3 text-4xl font-semibold tracking-tight text-[#241b14]">
          Full file library
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-[#5b4635]">
          Files includes everything in your vault library, including photos and videos.
        </p>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <form action={createDriveFolderAction} className="rounded-[28px] border border-[#ead9c8] bg-[#fffaf2] p-5">
          <input type="hidden" name="folderPath" value="" />
          <input type="hidden" name="redirectTo" value="/vault/drive" />
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#8b6d52]">Folders</p>
          <h2 className="font-heading mt-2 text-3xl font-semibold text-[#241b14]">Create folder</h2>
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
            <button type="submit" className="rounded-full bg-[#241b14] px-5 py-3 text-sm font-semibold text-[#fff6ed]">
              Create Folder
            </button>
          </div>
        </form>

        <form action={uploadFilesToGoogleDriveAction} className="rounded-[28px] border border-[#ead9c8] bg-[#fffaf2] p-5">
          <input type="hidden" name="folderPath" value="" />
          <input type="hidden" name="redirectTo" value="/vault/drive" />
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#8b6d52]">Upload</p>
          <h2 className="font-heading mt-2 text-3xl font-semibold text-[#241b14]">Upload to root</h2>
          <p className="mt-2 text-sm leading-6 text-[#5b4635]">
            Upload any files into the root library. Images will also appear in Photos, and videos will also appear in Videos after refresh.
          </p>
          <input
            name="files"
            type="file"
            multiple
            className="mt-4 block w-full rounded-2xl border border-[#ddccb9] bg-white px-4 py-3 text-sm"
          />
          <button type="submit" className="mt-4 rounded-full bg-[#436b5c] px-5 py-3 text-sm font-semibold text-[#f7f2ea]">
            Upload Files
          </button>
        </form>
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
        <div className="rounded-[28px] border border-[#ead9c8] bg-[#fffaf2] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#8b6d52]">Folders</p>
          <div className="mt-4 grid gap-3">
            {folders.length === 0 ? (
              <div className="rounded-2xl bg-[#f4ebe0] px-4 py-4 text-sm text-[#5b4635]">No folders in root yet.</div>
            ) : (
              folders.map((folder) => (
                <article key={folder.id} className="relative rounded-2xl bg-[#f4ebe0] px-4 py-4 text-sm font-semibold text-[#241b14] transition hover:bg-[#eadfce]">
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
              <div className="rounded-2xl bg-[#f4ebe0] px-4 py-4 text-sm text-[#5b4635]">No root files yet.</div>
            ) : (
              files.map((item) => (
                <article key={item.id} className="relative rounded-2xl bg-[#f4ebe0] px-4 py-4 text-sm text-[#5b4635] transition hover:bg-[#eadfce]">
                  <div className="absolute right-3 top-3">
                    <VaultItemMenu item={item} redirectTo="/vault/drive" />
                  </div>
                  <Link href={`/vault/item/${item.id}`} className="block pr-12">
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
