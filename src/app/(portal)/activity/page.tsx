import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { formatBytes, formatDateTime } from "@/lib/format";
import { listFullUploadHistory } from "@/lib/repository";

export default async function ActivityPage() {
  const user = await requireUser();
  const entries = listFullUploadHistory(user.id);

  return (
    <div className="grid gap-6">
      <section className="rounded-[32px] border border-[#ead9c8] bg-[#fffaf2] p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[#8b6d52]">
          Recent Activity
        </p>
        <h1 className="font-heading mt-3 text-4xl font-semibold tracking-tight text-[#241b14]">
          Latest uploaded files
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-[#5b4635]">
          This page shows the full upload timeline across Photos, Videos, and Files.
        </p>
      </section>

      <section className="rounded-[32px] border border-[#ead9c8] bg-[#fffaf2] p-6">
        {entries.length === 0 ? (
          <div className="rounded-2xl bg-[#f4ebe0] px-4 py-4 text-sm text-[#5b4635]">
            No uploaded files yet.
          </div>
        ) : (
          <div className="grid gap-3">
            {entries.map((entry) => (
              <Link
                key={entry.id}
                href={`/vault/item/${entry.id}`}
                className="rounded-2xl bg-[#f4ebe0] px-4 py-4 text-sm text-[#5b4635] transition hover:bg-[#eadfce]"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold text-[#241b14]">{entry.title}</p>
                    <p>{entry.section === "photos" ? "Photo item" : entry.section === "videos" ? "Video item" : "File item"}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold uppercase tracking-[0.16em] text-[#8b6d52]">
                      {entry.section === "drive" ? "files" : entry.section}
                    </p>
                    <p>{formatBytes(entry.size)}</p>
                    <p className="mt-1 text-xs text-[#8b6d52]">{formatDateTime(entry.occurredAt)}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
