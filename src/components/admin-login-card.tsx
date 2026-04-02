import { PendingSubmitButton } from "@/components/pending-submit-button";

type AdminLoginCardProps = {
  error?: string;
};

export function AdminLoginCard({ error }: AdminLoginCardProps) {
  return (
    <section className="glass-panel rounded-[32px] px-7 py-8 sm:px-9 sm:py-9">
      <p className="text-xs font-semibold uppercase tracking-[0.36em] text-[#8b6d52]">
        Nimbus Admin
      </p>
      <h1 className="font-heading mt-4 text-4xl font-semibold tracking-tight text-[#241b14]">
        Control members and hidden account assignments.
      </h1>
      <p className="mt-4 text-sm leading-7 text-[#5b4635]">
        This admin side lets you create members, decide how many hidden Google accounts they get,
        and manage whether iCloud sync appears for them.
      </p>

      <div className="mt-8 rounded-[28px] bg-[#221912] p-6 text-[#f8f0e7]">
        <div className="grid gap-4">
          <label className="grid gap-2">
            <span className="text-sm text-[#e5d7ca]">Admin username or email</span>
            <input
              name="identifier"
              required
              className="rounded-2xl border border-[#4a392d] bg-[#2e231b] px-4 py-3 text-[#fff6ed] outline-none transition focus:border-[#e39c6d]"
              placeholder="admin or admin@nimbus.local"
            />
          </label>
          <label className="grid gap-2">
            <span className="text-sm text-[#e5d7ca]">Password</span>
            <input
              name="password"
              type="password"
              required
              className="rounded-2xl border border-[#4a392d] bg-[#2e231b] px-4 py-3 text-[#fff6ed] outline-none transition focus:border-[#e39c6d]"
              placeholder="Enter admin password"
            />
          </label>
        </div>

        {error ? (
          <p className="mt-4 rounded-2xl border border-[#7b3d31] bg-[#392019] px-4 py-3 text-sm text-[#f7c4b6]">
            Admin login failed. Use the seeded admin credentials or your own admin account.
          </p>
        ) : null}

        <div className="mt-6 flex items-center justify-between gap-4">
          <p className="text-sm text-[#c9ab93]">
            Demo admin: <span className="font-semibold text-[#fff6ed]">admin / admin123</span>
          </p>
          <PendingSubmitButton
            idleLabel="Enter Admin"
            pendingLabel="Entering..."
            className="rounded-full bg-[#f0bc8f] px-6 py-3 font-semibold text-[#241b14] transition hover:bg-[#f7c79f]"
          />
        </div>
      </div>
    </section>
  );
}
