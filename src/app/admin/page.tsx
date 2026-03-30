import { redirect } from "next/navigation";
import { adminLoginAction } from "@/app/actions";
import { AdminLoginCard } from "@/components/admin-login-card";
import { getCurrentAdmin } from "@/lib/auth";

type AdminLoginPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminLoginPage({ searchParams }: AdminLoginPageProps) {
  const admin = await getCurrentAdmin();

  if (admin) {
    redirect("/admin/dashboard");
  }

  const params = searchParams ? await searchParams : undefined;
  const error = typeof params?.error === "string" ? params.error : undefined;

  return (
    <div className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] max-w-5xl items-center">
        <form action={adminLoginAction}>
          <AdminLoginCard error={error} />
        </form>
      </div>
    </div>
  );
}
