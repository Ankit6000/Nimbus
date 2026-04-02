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
    <div className="h-screen overflow-hidden bg-transparent px-4 py-4 sm:px-6 lg:px-8">
      <div className="mx-auto grid h-[calc(100vh-2rem)] max-w-[1500px] gap-4 lg:grid-cols-[248px_minmax(0,1fr)]">
        <aside className="glass-panel flex h-full flex-col rounded-[28px] p-4">
          <div className="rounded-[24px] bg-[#1f1712] p-4 text-[#f8efe5]">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f4d7c7] text-base font-semibold text-[#76321a]">
                {user.avatar}
              </div>
              <div>
                <p className="font-heading text-xl font-semibold leading-tight">{user.fullName}</p>
                <p className="text-xs text-[#d2bba8]">@{user.username}</p>
              </div>
            </div>
            <p className="mt-4 rounded-2xl bg-[#2b2018] px-3 py-2 text-xs text-[#e3d5c8]">
              {user.roleLabel}
            </p>
            <div className="mt-3 flex items-center justify-between rounded-2xl border border-[#4a3629] bg-[#241a14] px-3 py-2 text-[11px] uppercase tracking-[0.16em] text-[#d8c4b0]">
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

          <div className="mt-4 rounded-[24px] bg-[#fffaf2] p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#8b6d52]">
              Navigation
            </p>
            <nav className="mt-3 grid gap-1.5">
              <PendingLink
                href="/dashboard"
                active={activePath === "/dashboard"}
                className={`rounded-2xl px-3 py-2.5 text-sm font-medium transition ${
                  activePath === "/dashboard" ? activeClass : idleClass
                }`}
              >
                Dashboard
              </PendingLink>
              <PendingLink
                href="/activity"
                active={activePath === "/activity"}
                className={`rounded-2xl px-3 py-2.5 text-sm font-medium transition ${
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
                    className={`rounded-2xl px-3 py-2.5 text-sm font-medium transition ${
                      active ? activeClass : idleClass
                    }`}
                  >
                    {sectionMeta[key].title}
                  </PendingLink>
                );
              })}
              <p className="mt-3 px-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8b6d52]">
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
                    className={`rounded-2xl px-3 py-2.5 text-sm font-medium transition ${
                      active ? activeClass : idleClass
                    }`}
                  >
                    {sectionMeta[key].title}
                  </PendingLink>
                );
              })}
            </nav>
          </div>

          <form action={logoutAction} className="mt-auto pt-4">
            <PendingSubmitButton
              idleLabel="Log Out"
              pendingLabel="Logging Out..."
              className="w-full rounded-full border border-[#d8c0ae] bg-[#fffaf2] px-4 py-2.5 text-sm font-semibold text-[#3b2d20] transition hover:bg-[#f5ecdf]"
            />
          </form>
        </aside>

        <main className="glass-panel h-full overflow-y-auto rounded-[32px] p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
