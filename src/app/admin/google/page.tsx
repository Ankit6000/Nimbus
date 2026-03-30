import Link from "next/link";
import { disconnectGoogleAccountAction, logoutAction } from "@/app/actions";
import { requireAdmin } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { listAuditLogsAsync, listGoogleAssignmentsDetailedAsync } from "@/lib/repository";

type AdminGooglePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const googleMessages: Record<string, string> = {
  connected: "Google account connected successfully.",
  disconnected: "Google account disconnected successfully.",
  "missing-params": "Connect request is missing required account details.",
  "missing-callback-data": "Google OAuth callback was missing required data.",
  "setup-error": "Google OAuth could not start because app setup is incomplete.",
  "oauth-error": "Google OAuth did not complete successfully.",
};

export default async function AdminGooglePage({ searchParams }: AdminGooglePageProps) {
  const admin = await requireAdmin();
  const params = searchParams ? await searchParams : undefined;
  const userFilter = typeof params?.user === "string" ? params.user : undefined;
  const googleState = typeof params?.google === "string" ? params.google : undefined;
  const rawMessage = typeof params?.message === "string" ? params.message : undefined;
  const assignments = await listGoogleAssignmentsDetailedAsync(userFilter);
  const auditEntries = await listAuditLogsAsync(12);
  const envReady = Boolean(
    process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      process.env.GOOGLE_REDIRECT_URI,
  );
  const connectedCount = assignments.filter((assignment) => assignment.refresh_token).length;
  const pendingCount = assignments.filter((assignment) => !assignment.refresh_token).length;

  return (
    <div className="min-h-screen px-4 py-4 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-[1550px] gap-4 xl:grid-cols-[330px_minmax(0,1fr)]">
        <aside className="glass-panel rounded-[32px] p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.34em] text-[#8b6d52]">
            Google Connections
          </p>
          <div className="mt-5 rounded-[28px] bg-[#1f1712] p-5 text-[#f8efe5]">
            <p className="font-heading text-2xl font-semibold">{admin.fullName}</p>
            <p className="mt-2 text-sm text-[#d2bba8]">
              Attach refresh tokens to hidden Google account assignments.
            </p>
          </div>

          <div className="mt-5 rounded-[28px] border border-[#ead9c8] bg-[#fffaf2] p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8b6d52]">
              Setup Health
            </p>
            <div className="mt-4 grid gap-3 text-sm text-[#5b4635]">
              <div className="rounded-2xl bg-[#f4ebe0] px-4 py-3">
                OAuth env:{" "}
                <span className="font-semibold text-[#241b14]">
                  {envReady ? "Configured" : "Missing"}
                </span>
              </div>
              <div className="rounded-2xl bg-[#f4ebe0] px-4 py-3">
                Connected hidden accounts:{" "}
                <span className="font-semibold text-[#241b14]">{connectedCount}</span>
              </div>
              <div className="rounded-2xl bg-[#f4ebe0] px-4 py-3">
                Waiting for connection:{" "}
                <span className="font-semibold text-[#241b14]">{pendingCount}</span>
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-3">
            <Link
              href="/admin/dashboard"
              className="rounded-full border border-[#d8c0ae] bg-[#fffaf2] px-5 py-3 text-center text-sm font-semibold text-[#3b2d20]"
            >
              Back to Admin
            </Link>
            <form action={logoutAction}>
              <button
                type="submit"
                className="w-full rounded-full border border-[#d8c0ae] bg-[#fffaf2] px-5 py-3 text-sm font-semibold text-[#3b2d20]"
              >
                Log Out
              </button>
            </form>
          </div>
        </aside>

        <main className="glass-panel rounded-[32px] p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.34em] text-[#8b6d52]">
            Hidden Account OAuth
          </p>
          <h1 className="font-heading mt-3 text-4xl font-semibold tracking-tight text-[#241b14]">
            Connect each hidden Google account separately.
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-[#5b4635]">
            Each assignment below maps to one hidden Google account behind a member vault. Use the
            connect link to complete OAuth and store a refresh token for that exact assignment.
          </p>

          {googleState ? (
            <div className="mt-5 rounded-[28px] border border-[#ead9c8] bg-[#fffaf2] p-5">
              <p className="font-semibold text-[#241b14]">
                {googleMessages[googleState] ?? "Google connection update."}
              </p>
              {rawMessage ? (
                <p className="mt-2 text-sm leading-6 text-[#5b4635]">{rawMessage}</p>
              ) : null}
            </div>
          ) : null}

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <section className="rounded-[28px] border border-[#ead9c8] bg-[#fffaf2] p-5">
              <p className="font-heading text-2xl font-semibold text-[#241b14]">
                Testing Mode Warning
              </p>
              <p className="mt-3 text-sm leading-7 text-[#5b4635]">
                While your Google OAuth app stays in <span className="font-semibold">Testing</span>,
                every hidden Google account you want to connect must be added as a{" "}
                <span className="font-semibold">test user</span> in Google Cloud. If an assigned
                hidden email is not on that list, Google will block the login.
              </p>
              <p className="mt-3 text-sm leading-7 text-[#5b4635]">
                In practice, yes: every hidden Google account you plan to connect during testing
                should be added to the Google Cloud audience/test-users list.
              </p>
            </section>

            <section className="rounded-[28px] border border-[#ead9c8] bg-[#fffaf2] p-5">
              <p className="font-heading text-2xl font-semibold text-[#241b14]">
                Recommended Flow
              </p>
              <ol className="mt-3 grid gap-2 text-sm leading-7 text-[#5b4635]">
                <li>1. Add the hidden Google account assignment on the admin dashboard.</li>
                <li>2. Add that exact Gmail to Google Cloud test users.</li>
                <li>3. Click `Connect Google` below for that assignment.</li>
                <li>4. Sign into that exact Gmail account on Google’s page.</li>
                <li>5. Return to the member dashboard and run `Refresh Vault`.</li>
              </ol>
              <p className="mt-3 text-sm text-[#5b4635]">
                Long-term production guidance is in{" "}
                <span className="font-semibold">
                  `docs/GOOGLE_PRODUCTION_CHECKLIST.md`
                </span>
                .
              </p>
            </section>
          </div>

          <div className="mt-6 grid gap-4">
            {assignments.length === 0 ? (
              <div className="rounded-[28px] bg-[#fffaf2] px-5 py-5 text-sm text-[#5b4635]">
                No hidden Google accounts exist yet. Create one from the admin dashboard first.
              </div>
            ) : (
              assignments.map((assignment) => (
                <section
                  key={assignment.id}
                  className="rounded-[28px] border border-[#ead9c8] bg-[#fffaf2] p-5"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="font-heading text-2xl font-semibold text-[#241b14]">
                        {assignment.account_label}
                      </p>
                      <p className="mt-2 text-sm text-[#5b4635]">
                        Member: {assignment.full_name} (@{assignment.username})
                      </p>
                      <p className="mt-1 text-sm text-[#5b4635]">
                        Hidden Google email: {assignment.google_email}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-[#f4ebe0] px-4 py-3 text-sm text-[#5b4635]">
                      <p className="font-semibold uppercase tracking-[0.16em] text-[#8b6d52]">
                        Google account
                      </p>
                      <p className="mt-1">
                        {assignment.refresh_token ? "Refresh token stored" : "No refresh token"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-2 text-sm text-[#5b4635]">
                    <p>Status: {assignment.status}</p>
                    <p>
                      Last sync:{" "}
                      {assignment.last_synced_at
                        ? formatDateTime(assignment.last_synced_at)
                        : "Never"}
                    </p>
                    <p>Scopes: {assignment.scopes ?? "Not connected yet"}</p>
                    <p>
                      Sync source status:{" "}
                      {assignment.refresh_token ? "Ready to refresh vault data" : "Not connected"}
                    </p>
                    <p>
                      Test-user reminder: add{" "}
                      <span className="font-semibold">{assignment.google_email}</span> to Google
                      Cloud test users while the app remains in Testing.
                    </p>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-3">
                    <Link
                      href={`/api/google/connect?userId=${encodeURIComponent(assignment.user_id)}&label=${encodeURIComponent(assignment.account_label)}&emailHint=${encodeURIComponent(assignment.google_email)}`}
                      className="rounded-full bg-[#436b5c] px-5 py-3 text-sm font-semibold text-[#f7f2ea]"
                    >
                      {assignment.refresh_token ? "Reconnect Google" : "Connect Google"}
                    </Link>
                    {assignment.refresh_token ? (
                      <form action={disconnectGoogleAccountAction}>
                        <input type="hidden" name="id" value={assignment.id} />
                        <button
                          type="submit"
                          className="rounded-full border border-[#d89a8d] bg-[#fff1ed] px-5 py-3 text-sm font-semibold text-[#7b3d31]"
                        >
                          Disconnect Google
                        </button>
                      </form>
                    ) : null}
                  </div>
                </section>
              ))
            )}
          </div>

          <section className="mt-6 rounded-[28px] border border-[#ead9c8] bg-[#fffaf2] p-5">
            <p className="font-heading text-2xl font-semibold text-[#241b14]">Recent admin activity</p>
            <div className="mt-4 grid gap-3">
              {auditEntries.length === 0 ? (
                <div className="rounded-2xl bg-[#f4ebe0] px-4 py-4 text-sm text-[#5b4635]">
                  No audit entries yet.
                </div>
              ) : (
                auditEntries.map((entry) => (
                  <div key={entry.id} className="rounded-2xl bg-[#f4ebe0] px-4 py-4 text-sm text-[#5b4635]">
                    <p className="font-semibold text-[#241b14]">{entry.action}</p>
                    <p className="mt-1">
                      Actor: {entry.actorLabel}
                      {entry.targetLabel ? ` · Target: ${entry.targetLabel}` : ""}
                    </p>
                    {entry.details ? <p className="mt-1">{entry.details}</p> : null}
                    <p className="mt-1 text-[#8b6d52]">{formatDateTime(entry.createdAt)}</p>
                  </div>
                ))
              )}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
