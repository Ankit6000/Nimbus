import { PendingSubmitButton } from "@/components/pending-submit-button";

type AdminLoginCardProps = {
  error?: string;
};

export function AdminLoginCard({ error }: AdminLoginCardProps) {
  return (
    <section className="glass-panel rounded-[30px] px-5 py-6 sm:px-8 sm:py-8">
      <p className="text-xs font-semibold uppercase tracking-[0.36em] text-[#8b6d52]">
        Nimbus Admin
      </p>
      <h1 className="font-heading mt-4 text-[2rem] font-semibold tracking-tight text-[#241b14] sm:text-4xl">
        Control members and hidden account assignments.
      </h1>
      <p className="mt-4 text-sm leading-7 text-[#5b4635]">
        This admin side lets you create members, decide how many hidden Google accounts they get,
        and manage whether iCloud sync appears for them.
      </p>

      <div className="mt-6 rounded-[28px] bg-[#221912] p-5 text-[#f8f0e7] sm:mt-8 sm:p-6">
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

        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-[#c9ab93]">
            Demo admin: <span className="font-semibold text-[#fff6ed]">admin / admin123</span>
          </p>
          <PendingSubmitButton
            idleLabel="Enter Admin"
            pendingLabel="Entering..."
            className="w-full rounded-full bg-[#f0bc8f] px-6 py-3 font-semibold text-[#241b14] transition hover:bg-[#f7c79f] sm:w-auto"
          />
        </div>
      </div>
    </section>
  );
}
