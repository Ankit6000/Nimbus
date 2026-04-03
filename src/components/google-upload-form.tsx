"use client";

import { useRef, useState } from "react";

type UploadQueueItem = {
  id: string;
  file: File;
  status: "queued" | "uploading" | "retrying" | "success" | "error" | "canceled";
  attempts: number;
  progress: number;
  error?: string;
};

const GOOGLE_CHUNK_SIZE = 3 * 1024 * 1024;
const WHOLE_FILE_UPLOAD_LIMIT = 12 * 1024 * 1024;
const MAX_RETRIES = 3;

function getConcurrentUploads(items: UploadQueueItem[]) {
  const totalBytes = items.reduce((sum, item) => sum + item.file.size, 0);
  const averageBytes = items.length ? totalBytes / items.length : 0;
  const connection = typeof navigator !== "undefined" ? (navigator as Navigator & {
    connection?: { downlink?: number; effectiveType?: string };
  }).connection : undefined;
  const downlink = connection?.downlink ?? 0;
  const slowConnection =
    connection?.effectiveType === "2g" || connection?.effectiveType === "slow-2g";

  if (slowConnection) {
    return 2;
  }

  if (averageBytes <= 4 * 1024 * 1024) {
    return downlink >= 20 ? 10 : 8;
  }

  if (averageBytes <= 16 * 1024 * 1024) {
    return downlink >= 20 ? 8 : 6;
  }

  if (averageBytes <= 48 * 1024 * 1024) {
    return 4;
  }

  return 3;
}

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
  const activeRequestsRef = useRef<Map<string, XMLHttpRequest>>(new Map());
  const canceledIdsRef = useRef<Set<string>>(new Set());
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
    const sessionResponse = await fetch("/api/vault/upload/session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        folderPath,
        fileName: item.file.name,
        fileSize: item.file.size,
        mimeType: item.file.type,
      }),
    });

    const sessionPayload = (await sessionResponse.json().catch(() => null)) as
      | {
          uploadUrl?: string;
          error?: string;
        }
      | null;

    if (!sessionResponse.ok || !sessionPayload?.uploadUrl) {
      throw new Error(sessionPayload?.error ?? `Could not start upload for ${item.file.name}.`);
    }

    const totalBytes = item.file.size;
    const shouldUploadWholeFile = totalBytes <= WHOLE_FILE_UPLOAD_LIMIT;

    const sendChunk = (blob: Blob, startByte: number, endByte: number) =>
      new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        activeRequestsRef.current.set(item.id, xhr);
        xhr.open("POST", "/api/vault/upload/chunk");
        xhr.setRequestHeader("Content-Type", "application/octet-stream");
        xhr.setRequestHeader("x-google-upload-url", sessionPayload.uploadUrl!);
        xhr.setRequestHeader("x-upload-content-type", item.file.type || "application/octet-stream");
        xhr.setRequestHeader("x-upload-start", String(startByte));
        xhr.setRequestHeader("x-upload-end", String(endByte));
        xhr.setRequestHeader("x-upload-total", String(totalBytes));
        xhr.upload.onprogress = (progressEvent) => {
          const uploadedBytes = startByte + progressEvent.loaded;
          const itemProgress = Math.min(100, Math.round((uploadedBytes / totalBytes) * 100));

          setQueueItems((current) =>
            current.map((entry) =>
              entry.id === item.id ? { ...entry, progress: itemProgress } : entry,
            ),
          );
        };
        xhr.onload = () => {
          activeRequestsRef.current.delete(item.id);
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
            return;
          }

          let message = `Upload failed for ${item.file.name}.`;
          try {
            const parsed = JSON.parse(xhr.responseText) as { error?: { message?: string } };
            message = parsed?.error?.message || message;
          } catch {
            if (xhr.responseText) {
              message = xhr.responseText;
            }
          }
          reject(new Error(message));
        };
        xhr.onerror = () => {
          activeRequestsRef.current.delete(item.id);
          reject(new Error(`Network error while uploading ${item.file.name}.`));
        };
        xhr.onabort = () => {
          activeRequestsRef.current.delete(item.id);
          const canceledError = new Error(`Canceled ${item.file.name}.`);
          canceledError.name = "UploadCanceledError";
          reject(canceledError);
        };
        xhr.send(blob);
      });

    if (shouldUploadWholeFile) {
      await sendChunk(item.file, 0, totalBytes);
    } else {
      for (let startByte = 0; startByte < totalBytes; startByte += GOOGLE_CHUNK_SIZE) {
        if (canceledIdsRef.current.has(item.id)) {
          const canceledError = new Error(`Canceled ${item.file.name}.`);
          canceledError.name = "UploadCanceledError";
          throw canceledError;
        }

        const endByte = Math.min(totalBytes, startByte + GOOGLE_CHUNK_SIZE);
        await sendChunk(item.file.slice(startByte, endByte), startByte, endByte);
      }
    }

    return {
      redirectTo,
    };
  }

  function updateOverallProgress(nextItems: UploadQueueItem[]) {
    const completedCount = nextItems.filter(
      (item) => item.status === "success" || item.status === "error" || item.status === "canceled",
    ).length;
    const inFlightProgress = nextItems
      .filter((item) => item.status === "uploading" || item.status === "retrying")
      .reduce((sum, item) => sum + item.progress, 0);

    const total = nextItems.length * 100;
    const current = completedCount * 100 + inFlightProgress;
    setProgress(total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0);
  }

  async function runUploadQueue(items: UploadQueueItem[]) {
    const maxConcurrentUploads = getConcurrentUploads(items);
    let nextIndex = 0;
    let finalRedirectTo = redirectTo;
    let successCount = 0;
    let failedCount = 0;
    let canceledCount = 0;

    const worker = async () => {
      while (true) {
        const currentIndex = nextIndex;
        nextIndex += 1;

        if (currentIndex >= items.length) {
          return;
        }

        const item = items[currentIndex];
        if (canceledIdsRef.current.has(item.id)) {
          canceledCount += 1;
          continue;
        }

        for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt += 1) {
          if (canceledIdsRef.current.has(item.id)) {
            setQueueItems((current) => {
              const nextItems = current.map((entry) =>
                entry.id === item.id
                  ? { ...entry, status: "canceled" as const, progress: 0, error: undefined }
                  : entry,
              );
              updateOverallProgress(nextItems);
              return nextItems;
            });
            canceledCount += 1;
            break;
          }

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
            if (uploadError instanceof Error && uploadError.name === "UploadCanceledError") {
              setQueueItems((current) => {
                const nextItems = current.map((entry) =>
                  entry.id === item.id
                    ? { ...entry, status: "canceled" as const, progress: 0, error: undefined }
                    : entry,
                );
                updateOverallProgress(nextItems);
                return nextItems;
              });
              canceledCount += 1;
              break;
            }

            const message =
              uploadError instanceof Error ? uploadError.message : "Upload failed.";

            if (attempt <= MAX_RETRIES) {
              const lowerMessage = message.toLowerCase();
              const isRateLimited =
                lowerMessage.includes("429") ||
                lowerMessage.includes("rate") ||
                lowerMessage.includes("quota");
              const isServerFailure =
                lowerMessage.includes("500") ||
                lowerMessage.includes("502") ||
                lowerMessage.includes("503") ||
                lowerMessage.includes("504");

              setQueueItems((current) => {
                const nextItems = current.map((entry) =>
                  entry.id === item.id
                    ? { ...entry, status: "retrying" as const, error: `Retrying... ${message}` }
                    : entry,
                );
                updateOverallProgress(nextItems);
                return nextItems;
              });
              const retryDelay = isRateLimited || isServerFailure ? 500 * attempt : 200 * attempt;
              await new Promise((resolve) => setTimeout(resolve, retryDelay));
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
      Array.from({ length: Math.min(maxConcurrentUploads, items.length) }, () => worker()),
    );

    if (successCount > 0) {
      const finalizeResponse = await fetch("/api/vault/upload/finalize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          uploadedCount: successCount,
          redirectTo,
        }),
      });

      const finalizePayload = (await finalizeResponse.json().catch(() => null)) as
        | {
            redirectTo?: string;
          }
        | null;

      if (finalizeResponse.ok && finalizePayload?.redirectTo) {
        finalRedirectTo = finalizePayload.redirectTo;
      }
    }

    setUploading(false);
    setQueueItems((current) => {
      setSummary(
        failedCount > 0
          ? `${successCount} uploaded, ${failedCount} failed${canceledCount > 0 ? `, ${canceledCount} canceled` : ""}.`
          : canceledCount > 0
            ? `${successCount} uploaded, ${canceledCount} canceled.`
            : `Uploaded ${successCount} file${successCount === 1 ? "" : "s"}.`,
      );
      return current;
    });

    if (successCount > 0 && failedCount === 0) {
      window.location.assign(finalRedirectTo);
    }
  }

  async function startUpload(files: File[]) {
    setUploading(true);
    setProgress(0);
    setError(null);
    setSummary(null);
    setQueueOpen(true);
    canceledIdsRef.current.clear();
    activeRequestsRef.current.clear();

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

  function cancelItem(itemId: string) {
    canceledIdsRef.current.add(itemId);
    activeRequestsRef.current.get(itemId)?.abort();
    activeRequestsRef.current.delete(itemId);
    setQueueItems((current) => {
      const nextItems = current.map((entry) =>
        entry.id === itemId && (entry.status === "queued" || entry.status === "uploading" || entry.status === "retrying")
          ? { ...entry, status: "canceled" as const, progress: 0, error: undefined }
          : entry,
      );
      updateOverallProgress(nextItems);
      return nextItems;
    });
  }

  function cancelAll() {
    queueItems.forEach((item) => {
      if (item.status === "queued" || item.status === "uploading" || item.status === "retrying") {
        canceledIdsRef.current.add(item.id);
        activeRequestsRef.current.get(item.id)?.abort();
      }
    });
    activeRequestsRef.current.clear();
    setQueueItems((current) => {
      const nextItems = current.map((entry) =>
        entry.status === "queued" || entry.status === "uploading" || entry.status === "retrying"
          ? { ...entry, status: "canceled" as const, progress: 0, error: undefined }
          : entry,
      );
      updateOverallProgress(nextItems);
      return nextItems;
    });
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
              {uploading ? (
                <button
                  type="button"
                  onClick={cancelAll}
                  className="rounded-full border border-[#d8c0ae] bg-white px-3 py-1.5 text-xs font-semibold text-[#3b2d20]"
                >
                  Cancel All
                </button>
              ) : null}
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
                            : item.status === "canceled"
                              ? "bg-[#ece7e0] text-[#6e6256]"
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
                          : item.status === "canceled"
                            ? "Canceled"
                          : `${item.progress}%`}
                    </span>
                  </div>
                  {item.status === "queued" || item.status === "uploading" || item.status === "retrying" ? (
                    <div className="mt-2 flex justify-end">
                      <button
                        type="button"
                        onClick={() => cancelItem(item.id)}
                        className="rounded-full border border-[#d8c0ae] bg-white px-3 py-1 text-[11px] font-semibold text-[#3b2d20]"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : null}
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
