import { PortalShell } from "@/components/portal-shell";
import { requireUser } from "@/lib/auth";
import { getDatabaseRuntimeStatus } from "@/lib/db";

export default async function PortalLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await requireUser();
  const databaseStatus = getDatabaseRuntimeStatus();

  return (
    <PortalShell user={user} databaseStatus={databaseStatus}>
      {children}
    </PortalShell>
  );
}
