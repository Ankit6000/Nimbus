import Link from "next/link";
import {
  addHiddenAccountAction,
  createManagedMemberAction,
  deleteHiddenAccountAction,
  deleteManagedMemberAction,
  logoutAction,
  resetMemberPasswordAction,
  updateHiddenAccountAction,
  updateManagedMemberAction,
} from "@/app/actions";
import { requireAdmin } from "@/lib/auth";
import { formatBytes, formatDateTime } from "@/lib/format";
import { listManagedMembersAsync } from "@/lib/repository";

type AdminDashboardPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const adminMessages: Record<string, string> = {
  "member-created": "Member created successfully.",
  "member-updated": "Member updated successfully.",
  "member-deleted": "Member deleted successfully.",
  "member-invalid": "Fill in all member fields before saving.",
  "member-error": "Could not save that member. The username or email may already exist.",
  "account-added": "Hidden account assigned successfully.",
  "account-updated": "Hidden account updated successfully.",
  "account-deleted": "Hidden account deleted successfully.",
  "account-invalid": "Fill in all hidden account fields first.",
  "password-reset": "Member password reset successfully.",
  "password-invalid": "Provide a new password before resetting.",
};

export default async function AdminDashboardPage({ searchParams }: AdminDashboardPageProps) {
  const admin = await requireAdmin();
  const members = await listManagedMembersAsync();
  const params = searchParams ? await searchParams : undefined;
  const messageKey = typeof params?.admin === "string" ? params.admin : undefined;
  const message = messageKey ? adminMessages[messageKey] : undefined;

  return (
    <div className="min-h-screen px-4 py-4 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-[1650px] gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="glass-panel rounded-[32px] p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.34em] text-[#8b6d52]">
            Admin Console
          </p>
          <div className="mt-5 rounded-[28px] bg-[#1f1712] p-5 text-[#f8efe5]">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#f4d7c7] text-xl font-semibold text-[#76321a]">
                {admin.avatar}
              </div>
              <div>
                <p className="font-heading text-2xl font-semibold">{admin.fullName}</p>
                <p className="text-sm text-[#d2bba8]">@{admin.username}</p>
              </div>
            </div>
            <p className="mt-4 text-sm text-[#d2bba8]">{admin.roleLabel}</p>
          </div>

          <div className="mt-5 rounded-[28px] border border-[#ead9c8] bg-[#fffaf2] p-5">
            <p className="font-heading text-2xl font-semibold text-[#241b14]">Create member</p>
            <form action={createManagedMemberAction} className="mt-4 grid gap-3">
              <input
                name="fullName"
                placeholder="Full name"
                className="rounded-2xl border border-[#ddccb9] bg-white px-4 py-3 outline-none"
                required
              />
              <input
                name="username"
                placeholder="Username"
                className="rounded-2xl border border-[#ddccb9] bg-white px-4 py-3 outline-none"
                required
              />
              <input
                name="email"
                type="email"
                placeholder="Email"
                className="rounded-2xl border border-[#ddccb9] bg-white px-4 py-3 outline-none"
                required
              />
              <input
                name="password"
                placeholder="Temporary password"
                className="rounded-2xl border border-[#ddccb9] bg-white px-4 py-3 outline-none"
                required
              />
              <button
                type="submit"
                className="rounded-full bg-[#241b14] px-5 py-3 text-sm font-semibold text-[#fff6ed]"
              >
                Create Member
              </button>
            </form>
          </div>

          <div className="mt-5 flex gap-3">
            <Link
              href="/admin/google"
              className="flex-1 rounded-full border border-[#d8c0ae] bg-[#fffaf2] px-5 py-3 text-center text-sm font-semibold text-[#3b2d20]"
            >
              Google Links
            </Link>
            <form action={logoutAction} className="flex-1">
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
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.34em] text-[#8b6d52]">
                Member Control
              </p>
              <h1 className="font-heading mt-3 text-4xl font-semibold tracking-tight text-[#241b14]">
                Manage members, hidden Google accounts, and linked Apple account summaries.
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-[#5b4635]">
                Members link Apple accounts from their own vault. Admin manages the member record,
                hidden Google account assignments, and the Google OAuth connections tied to those
                assignments.
              </p>
            </div>
            <div className="rounded-[24px] bg-[#fffaf2] px-5 py-4 text-sm text-[#5b4635]">
              Members: <span className="font-semibold text-[#241b14]">{members.length}</span>
            </div>
          </div>

          {message ? (
            <p className="mt-5 rounded-2xl border border-[#d8c0ae] bg-[#fffaf2] px-4 py-3 text-sm text-[#5b4635]">
              {message}
            </p>
          ) : null}

          <div className="mt-6 grid gap-6">
            {members.map((member) => (
              <section key={member.id} className="rounded-[30px] border border-[#ead9c8] bg-[#fffaf2] p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex items-center gap-4">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f4d7c7] text-lg font-semibold text-[#76321a]">
                        {member.avatar}
                      </div>
                      <div>
                        <p className="font-heading text-3xl font-semibold text-[#241b14]">
                          {member.fullName}
                        </p>
                        <p className="mt-1 text-sm text-[#5b4635]">
                          @{member.username} · {member.email}
                        </p>
                        <p className="mt-1 text-sm text-[#8b6d52]">
                          Created {formatDateTime(member.createdAt)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-3">
                      <span className="rounded-full bg-[#f4ebe0] px-4 py-2 text-sm font-semibold text-[#241b14]">
                        Hidden accounts: {member.hiddenAccounts.length}
                      </span>
                      <span className="rounded-full bg-[#f4ebe0] px-4 py-2 text-sm font-semibold text-[#241b14]">
                        Apple accounts: {member.appleAccounts.length}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
                  <div className="grid gap-4">
                    <form action={updateManagedMemberAction} className="rounded-[26px] bg-[#f7f0e7] p-4">
                      <input type="hidden" name="userId" value={member.id} />
                      <p className="font-heading text-2xl font-semibold text-[#241b14]">Edit member</p>
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <input
                          name="fullName"
                          defaultValue={member.fullName}
                          className="rounded-2xl border border-[#ddccb9] bg-white px-4 py-3 outline-none"
                          required
                        />
                        <input
                          name="roleLabel"
                          defaultValue={member.roleLabel}
                          className="rounded-2xl border border-[#ddccb9] bg-white px-4 py-3 outline-none"
                          required
                        />
                        <input
                          name="username"
                          defaultValue={member.username}
                          className="rounded-2xl border border-[#ddccb9] bg-white px-4 py-3 outline-none"
                          required
                        />
                        <input
                          name="email"
                          type="email"
                          defaultValue={member.email}
                          className="rounded-2xl border border-[#ddccb9] bg-white px-4 py-3 outline-none"
                          required
                        />
                      </div>
                      <div className="mt-4 flex gap-3">
                        <button
                          type="submit"
                          className="rounded-full bg-[#241b14] px-5 py-3 text-sm font-semibold text-[#fff6ed]"
                        >
                          Save Member
                        </button>
                        <button
                          formAction={deleteManagedMemberAction}
                          type="submit"
                          className="rounded-full border border-[#d89a8d] bg-[#fff1ed] px-5 py-3 text-sm font-semibold text-[#7b3d31]"
                        >
                          Delete Member
                        </button>
                      </div>
                    </form>

                    <form action={resetMemberPasswordAction} className="rounded-[26px] bg-[#f7f0e7] p-4">
                      <input type="hidden" name="userId" value={member.id} />
                      <p className="font-heading text-2xl font-semibold text-[#241b14]">
                        Reset password
                      </p>
                      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                        <input
                          name="password"
                          placeholder="New temporary password"
                          className="flex-1 rounded-2xl border border-[#ddccb9] bg-white px-4 py-3 outline-none"
                          required
                        />
                        <button
                          type="submit"
                          className="rounded-full bg-[#241b14] px-5 py-3 text-sm font-semibold text-[#fff6ed]"
                        >
                          Reset Password
                        </button>
                      </div>
                    </form>

                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#8b6d52]">
                        Assigned hidden accounts
                      </p>
                      <div className="mt-3 grid gap-3">
                        {member.hiddenAccounts.length === 0 ? (
                          <div className="rounded-2xl bg-[#f4ebe0] px-4 py-4 text-sm text-[#5b4635]">
                            No hidden accounts assigned yet.
                          </div>
                        ) : (
                          member.hiddenAccounts.map((account) => (
                            <form
                              key={account.id}
                              action={updateHiddenAccountAction}
                              className="rounded-2xl bg-[#f4ebe0] px-4 py-4 text-sm text-[#5b4635]"
                            >
                              <input type="hidden" name="id" value={account.id} />
                              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                  <p className="font-semibold text-[#241b14]">{account.label}</p>
                                  <p>{account.email}</p>
                                </div>
                                <div className="text-right">
                                  <p className="font-semibold uppercase tracking-[0.16em] text-[#8b6d52]">
                                    Google account
                                  </p>
                                  <p>
                                    {account.status}
                                    {account.hasRefreshToken ? " · connected" : " · no token"}
                                  </p>
                                </div>
                              </div>
                              <p className="mt-3">
                                {account.totalBytes > 0
                                  ? `Used ${formatBytes(account.usedBytes)} of ${formatBytes(account.totalBytes)}`
                                  : "Storage will appear automatically after Google is connected and synced."}
                              </p>
                              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                <input
                                  name="label"
                                  defaultValue={account.label}
                                  className="rounded-2xl border border-[#ddccb9] bg-white px-4 py-3 outline-none"
                                  required
                                />
                                <input
                                  name="googleEmail"
                                  type="email"
                                  defaultValue={account.email}
                                  className="rounded-2xl border border-[#ddccb9] bg-white px-4 py-3 outline-none"
                                  required
                                />
                                <input
                                  name="accountPassword"
                                  type="text"
                                  defaultValue={account.savedPassword ?? ""}
                                  placeholder="Saved sign-in password"
                                  className="sm:col-span-2 rounded-2xl border border-[#ddccb9] bg-white px-4 py-3 outline-none"
                                />
                              </div>
                              <div className="mt-4 flex gap-3">
                                <button
                                  type="submit"
                                  className="rounded-full bg-[#436b5c] px-4 py-2 text-sm font-semibold text-[#f7f2ea]"
                                >
                                  Save Account
                                </button>
                                <button
                                  formAction={deleteHiddenAccountAction}
                                  type="submit"
                                  className="rounded-full border border-[#d89a8d] bg-[#fff1ed] px-4 py-2 text-sm font-semibold text-[#7b3d31]"
                                >
                                  Delete Account
                                </button>
                              </div>
                            </form>
                          ))
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4">
                    <form action={addHiddenAccountAction} className="rounded-[26px] bg-[#f7f0e7] p-4">
                      <input type="hidden" name="userId" value={member.id} />
                      <p className="font-heading text-2xl font-semibold text-[#241b14]">
                        Add hidden account
                      </p>
                      <p className="mt-2 text-sm text-[#5b4635]">
                        Add the Google account identity here. After OAuth connection, the platform
                        will read the real shared quota automatically.
                      </p>
                      <div className="mt-4 grid gap-3">
                        <input
                          name="label"
                          placeholder="Internal label"
                          className="rounded-2xl border border-[#ddccb9] bg-white px-4 py-3 outline-none"
                          required
                        />
                        <input
                          name="googleEmail"
                          type="email"
                          placeholder="Hidden Google email"
                          className="rounded-2xl border border-[#ddccb9] bg-white px-4 py-3 outline-none"
                          required
                        />
                        <input
                          name="accountPassword"
                          type="text"
                          placeholder="Saved sign-in password"
                          className="rounded-2xl border border-[#ddccb9] bg-white px-4 py-3 outline-none"
                        />
                        <button
                          type="submit"
                          className="rounded-full bg-[#436b5c] px-5 py-3 text-sm font-semibold text-[#f7f2ea]"
                        >
                          Assign Account
                        </button>
                      </div>
                    </form>

                    <div className="rounded-[26px] bg-[#f7f0e7] p-4">
                      <p className="font-heading text-2xl font-semibold text-[#241b14]">
                        Linked Apple accounts
                      </p>
                      <div className="mt-4 grid gap-3">
                        {member.appleAccounts.length === 0 ? (
                          <div className="rounded-2xl bg-white px-4 py-4 text-sm text-[#5b4635]">
                            The member has not linked an Apple account yet.
                          </div>
                        ) : (
                          member.appleAccounts.map((account) => (
                            <div
                              key={account.id}
                              className="rounded-2xl bg-white px-4 py-4 text-sm text-[#5b4635]"
                            >
                              <p className="font-semibold text-[#241b14]">{account.label}</p>
                              <p>{account.appleEmail}</p>
                              <p className="mt-2">
                                {account.status}
                                {account.lastSync ? ` · ${formatDateTime(account.lastSync)}` : ""}
                              </p>
                            </div>
                          ))
                        )}
                      </div>
                      <Link
                        href={`/admin/google?user=${encodeURIComponent(member.id)}`}
                        className="mt-4 inline-block rounded-full border border-[#d8c0ae] bg-white px-5 py-3 text-sm font-semibold text-[#3b2d20]"
                      >
                        Manage Google Connections
                      </Link>
                    </div>
                  </div>
                </div>
              </section>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
