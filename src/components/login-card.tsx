import Link from "next/link";
import { PendingSubmitButton } from "@/components/pending-submit-button";

type LoginCardProps = {
  error?: string;
};

export function LoginCard({ error }: LoginCardProps) {
  const showDemoCredentials =
    process.env.NEXT_PUBLIC_SHOW_DEMO_CREDENTIALS === "true" ||
    (process.env.NEXT_PUBLIC_SHOW_DEMO_CREDENTIALS == null && process.env.NODE_ENV !== "production");

  return (
    <section className="glass-panel relative overflow-hidden rounded-[30px] px-5 py-6 sm:px-8 sm:py-8">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#c55c32] via-[#b89132] to-[#436b5c]" />
      <div className="mb-6 flex items-start justify-between gap-4 sm:mb-8 sm:items-center">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.36em] text-[#8b6d52]">
            Nimbus Vault
          </p>
          <h1 className="font-heading mt-3 text-[2rem] font-semibold tracking-tight text-[#241b14] sm:text-4xl">
            One login. Hidden storage rails.
          </h1>
        </div>
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#f7dfd3] text-sm font-semibold text-[#76321a] sm:h-16 sm:w-16 sm:text-lg">
          NV
        </div>
      </div>

      <div className="grid gap-4 rounded-[24px] border border-[#ead9c8] bg-[#fffaf2] p-4 text-sm text-[#5b4635] sm:p-5">
        <p>
          Assigned accounts stay behind the scenes. Your member signs into this portal once and
          sees a single vault for photos, files, notes, mail, passwords, and imported message
          archives.
        </p>
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
          <div className="rounded-2xl bg-[#f4ebe0] p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-[#8b6d52]">Aggregated</p>
            <p className="mt-2 text-lg font-semibold text-[#241b14] sm:text-xl">Combined quota</p>
          </div>
          <div className="rounded-2xl bg-[#f4ebe0] p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-[#8b6d52]">Private</p>
            <p className="mt-2 text-lg font-semibold text-[#241b14] sm:text-xl">Hidden channels</p>
          </div>
          <div className="rounded-2xl bg-[#f4ebe0] p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-[#8b6d52]">Ready</p>
            <p className="mt-2 text-lg font-semibold text-[#241b14] sm:text-xl">Sync hooks</p>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-[28px] bg-[#221912] p-5 text-[#f8f0e7] shadow-2xl sm:mt-8 sm:p-6">
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#c9ab93]">
            Member Access
          </p>
          <p className="mt-2 text-sm text-[#e5d7ca]">
            Use the credentials you created for the member. Public signup is disabled.
          </p>
        </div>

        <div className="grid gap-4">
          <label className="grid gap-2">
            <span className="text-sm text-[#e5d7ca]">Username or email</span>
            <input
              name="identifier"
              required
              className="rounded-2xl border border-[#4a392d] bg-[#2e231b] px-4 py-3 text-[#fff6ed] outline-none transition focus:border-[#e39c6d]"
              placeholder="amber or amber@nimbus.local"
            />
          </label>
          <label className="grid gap-2">
            <span className="text-sm text-[#e5d7ca]">Password</span>
            <input
              name="password"
              type="password"
              required
              className="rounded-2xl border border-[#4a392d] bg-[#2e231b] px-4 py-3 text-[#fff6ed] outline-none transition focus:border-[#e39c6d]"
              placeholder="Enter member password"
            />
          </label>
        </div>

        {error ? (
          <p className="mt-4 rounded-2xl border border-[#7b3d31] bg-[#392019] px-4 py-3 text-sm text-[#f7c4b6]">
            Invalid credentials. Try the assigned username/email and password again.
          </p>
        ) : null}

        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-[#c9ab93]">
            {showDemoCredentials ? (
              <>
                Demo account: <span className="font-semibold text-[#fff6ed]">amber / vault123</span>
              </>
            ) : (
              "Use the credentials created by your administrator."
            )}
          </div>
          <PendingSubmitButton
            idleLabel="Enter Vault"
            pendingLabel="Entering..."
            className="w-full rounded-full bg-[#f0bc8f] px-6 py-3 font-semibold text-[#241b14] transition hover:bg-[#f7c79f] sm:w-auto"
          />
        </div>

        <div className="mt-5 flex flex-wrap gap-4 text-sm text-[#c9ab93]">
          <Link href="/privacy" className="transition hover:text-[#fff6ed]">
            Privacy Policy
          </Link>
          <Link href="/terms" className="transition hover:text-[#fff6ed]">
            Terms of Service
          </Link>
        </div>
      </div>
    </section>
  );
}
