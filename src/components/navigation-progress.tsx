"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const START_EVENT = "nimbus:navigation-start";

export function emitNavigationStart() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(START_EVENT));
  }
}

export function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const finishTimeoutRef = useRef<number | null>(null);
  const trickleTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    function clearTimers() {
      if (finishTimeoutRef.current) {
        window.clearTimeout(finishTimeoutRef.current);
        finishTimeoutRef.current = null;
      }

      if (trickleTimeoutRef.current) {
        window.clearTimeout(trickleTimeoutRef.current);
        trickleTimeoutRef.current = null;
      }
    }

    function trickle() {
      trickleTimeoutRef.current = window.setTimeout(() => {
        setProgress((current) => {
          if (current >= 88) {
            return current;
          }

          return Math.min(88, current + Math.max(3, (92 - current) * 0.18));
        });
        trickle();
      }, 180);
    }

    function handleStart() {
      clearTimers();
      setVisible(true);
      setProgress(12);
      trickle();
    }

    window.addEventListener(START_EVENT, handleStart);
    return () => {
      clearTimers();
      window.removeEventListener(START_EVENT, handleStart);
    };
  }, []);

  useEffect(() => {
    if (!visible) {
      return;
    }

    if (trickleTimeoutRef.current) {
      window.clearTimeout(trickleTimeoutRef.current);
      trickleTimeoutRef.current = null;
    }

    setProgress(100);
    finishTimeoutRef.current = window.setTimeout(() => {
      setVisible(false);
      setProgress(0);
    }, 260);

    return () => {
      if (finishTimeoutRef.current) {
        window.clearTimeout(finishTimeoutRef.current);
        finishTimeoutRef.current = null;
      }
    };
  }, [pathname, searchParams, visible]);

  return (
    <div
      className={`pointer-events-none fixed inset-x-0 top-0 z-[100] h-[3px] transition-opacity duration-200 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
      aria-hidden="true"
    >
      <div
        className="h-full bg-gradient-to-r from-[#c98958] via-[#9a6b45] to-[#4b7a68] shadow-[0_0_14px_rgba(154,107,69,0.45)] transition-[width] duration-200 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
