"use client";

import { ReactNode, useEffect, useMemo, useRef, useState } from "react";

type VaultSelectionScopeProps = {
  children: ReactNode;
  empty?: boolean;
  scopeLabel: string;
};

type DeleteResponse = {
  ok?: boolean;
  deletedIds?: string[];
  failed?: Array<{ itemId: string; error: string }>;
  error?: string;
  warning?: string;
};

const LONG_PRESS_MS = 420;

function isFormControl(target: HTMLElement | null) {
  if (!target) {
    return false;
  }

  return Boolean(
    target.closest(
      "input, textarea, select, option, button, summary, audio, video, [contenteditable='true']",
    ),
  );
}

export function VaultSelectionScope({
  children,
  empty = false,
  scopeLabel,
}: VaultSelectionScopeProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const longPressHandledRef = useRef(false);
  const [itemIds, setItemIds] = useState<string[]>([]);
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectionMode, setSelectionMode] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const visibleItemIds = useMemo(
    () => itemIds.filter((itemId) => !hiddenIds.includes(itemId)),
    [hiddenIds, itemIds],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      setItemIds([]);
      return;
    }

    const nextIds = Array.from(container.querySelectorAll<HTMLElement>("[data-item-id]"))
      .map((node) => node.dataset.itemId?.trim())
      .filter((value): value is string => Boolean(value));

    setItemIds(Array.from(new Set(nextIds)));
  }, [children]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const selected = new Set(selectedIds);
    const hidden = new Set(hiddenIds);

    container.querySelectorAll<HTMLElement>("[data-item-id]").forEach((node) => {
      const itemId = node.dataset.itemId?.trim();
      if (!itemId) {
        return;
      }

      node.dataset.selectionActive = selectionMode ? "true" : "false";
      node.dataset.selected = selected.has(itemId) ? "true" : "false";
      node.dataset.hidden = hidden.has(itemId) ? "true" : "false";
    });
  }, [children, hiddenIds, selectedIds, selectionMode]);

  useEffect(() => {
    setSelectedIds((current) => current.filter((itemId) => visibleItemIds.includes(itemId)));
    if (!visibleItemIds.length) {
      setSelectionMode(false);
    }
  }, [visibleItemIds]);

  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) {
        window.clearTimeout(longPressTimerRef.current);
      }
    };
  }, []);

  function clearLongPress() {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }

  function getItemElement(target: EventTarget | null) {
    return target instanceof HTMLElement
      ? target.closest<HTMLElement>("[data-item-id]")
      : null;
  }

  function toggleItem(itemId: string) {
    setSelectedIds((current) =>
      current.includes(itemId) ? current.filter((value) => value !== itemId) : [...current, itemId],
    );
  }

  function handlePointerDownCapture(event: React.PointerEvent<HTMLDivElement>) {
    if (selectionMode || deleting) {
      return;
    }

    const itemElement = getItemElement(event.target);
    if (!itemElement) {
      return;
    }

    const itemId = itemElement.dataset.itemId?.trim();
    if (!itemId || itemElement.dataset.hidden === "true") {
      return;
    }

    if (isFormControl(event.target as HTMLElement)) {
      return;
    }

    longPressHandledRef.current = false;
    clearLongPress();
    longPressTimerRef.current = window.setTimeout(() => {
      longPressHandledRef.current = true;
      setMessage(null);
      setSelectionMode(true);
      setSelectedIds([itemId]);
    }, LONG_PRESS_MS);
  }

  function handlePointerEnd() {
    clearLongPress();
  }

  function handleClickCapture(event: React.MouseEvent<HTMLDivElement>) {
    const itemElement = getItemElement(event.target);
    if (!itemElement) {
      return;
    }

    const itemId = itemElement.dataset.itemId?.trim();
    if (!itemId || itemElement.dataset.hidden === "true") {
      return;
    }

    if (longPressHandledRef.current) {
      longPressHandledRef.current = false;
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    if (!selectionMode) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    toggleItem(itemId);
  }

  async function handleDeleteSelected() {
    if (!selectedIds.length || deleting) {
      return;
    }

    setDeleting(true);
    setMessage(null);

    const response = await fetch("/api/vault/delete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ itemIds: selectedIds }),
    });

    const payload = (await response.json().catch(() => null)) as DeleteResponse | null;

    if (!response.ok) {
      setDeleting(false);
      setMessage(payload?.error ?? `Couldn't delete selected ${scopeLabel}.`);
      return;
    }

    const deletedIds = Array.isArray(payload?.deletedIds)
      ? payload.deletedIds.filter((value): value is string => typeof value === "string" && value.length > 0)
      : [...selectedIds];

    const failedItems = Array.isArray(payload?.failed) ? payload.failed : [];

    setHiddenIds((current) => Array.from(new Set([...current, ...deletedIds])));
    setSelectedIds([]);
    setSelectionMode(false);
    setDeleting(false);

    if (failedItems.length > 0) {
      setMessage(`${deletedIds.length} deleted, ${failedItems.length} failed.`);
      return;
    }

    setMessage(
      deletedIds.length === 1
        ? "Deleted 1 item."
        : `Deleted ${deletedIds.length} ${scopeLabel}.`,
    );
  }

  function handleToggleSelectAll() {
    if (!visibleItemIds.length) {
      return;
    }

    if (selectedIds.length === visibleItemIds.length) {
      setSelectedIds([]);
      return;
    }

    setSelectedIds([...visibleItemIds]);
  }

  return (
    <div className="grid gap-4">
      {!empty ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[22px] border border-[#ead9c8] bg-[#fffaf2] px-4 py-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#8b6d52]">
              {selectionMode ? "Selection mode" : "Bulk actions"}
            </p>
            <p className="mt-1 text-sm text-[#5b4635]">
              {selectionMode
                ? `${selectedIds.length} selected`
                : "Long-press any item, or start selection manually."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!selectionMode ? (
              <button
                type="button"
                onClick={() => {
                  setMessage(null);
                  setSelectionMode(true);
                }}
                className="rounded-full border border-[#d8c0ae] bg-white px-4 py-2 text-sm font-semibold text-[#3b2d20]"
              >
                Select Items
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleToggleSelectAll}
                  className="rounded-full border border-[#d8c0ae] bg-white px-4 py-2 text-sm font-semibold text-[#3b2d20]"
                >
                  {selectedIds.length === visibleItemIds.length ? "Clear All" : "Select All"}
                </button>
                <button
                  type="button"
                  onClick={handleDeleteSelected}
                  disabled={!selectedIds.length || deleting}
                  className="rounded-full bg-[#b54222] px-4 py-2 text-sm font-semibold text-[#fff6ed] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span className="inline-flex items-center gap-2">
                    {deleting ? (
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" />
                    ) : null}
                    <span>{deleting ? "Deleting..." : `Delete Selected (${selectedIds.length})`}</span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectionMode(false);
                    setSelectedIds([]);
                    setMessage(null);
                  }}
                  className="rounded-full border border-[#d8c0ae] bg-white px-4 py-2 text-sm font-semibold text-[#3b2d20]"
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>
      ) : null}

      {message ? <p className="text-sm text-[#5b4635]">{message}</p> : null}

      <div
        ref={containerRef}
        onPointerDownCapture={handlePointerDownCapture}
        onPointerUpCapture={handlePointerEnd}
        onPointerOutCapture={handlePointerEnd}
        onPointerCancelCapture={handlePointerEnd}
        onClickCapture={handleClickCapture}
      >
        {children}
      </div>

      <style jsx global>{`
        [data-item-id][data-selection-active="true"] {
          cursor: pointer;
          transition:
            box-shadow 160ms ease,
            transform 160ms ease,
            opacity 160ms ease;
        }

        [data-item-id][data-selection-active="true"][data-selected="true"] {
          box-shadow: inset 0 0 0 2px #436b5c, 0 0 0 4px rgba(67, 107, 92, 0.12);
          transform: translateY(-1px);
        }

        [data-item-id][data-hidden="true"] {
          display: none !important;
        }
      `}</style>
    </div>
  );
}
