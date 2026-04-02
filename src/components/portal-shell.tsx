"use client";

import Link from "next/link";
import { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/app/actions";
import { PendingLink } from "@/components/pending-link";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { PortalUser, SectionKey, sectionMeta } from "@/lib/data";
import { DatabaseRuntimeStatus } from "@/lib/db";

const mainSectionOrder: SectionKey[] = [
  "photos",
  "videos",
  "drive",
  "notes",
];

const otherSectionOrder: SectionKey[] = [
  "passwords",
  "messages",
  "mail",
];

type PortalShellProps = {
  user: PortalUser;
  databaseStatus: DatabaseRuntimeStatus;
  children: ReactNode;
};

function normalizePath(path: string) {
  if (!path || path === "/") {
    return path || "/";
  }

  return path.endsWith("/") ? path.slice(0, -1) : path;
}

export function PortalShell({ user, databaseStatus, children }: PortalShellProps) {
  const pathname = usePathname();
  const activePath = normalizePath(pathname || "/dashboard");
  const activeClass =
    "border border-[#dcc3ae] bg-[#f1e3d3] text-[#241b14] shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]";
  const idleClass = "bg-[#f5ecdf] text-[#3b2d20] hover:bg-[#ecdcc8]";

  return (
    <div className="fluid-page-shell min-h-screen bg-transparent lg:h-screen lg:overflow-hidden lg:px-8 lg:py-4">
      <div className="mx-auto flex max-w-[1500px] min-w-0 flex-col gap-3 lg:grid lg:h-[calc(100vh-2rem)] lg:grid-cols-[248px_minmax(0,1fr)] lg:gap-4">
        <aside className="glass-panel fluid-card-pad min-w-0 flex flex-col rounded-[26px] lg:h-full lg:rounded-[28px] lg:p-4">
          <div className="rounded-[22px] bg-[#1f1712] p-3.5 text-[#f8efe5] lg:rounded-[24px] lg:p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#f4d7c7] text-sm font-semibold text-[#76321a] lg:h-12 lg:w-12 lg:text-base">
                {user.avatar}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-heading text-lg font-semibold leading-tight lg:text-xl">{user.fullName}</p>
                <p className="text-xs text-[#d2bba8]">@{user.username}</p>
              </div>
              <span
                className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] lg:hidden ${
                  databaseStatus.tone === "stable"
                    ? "bg-[#203a30] text-[#d8f3e8]"
                    : "bg-[#4a2f18] text-[#ffe3bf]"
                }`}
              >
                {databaseStatus.label}
              </span>
            </div>
            <p className="mt-3 rounded-2xl bg-[#2b2018] px-3 py-2 text-xs text-[#e3d5c8] lg:mt-4">
              {user.roleLabel}
            </p>
            <div className="mt-3 hidden items-center justify-between rounded-2xl border border-[#4a3629] bg-[#241a14] px-3 py-2 text-[11px] uppercase tracking-[0.16em] text-[#d8c4b0] lg:flex">
              <span>Data</span>
              <span
                className={`rounded-full px-2 py-1 text-[10px] font-semibold tracking-[0.18em] ${
                  databaseStatus.tone === "stable"
                    ? "bg-[#203a30] text-[#d8f3e8]"
                    : "bg-[#4a2f18] text-[#ffe3bf]"
                }`}
              >
                {databaseStatus.label}
              </span>
            </div>
          </div>

          <div className="mt-3 rounded-[22px] bg-[#fffaf2] p-3 lg:mt-4 lg:rounded-[24px]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#8b6d52]">
              Navigation
            </p>
            <nav className="adaptive-nav-grid mt-3 lg:grid-cols-1 lg:gap-1.5">
              <PendingLink
                href="/dashboard"
                active={activePath === "/dashboard"}
                className={`min-w-0 rounded-2xl px-3 py-2.5 text-[13px] font-medium text-center transition sm:text-sm ${
                  activePath === "/dashboard" ? activeClass : idleClass
                }`}
              >
                Dashboard
              </PendingLink>
              <PendingLink
                href="/activity"
                active={activePath === "/activity"}
                className={`min-w-0 rounded-2xl px-3 py-2.5 text-[13px] font-medium text-center transition sm:text-sm ${
                  activePath === "/activity" ? activeClass : idleClass
                }`}
              >
                Recent Activity
              </PendingLink>
              {mainSectionOrder.map((key) => {
                const href = `/vault/${key}`;
                const normalizedHref = normalizePath(href);
                const active =
                  activePath === normalizedHref || activePath.startsWith(`${normalizedHref}/`);

                return (
                  <PendingLink
                    key={key}
                    href={href}
                    active={active}
                    className={`min-w-0 rounded-2xl px-3 py-2.5 text-[13px] font-medium text-center transition sm:text-sm ${
                      active ? activeClass : idleClass
                    }`}
                  >
                    {sectionMeta[key].title}
                  </PendingLink>
                );
              })}
              <p className="col-span-full px-1 pt-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8b6d52] lg:mt-3 lg:block">
                Others
              </p>
              {otherSectionOrder.map((key) => {
                const href = `/vault/${key}`;
                const normalizedHref = normalizePath(href);
                const active =
                  activePath === normalizedHref || activePath.startsWith(`${normalizedHref}/`);

                return (
                  <PendingLink
                    key={key}
                    href={href}
                    active={active}
                    className={`min-w-0 rounded-2xl px-3 py-2.5 text-[13px] font-medium text-center transition sm:text-sm ${
                      active ? activeClass : idleClass
                    }`}
                  >
                    {sectionMeta[key].title}
                  </PendingLink>
                );
              })}
            </nav>
          </div>

          <form action={logoutAction} className="mt-3 lg:mt-auto lg:pt-4">
            <PendingSubmitButton
              idleLabel="Log Out"
              pendingLabel="Logging Out..."
              className="w-full rounded-full border border-[#d8c0ae] bg-[#fffaf2] px-4 py-2.5 text-sm font-semibold text-[#3b2d20] transition hover:bg-[#f5ecdf]"
            />
          </form>
        </aside>

        <main className="glass-panel fluid-main-panel min-w-0 overflow-hidden min-h-[calc(100vh-12rem)] rounded-[28px] lg:h-full lg:overflow-y-auto lg:rounded-[32px] lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
