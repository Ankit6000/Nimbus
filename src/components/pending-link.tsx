"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { MouseEvent, ReactNode, useEffect, useState } from "react";

type PendingLinkProps = {
  href: string;
  className: string;
  children: ReactNode;
  active?: boolean;
};

export function PendingLink({ href, className, children, active = false }: PendingLinkProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, setPending] = useState(false);

  useEffect(() => {
    setPending(false);
  }, [pathname, searchParams]);

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    setPending(true);
  }

  return (
    <Link
      href={href}
      onClick={handleClick}
      className={className}
      aria-busy={pending}
      aria-current={active ? "page" : undefined}
    >
      <span className="inline-flex items-center gap-2 text-inherit">
        {pending ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" />
        ) : null}
        <span className="text-inherit">{children}</span>
      </span>
    </Link>
  );
}
