import { redirect } from "next/navigation";
import { loginAction } from "@/app/actions";
import { LoginCard } from "@/components/login-card";
import { getCurrentUser } from "@/lib/auth";

type HomePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function HomePage({ searchParams }: HomePageProps) {
  const user = await getCurrentUser();

  if (user) {
    redirect("/dashboard");
  }

  const params = searchParams ? await searchParams : undefined;
  const error = typeof params?.error === "string" ? params.error : undefined;

  return (
    <div className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] max-w-7xl items-center gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="glass-panel relative overflow-hidden rounded-[40px] px-7 py-10 sm:px-10 sm:py-12">
          <div className="absolute -left-16 top-24 h-48 w-48 rounded-full bg-[#efc7b4]/70 blur-3xl" />
          <div className="absolute bottom-10 right-8 h-40 w-40 rounded-full bg-[#b89132]/20 blur-3xl" />

          <p className="text-xs font-semibold uppercase tracking-[0.42em] text-[#8b6d52]">
            Private Cloud Control
          </p>
          <h2 className="font-heading mt-5 max-w-3xl text-5xl font-semibold tracking-tight text-[#241b14] sm:text-6xl">
            Build one hidden vault over many assigned storage accounts.
          </h2>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-[#5b4635]">
            This MVP keeps the user experience clean: one credential, one dashboard, one combined
            quota, while your assigned channels stay invisible in the backend.
          </p>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            <div className="rounded-[28px] border border-[#ead9c8] bg-[#fffaf2] p-5">
              <p className="text-xs uppercase tracking-[0.24em] text-[#8b6d52]">Dashboard</p>
              <p className="mt-3 text-2xl font-semibold text-[#241b14]">Unified storage</p>
              <p className="mt-2 text-sm leading-6 text-[#5b4635]">
                Total used and free space across assigned Google-backed pools.
              </p>
            </div>
            <div className="rounded-[28px] border border-[#ead9c8] bg-[#fffaf2] p-5">
              <p className="text-xs uppercase tracking-[0.24em] text-[#8b6d52]">Sections</p>
              <p className="mt-3 text-2xl font-semibold text-[#241b14]">Vault modules</p>
              <p className="mt-2 text-sm leading-6 text-[#5b4635]">
                Photos, drive, passwords, notes, messages, and mail views.
              </p>
            </div>
            <div className="rounded-[28px] border border-[#ead9c8] bg-[#fffaf2] p-5">
              <p className="text-xs uppercase tracking-[0.24em] text-[#8b6d52]">Sync</p>
              <p className="mt-3 text-2xl font-semibold text-[#241b14]">iCloud hook</p>
              <p className="mt-2 text-sm leading-6 text-[#5b4635]">
                Ready for a future importer flow, with a button already placed on the dashboard.
              </p>
            </div>
          </div>
        </section>

        <form action={loginAction}>
          <LoginCard error={error} />
        </form>
      </div>
    </div>
  );
}
