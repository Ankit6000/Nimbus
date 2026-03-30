import { formatBytes, formatDateTime } from "@/lib/format";
import { UploadHistoryEntry } from "@/lib/data";

type UploadHistoryProps = {
  entries: UploadHistoryEntry[];
  compact?: boolean;
};

export function UploadHistory({ entries, compact = false }: UploadHistoryProps) {
  return (
    <div className="rounded-[32px] border border-[#ead9c8] bg-[#fffaf2] p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#8b6d52]">
        Recent Activity
      </p>
      <h2 className={`font-heading mt-3 font-semibold text-[#241b14] ${compact ? "text-2xl" : "text-3xl"}`}>
        Latest uploaded files
      </h2>
      <div className="mt-4 grid gap-3">
        {entries.length === 0 ? (
          <div className="rounded-2xl bg-[#f4ebe0] px-4 py-4 text-sm text-[#5b4635]">
            No uploaded files yet.
          </div>
        ) : (
          entries.map((entry) => (
            <div key={entry.id} className="rounded-2xl bg-[#f4ebe0] px-4 py-4 text-sm text-[#5b4635]">
              <div className={`flex flex-col gap-2 ${compact ? "" : "sm:flex-row sm:items-center sm:justify-between"}`}>
                <div>
                  <p className="font-semibold text-[#241b14]">{entry.title}</p>
                  <p>{entry.source}</p>
                </div>
                <div className={compact ? "" : "text-right"}>
                  <p className="font-semibold uppercase tracking-[0.16em] text-[#8b6d52]">
                    {entry.section}
                  </p>
                  <p>{formatBytes(entry.size)}</p>
                </div>
              </div>
              <p className="mt-2 text-[#8b6d52]">{formatDateTime(entry.occurredAt)}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
