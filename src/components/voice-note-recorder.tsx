"use client";

import { useMemo, useRef, useState } from "react";

type RecorderState = "idle" | "recording" | "stopped" | "uploading";

const MIME_PREFERENCES = [
  "audio/mpeg",
  "audio/mp4",
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
  "audio/ogg",
];

function pickRecorderMimeType() {
  if (typeof window === "undefined" || typeof MediaRecorder === "undefined") {
    return "";
  }

  for (const mimeType of MIME_PREFERENCES) {
    if (MediaRecorder.isTypeSupported(mimeType)) {
      return mimeType;
    }
  }

  return "";
}

function extensionForMimeType(mimeType: string) {
  if (mimeType.includes("mpeg")) return "mp3";
  if (mimeType.includes("mp4")) return "m4a";
  if (mimeType.includes("ogg")) return "ogg";
  return "webm";
}

type VoiceNoteRecorderProps = {
  uploadUrl: string;
  redirectTo: string;
};

export function VoiceNoteRecorder({ uploadUrl, redirectTo }: VoiceNoteRecorderProps) {
  const [title, setTitle] = useState("");
  const [state, setState] = useState<RecorderState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<number | null>(null);
  const startedAtRef = useRef<number>(0);
  const mimeType = useMemo(() => pickRecorderMimeType(), []);

  async function startRecording() {
    setError(null);
    setPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
    setAudioBlob(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks: BlobPart[] = [];
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      recorder.onstop = () => {
        const recordedMime = recorder.mimeType || mimeType || "audio/webm";
        const blob = new Blob(chunks, { type: recordedMime });
        setAudioBlob(blob);
        setPreviewUrl(URL.createObjectURL(blob));
        setState("stopped");
        if (timerRef.current) {
          window.clearInterval(timerRef.current);
          timerRef.current = null;
        }
        setElapsedMs(Date.now() - startedAtRef.current);
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        recorderRef.current = null;
      };

      streamRef.current = stream;
      recorderRef.current = recorder;
      startedAtRef.current = Date.now();
      setElapsedMs(0);
      timerRef.current = window.setInterval(() => {
        setElapsedMs(Date.now() - startedAtRef.current);
      }, 250);
      recorder.start();
      setState("recording");
    } catch {
      setError("Microphone access was blocked or failed.");
      setState("idle");
    }
  }

  function stopRecording() {
    recorderRef.current?.stop();
  }

  async function saveRecording() {
    if (!audioBlob) {
      setError("Record something first.");
      return;
    }

    setState("uploading");
    setError(null);

    const actualMimeType = audioBlob.type || mimeType || "audio/webm";
    const extension = extensionForMimeType(actualMimeType);
    const file = new File(
      [audioBlob],
      `${(title.trim() || "Voice Note").replace(/[^\w\s-]+/g, "").trim() || "Voice Note"}.${extension}`,
      { type: actualMimeType },
    );
    const formData = new FormData();
    formData.set("title", title.trim() || "Voice Note");
    formData.set("redirectTo", redirectTo);
    formData.set("durationMs", String(elapsedMs));
    formData.set("file", file);

    const response = await fetch(uploadUrl, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(payload?.error ?? "Voice note upload failed.");
      setState("stopped");
      return;
    }

    setState("idle");
    setAudioBlob(null);
    setTitle("");
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    window.location.assign(`${redirectTo}?note=audio-saved`);
  }

  const seconds = Math.max(0, Math.round(elapsedMs / 1000));

  return (
    <div className="grid gap-4 rounded-[24px] border border-[#ddccb9] bg-white p-4">
      <div className="grid gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#8b6d52]">
          Voice Note
        </p>
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Voice note title"
          className="rounded-2xl border border-[#ddccb9] bg-white px-4 py-3 outline-none"
        />
        <p className="text-xs text-[#8b6d52]">
          The recorder will try MP3 first when the browser supports it. Otherwise it keeps the browser&apos;s native audio format.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {state !== "recording" ? (
          <button
            type="button"
            onClick={startRecording}
            className="rounded-full bg-[#241b14] px-4 py-2 text-sm font-semibold text-[#fff6ed]"
          >
            Start Recording
          </button>
        ) : (
          <button
            type="button"
            onClick={stopRecording}
            className="rounded-full bg-[#c55c32] px-4 py-2 text-sm font-semibold text-[#fff6ed]"
          >
            Stop Recording
          </button>
        )}

        <span className="text-sm text-[#5b4635]">
          {state === "recording" ? `Recording... ${seconds}s` : previewUrl ? `Recorded ${seconds}s` : "Ready"}
        </span>
      </div>

      {previewUrl ? <audio controls src={previewUrl} className="w-full" /> : null}

      {error ? <p className="text-sm text-[#b54222]">{error}</p> : null}

      <button
        type="button"
        onClick={saveRecording}
        disabled={!audioBlob || state === "uploading"}
        className="w-fit rounded-full bg-[#436b5c] px-4 py-2 text-sm font-semibold text-[#f7f2ea] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {state === "uploading" ? "Saving..." : "Save Voice Note"}
      </button>
    </div>
  );
}
