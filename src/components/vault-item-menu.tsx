"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { VaultItemRecord } from "@/lib/repository";

type VaultItemMenuProps = {
  item: VaultItemRecord;
  redirectTo: string;
  align?: "left" | "right";
};

export function VaultItemMenu({ item, redirectTo, align = "right" }: VaultItemMenuProps) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const hasBinary =
    typeof item.meta?.storedPath === "string" || typeof item.meta?.fileId === "string";
  const canDownload = hasBinary && item.itemKind !== "folder" && item.section !== "mail";
  const webViewLink = typeof item.meta?.webViewLink === "string" ? item.meta.webViewLink : "";

  async function handleDelete() {
    if (deleting) {
      return;
    }

    setDeleting(true);

    const response = await fetch("/api/vault/delete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ itemId: item.id }),
    });

    if (!response.ok) {
      setDeleting(false);
      router.push(`${redirectTo}?item=delete-error`);
      router.refresh();
      return;
    }

    router.push(`${redirectTo}?item=deleted`);
    router.refresh();
  }

  return (
    <details className="relative z-20">
      <summary className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-full bg-[rgba(255,250,242,0.92)] text-[#241b14] shadow-sm transition hover:bg-white">
        <span className="text-xl leading-none">⋮</span>
      </summary>
      <div
        className={`absolute top-12 min-w-[180px] rounded-2xl border border-[#e3d2c0] bg-[#fffaf2] p-2 shadow-xl ${
          align === "right" ? "right-0" : "left-0"
        }`}
      >
        <Link
          href={`/vault/item/${item.id}`}
          className="block rounded-xl px-3 py-2 text-sm text-[#241b14] transition hover:bg-[#f4ebe0]"
        >
          Open
        </Link>
        {canDownload ? (
          <a
            href={`/api/vault-file/${item.id}`}
            download
            className="block rounded-xl px-3 py-2 text-sm text-[#241b14] transition hover:bg-[#f4ebe0]"
          >
            Download
          </a>
        ) : null}
        {webViewLink ? (
          <a
            href={webViewLink}
            target="_blank"
            rel="noreferrer"
            className="block rounded-xl px-3 py-2 text-sm text-[#241b14] transition hover:bg-[#f4ebe0]"
          >
            Open Source File
          </a>
        ) : null}
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          className="block w-full rounded-xl px-3 py-2 text-left text-sm text-[#b54222] transition hover:bg-[#f8e6df] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {deleting ? "Deleting..." : "Delete"}
        </button>
      </div>
    </details>
  );
}
