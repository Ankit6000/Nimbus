import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service | Nimbus Vault",
  description: "Terms of service for Nimbus Vault.",
};

export default function TermsPage() {
  return (
    <main className="min-h-screen px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl rounded-[32px] border border-[#ead9c8] bg-[#fffaf2] p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.34em] text-[#8b6d52]">Nimbus Vault</p>
        <h1 className="font-heading mt-4 text-4xl font-semibold tracking-tight text-[#241b14]">
          Terms of Service
        </h1>
        <div className="mt-6 grid gap-6 text-sm leading-7 text-[#5b4635]">
          <section>
            <h2 className="font-heading text-2xl font-semibold text-[#241b14]">Service access</h2>
            <p className="mt-2">
              Nimbus Vault is a private service. Member access is granted only through accounts created by an administrator.
            </p>
          </section>
          <section>
            <h2 className="font-heading text-2xl font-semibold text-[#241b14]">Acceptable use</h2>
            <p className="mt-2">
              Users may not use the service to store unlawful material, attempt unauthorized access, or disrupt the
              availability of the vault or connected services.
            </p>
          </section>
          <section>
            <h2 className="font-heading text-2xl font-semibold text-[#241b14]">Third-party services</h2>
            <p className="mt-2">
              Nimbus Vault may rely on third-party storage, mailbox, or hosting providers. Availability and access
              may be affected by those providers.
            </p>
          </section>
          <section>
            <h2 className="font-heading text-2xl font-semibold text-[#241b14]">Security responsibilities</h2>
            <p className="mt-2">
              Administrators are responsible for securing connected account credentials, rotating secrets when needed,
              and limiting access to trusted users.
            </p>
          </section>
          <section>
            <h2 className="font-heading text-2xl font-semibold text-[#241b14]">Contact</h2>
            <p className="mt-2">
              Replace this section with your real business/legal contact details before production launch.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
