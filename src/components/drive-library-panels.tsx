"use client";

import { ReactNode, useState } from "react";

type DriveLibraryPanelsProps = {
  leftLabel: string;
  rightLabel: string;
  leftCount: number;
  rightCount: number;
  leftPanel: ReactNode;
  rightPanel: ReactNode;
};

export function DriveLibraryPanels({
  leftLabel,
  rightLabel,
  leftCount,
  rightCount,
  leftPanel,
  rightPanel,
}: DriveLibraryPanelsProps) {
  const [activePanel, setActivePanel] = useState<"left" | "right">("left");

  return (
    <section className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
      <div className="rounded-[22px] border border-[#ead9c8] bg-[#fffaf2] p-1.5 xl:hidden">
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() => setActivePanel("left")}
            className={`rounded-[18px] px-3 py-3 text-sm font-semibold transition ${
              activePanel === "left"
                ? "bg-[#241b14] text-[#fff6ed]"
                : "bg-[#f5ecdf] text-[#3b2d20]"
            }`}
          >
            {leftLabel}
            <span className="ml-2 text-xs opacity-80">{leftCount}</span>
          </button>
          <button
            type="button"
            onClick={() => setActivePanel("right")}
            className={`rounded-[18px] px-3 py-3 text-sm font-semibold transition ${
              activePanel === "right"
                ? "bg-[#241b14] text-[#fff6ed]"
                : "bg-[#f5ecdf] text-[#3b2d20]"
            }`}
          >
            {rightLabel}
            <span className="ml-2 text-xs opacity-80">{rightCount}</span>
          </button>
        </div>
      </div>

      <div className={activePanel === "left" ? "xl:block" : "hidden xl:block"}>{leftPanel}</div>
      <div className={activePanel === "right" ? "xl:block" : "hidden xl:block"}>{rightPanel}</div>
    </section>
  );
}
