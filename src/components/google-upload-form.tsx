"use client";

import { useRef, useState } from "react";

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

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const files = Array.from(inputRef.current?.files ?? []);
    if (!files.length || uploading) {
      return;
    }

    setUploading(true);
    setProgress(0);
    setError(null);

    const formData = new FormData();
    formData.set("folderPath", folderPath);
    formData.set("redirectTo", redirectTo);
    for (const file of files) {
      formData.append("files", file);
    }

    const response = await new Promise<XMLHttpRequest>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/vault/upload");
      xhr.responseType = "json";
      xhr.upload.onprogress = (progressEvent) => {
        if (progressEvent.lengthComputable) {
          setProgress(Math.min(100, Math.round((progressEvent.loaded / progressEvent.total) * 100)));
        }
      };
      xhr.onload = () => resolve(xhr);
      xhr.onerror = () => reject(new Error("Network error"));
      xhr.send(formData);
    }).catch((uploadError) => {
      setUploading(false);
      setProgress(null);
      setError(uploadError instanceof Error ? uploadError.message : "Upload failed.");
      return null;
    });

    if (!response) {
      return;
    }

    if (response.status < 200 || response.status >= 300) {
      const payload =
        typeof response.response === "object" && response.response
          ? (response.response as { error?: string })
          : null;
      setUploading(false);
      setProgress(null);
      setError(payload?.error ?? "Upload failed.");
      return;
    }

    const payload =
      typeof response.response === "object" && response.response
        ? (response.response as { redirectTo?: string })
        : null;

    setProgress(100);
    window.location.assign(payload?.redirectTo || redirectTo);
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
          <p className="text-xs text-[#8b6d52]">{progress ?? 0}% uploaded</p>
        </div>
      ) : null}

      {error ? <p className="text-sm text-[#b54222]">{error}</p> : null}

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
