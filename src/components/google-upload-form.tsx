"use client";

import { useRef, useState } from "react";

type UploadQueueItem = {
  id: string;
  file: File;
  status: "queued" | "uploading" | "retrying" | "success" | "error";
  attempts: number;
  progress: number;
  error?: string;
};

type GoogleUploadFormProps = {
  folderPath: string;
  redirectTo: string;
  accept?: string;
  multiple?: boolean;
  buttonClassName: string;
  inputClassName: string;
  buttonLabel: string;
};

export function GoogleUploadForm({
  folderPath,
  redirectTo,
  accept,
  multiple = true,
  buttonClassName,
  inputClassName,
  buttonLabel,
}: GoogleUploadFormProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [queueItems, setQueueItems] = useState<UploadQueueItem[]>([]);
  const [queueOpen, setQueueOpen] = useState(false);

  function createQueueItems(files: File[]) {
    return files.map((file, index) => ({
      id: `${file.name}-${file.size}-${index}-${crypto.randomUUID()}`,
      file,
      status: "queued" as const,
      attempts: 0,
      progress: 0,
    }));
  }

  async function uploadSingleFile(item: UploadQueueItem) {
    const formData = new FormData();
    formData.set("folderPath", folderPath);
    formData.set("redirectTo", redirectTo);
    formData.append("files", item.file);

    const response = await new Promise<XMLHttpRequest>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/vault/upload");
      xhr.responseType = "json";
      xhr.upload.onprogress = (progressEvent) => {
        if (!progressEvent.lengthComputable) {
          return;
        }

        const itemProgress = Math.min(
          100,
          Math.round((progressEvent.loaded / progressEvent.total) * 100),
        );

        setQueueItems((current) =>
          current.map((entry) =>
            entry.id === item.id ? { ...entry, progress: itemProgress } : entry,
          ),
        );
      };
      xhr.onload = () => resolve(xhr);
      xhr.onerror = () =>
        reject(new Error(`Network error while uploading ${item.file.name}.`));
      xhr.send(formData);
    });

    if (response.status < 200 || response.status >= 300) {
      if (response.status === 413) {
        throw new Error(
          `${item.file.name} is still too large for one Vercel upload request.`,
        );
      }

      const payload =
        typeof response.response === "object" && response.response
          ? (response.response as { error?: string })
          : null;

      throw new Error(payload?.error ?? `Upload failed for ${item.file.name}.`);
    }

    const payload =
      typeof response.response === "object" && response.response
        ? (response.response as { redirectTo?: string })
        : null;

    return {
      redirectTo: payload?.redirectTo || redirectTo,
    };
  }

  function updateOverallProgress(nextItems: UploadQueueItem[]) {
    const completedCount = nextItems.filter(
      (item) => item.status === "success" || item.status === "error",
    ).length;
    const inFlightProgress = nextItems
      .filter((item) => item.status === "uploading" || item.status === "retrying")
      .reduce((sum, item) => sum + item.progress, 0);

    const total = nextItems.length * 100;
    const current = completedCount * 100 + inFlightProgress;
    setProgress(total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0);
  }

  async function runUploadQueue(items: UploadQueueItem[]) {
    const MAX_CONCURRENT_UPLOADS = 6;
    const MAX_RETRIES = 2;
    let nextIndex = 0;
    let finalRedirectTo = redirectTo;
    let successCount = 0;
    let failedCount = 0;

    const worker = async () => {
      while (true) {
        const currentIndex = nextIndex;
        nextIndex += 1;

        if (currentIndex >= items.length) {
          return;
        }

        const item = items[currentIndex];

        for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt += 1) {
          setQueueItems((current) => {
            const nextItems = current.map((entry) =>
              entry.id === item.id
                ? {
                    ...entry,
                    attempts: attempt,
                    progress: 0,
                    error: undefined,
                    status: (attempt === 1 ? "uploading" : "retrying") as UploadQueueItem["status"],
                  }
                : entry,
            );
            updateOverallProgress(nextItems);
            return nextItems;
          });

          try {
            const result = await uploadSingleFile(item);
            finalRedirectTo = result.redirectTo;
            setQueueItems((current) => {
              const nextItems = current.map((entry) =>
                entry.id === item.id
                  ? { ...entry, status: "success" as const, progress: 100, error: undefined }
                  : entry,
              );
              updateOverallProgress(nextItems);
              return nextItems;
            });
            successCount += 1;
            break;
          } catch (uploadError) {
            const message =
              uploadError instanceof Error ? uploadError.message : "Upload failed.";

            if (attempt <= MAX_RETRIES) {
              setQueueItems((current) => {
                const nextItems = current.map((entry) =>
                  entry.id === item.id
                    ? { ...entry, status: "retrying" as const, error: `Retrying... ${message}` }
                    : entry,
                );
                updateOverallProgress(nextItems);
                return nextItems;
              });
              await new Promise((resolve) => setTimeout(resolve, 700 * attempt));
              continue;
            }

            setQueueItems((current) => {
              const nextItems = current.map((entry) =>
                entry.id === item.id
                  ? { ...entry, status: "error" as const, progress: 0, error: message }
                  : entry,
              );
              updateOverallProgress(nextItems);
              return nextItems;
            });
            failedCount += 1;
          }
        }
      }
    };

    await Promise.all(
      Array.from({ length: Math.min(MAX_CONCURRENT_UPLOADS, items.length) }, () => worker()),
    );

    setUploading(false);
    setQueueItems((current) => {
      setSummary(
        failedCount > 0
          ? `${successCount} uploaded, ${failedCount} failed.`
          : `Uploaded ${successCount} file${successCount === 1 ? "" : "s"}.`,
      );
      return current;
    });

    if (failedCount === 0) {
      window.location.assign(finalRedirectTo);
    }
  }

  async function startUpload(files: File[]) {
    setUploading(true);
    setProgress(0);
    setError(null);
    setSummary(null);
    setQueueOpen(true);

    const items = createQueueItems(files);
    setQueueItems(items);

    try {
      await runUploadQueue(items);
    } catch (uploadError) {
      setUploading(false);
      setProgress(null);
      setError(uploadError instanceof Error ? uploadError.message : "Upload failed.");
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const files = Array.from(inputRef.current?.files ?? []);
    if (!files.length || uploading) {
      return;
    }

    await startUpload(files);
  }

  async function handleRetryFailed() {
    if (uploading) {
      return;
    }

    const failedFiles = queueItems
      .filter((item) => item.status === "error")
      .map((item) => item.file);

    if (!failedFiles.length) {
      return;
    }

    await startUpload(failedFiles);
  }

  return (
    <form onSubmit={handleSubmit} className="grid min-w-0 gap-3">
      <input
        ref={inputRef}
        name="files"
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={uploading}
        className={`${inputClassName} min-w-0 max-w-full overflow-hidden text-ellipsis whitespace-nowrap file:mr-3 file:max-w-full file:overflow-hidden file:text-ellipsis`}
      />

      {uploading ? (
        <div className="grid gap-2">
          <div className="h-2 overflow-hidden rounded-full bg-[#ead9c8]">
            <div
              className="h-full rounded-full bg-[#436b5c] transition-all"
              style={{ width: `${progress ?? 0}%` }}
            />
          </div>
          <p className="text-xs text-[#8b6d52]">{progress ?? 0}% processed</p>
        </div>
      ) : null}

      {error ? <p className="text-sm text-[#b54222]">{error}</p> : null}
      {summary ? <p className="text-sm text-[#5b4635]">{summary}</p> : null}

      {queueItems.length > 0 ? (
        <div className="grid gap-2 rounded-2xl border border-[#ead9c8] bg-[#fffaf2] p-3">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setQueueOpen((current) => !current)}
              className="inline-flex min-w-0 items-center gap-2 text-left text-xs font-semibold uppercase tracking-[0.2em] text-[#8b6d52]"
            >
              <span>{queueOpen ? "Hide" : "Show"} Upload Queue</span>
              <span className="rounded-full bg-[#f4ebe0] px-2 py-1 text-[10px] text-[#6c5440]">
                {queueItems.filter((item) => item.status === "success").length}/{queueItems.length}
              </span>
            </button>
            <div className="flex items-center gap-2">
              {queueItems.some((item) => item.status === "error") && !uploading ? (
                <button
                  type="button"
                  onClick={handleRetryFailed}
                  className="rounded-full border border-[#d8c0ae] bg-white px-3 py-1.5 text-xs font-semibold text-[#3b2d20]"
                >
                  Retry Failed
                </button>
              ) : null}
              <span className="text-[10px] uppercase tracking-[0.16em] text-[#8b6d52]">
                {uploading ? "Live" : "Ready"}
              </span>
            </div>
          </div>
          {queueOpen ? (
            <div className="grid gap-2">
              {queueItems.map((item) => (
                <div key={item.id} className="rounded-2xl bg-[#f4ebe0] px-3 py-2.5 text-sm text-[#3b2d20]">
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 break-all font-medium">{item.file.name}</p>
                    <span
                      className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${
                        item.status === "success"
                          ? "bg-[#d8ecdf] text-[#335443]"
                          : item.status === "error"
                            ? "bg-[#f7e1dc] text-[#7b3d31]"
                            : item.status === "retrying"
                              ? "bg-[#f5ecdf] text-[#7a5a3e]"
                              : "bg-[#ede3d6] text-[#6c5440]"
                      }`}
                    >
                      {item.status}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-3 text-xs text-[#7a5a3e]">
                    <span>{Math.round(item.file.size / 1024)} KB</span>
                    <span>
                      {item.status === "success"
                        ? "Done"
                        : item.status === "error"
                          ? "Failed"
                          : `${item.progress}%`}
                    </span>
                  </div>
                  {item.error ? <p className="mt-2 text-xs text-[#b54222]">{item.error}</p> : null}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={uploading}
        className={`${buttonClassName} disabled:cursor-not-allowed disabled:opacity-70`}
      >
        <span className="inline-flex items-center gap-2">
          {uploading ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" />
          ) : null}
          <span>{uploading ? "Uploading..." : buttonLabel}</span>
        </span>
      </button>
    </form>
  );
}
