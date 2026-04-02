import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { formatBytes, formatDateTime } from "@/lib/format";
import { listFullUploadHistoryAsync } from "@/lib/repository";

export default async function ActivityPage() {
  const user = await requireUser();
  const entries = await listFullUploadHistoryAsync(user.id);

  return (
    <div className="grid min-w-0 gap-4 sm:gap-6">
      <section className="fluid-card-pad min-w-0 rounded-[26px] border border-[#ead9c8] bg-[#fffaf2] sm:rounded-[32px] sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[#8b6d52]">
          Recent Activity
        </p>
        <h1 className="font-heading fluid-hero-title mt-3 font-semibold tracking-tight text-[#241b14] sm:text-4xl">
          Latest uploaded files
        </h1>
        <p className="fluid-hero-copy mt-3 max-w-3xl text-[#5b4635] sm:mt-4 sm:text-base sm:leading-7">
          This page shows the full upload timeline across Photos, Videos, and Files.
        </p>
      </section>

      <section className="fluid-card-pad min-w-0 rounded-[26px] border border-[#ead9c8] bg-[#fffaf2] sm:rounded-[32px] sm:p-6">
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
                className="min-w-0 rounded-2xl bg-[#f4ebe0] px-4 py-4 text-sm text-[#5b4635] transition hover:bg-[#eadfce]"
              >
                <div className="flex min-w-0 flex-col gap-3">
                  <div className="min-w-0">
                    <p className="break-words font-semibold leading-6 text-[#241b14]">{entry.title}</p>
                    <p>{entry.section === "photos" ? "Photo item" : entry.section === "videos" ? "Video item" : "File item"}</p>
                  </div>
                  <div className="flex min-w-0 flex-col gap-2 border-t border-[#e8dac9] pt-3 sm:flex-row sm:items-end sm:justify-between sm:text-right">
                    <div className="min-w-0">
                      <p className="font-semibold uppercase tracking-[0.16em] text-[#8b6d52]">
                        {entry.section === "drive" ? "files" : entry.section}
                      </p>
                      <p>{formatBytes(entry.size)}</p>
                    </div>
                    <p className="text-left text-xs text-[#8b6d52] sm:text-right">{formatDateTime(entry.occurredAt)}</p>
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
