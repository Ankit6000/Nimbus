type LoginCardProps = {
  error?: string;
};

export function LoginCard({ error }: LoginCardProps) {
  return (
    <section className="glass-panel relative overflow-hidden rounded-[32px] px-7 py-7 sm:px-9 sm:py-9">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#c55c32] via-[#b89132] to-[#436b5c]" />
      <div className="mb-8 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.36em] text-[#8b6d52]">
            Nimbus Vault
          </p>
          <h1 className="font-heading mt-3 text-4xl font-semibold tracking-tight text-[#241b14]">
            One login. Hidden storage rails.
          </h1>
        </div>
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#f7dfd3] text-lg font-semibold text-[#76321a]">
          NV
        </div>
      </div>

      <div className="grid gap-4 rounded-[24px] border border-[#ead9c8] bg-[#fffaf2] p-5 text-sm text-[#5b4635]">
        <p>
          Assigned accounts stay behind the scenes. Your member signs into this portal once and
          sees a single vault for photos, files, notes, mail, passwords, and imported message
          archives.
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-[#f4ebe0] p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-[#8b6d52]">Aggregated</p>
            <p className="mt-2 text-xl font-semibold text-[#241b14]">Combined quota</p>
          </div>
          <div className="rounded-2xl bg-[#f4ebe0] p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-[#8b6d52]">Private</p>
            <p className="mt-2 text-xl font-semibold text-[#241b14]">Hidden channels</p>
          </div>
          <div className="rounded-2xl bg-[#f4ebe0] p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-[#8b6d52]">Ready</p>
            <p className="mt-2 text-xl font-semibold text-[#241b14]">Sync hooks</p>
          </div>
        </div>
      </div>

      <div className="mt-8 rounded-[28px] bg-[#221912] p-6 text-[#f8f0e7] shadow-2xl">
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

        <div className="mt-6 flex items-center justify-between gap-4">
          <div className="text-sm text-[#c9ab93]">
            Demo account: <span className="font-semibold text-[#fff6ed]">amber / vault123</span>
          </div>
          <button
            type="submit"
            className="rounded-full bg-[#f0bc8f] px-6 py-3 font-semibold text-[#241b14] transition hover:bg-[#f7c79f]"
          >
            Enter Vault
          </button>
        </div>
      </div>
    </section>
  );
}
