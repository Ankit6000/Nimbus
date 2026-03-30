import { headers } from "next/headers";
import { PortalShell } from "@/components/portal-shell";
import { requireUser } from "@/lib/auth";
import { getDatabaseRuntimeStatus } from "@/lib/db";

export default async function PortalLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await requireUser();
  const headerStore = await headers();
  const currentPath = headerStore.get("x-current-path") ?? "/dashboard";
  const databaseStatus = getDatabaseRuntimeStatus();

  return (
    <PortalShell user={user} currentPath={currentPath} databaseStatus={databaseStatus}>
      {children}
    </PortalShell>
  );
}
