"use client";

import { ReactNode } from "react";
import { useFormStatus } from "react-dom";

type PendingSubmitButtonProps = {
  idleLabel: ReactNode;
  pendingLabel?: ReactNode;
  className?: string;
};

export function PendingSubmitButton({
  idleLabel,
  pendingLabel = "Working...",
  className = "",
}: PendingSubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className={`${className} disabled:cursor-not-allowed disabled:opacity-70`}
    >
      <span className="inline-flex items-center gap-2">
        {pending ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" />
        ) : null}
        <span>{pending ? pendingLabel : idleLabel}</span>
      </span>
    </button>
  );
}
