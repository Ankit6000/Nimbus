import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | Nimbus Vault",
  description: "Privacy policy for Nimbus Vault.",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl rounded-[32px] border border-[#ead9c8] bg-[#fffaf2] p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.34em] text-[#8b6d52]">Nimbus Vault</p>
        <h1 className="font-heading mt-4 text-4xl font-semibold tracking-tight text-[#241b14]">
          Privacy Policy
        </h1>
        <div className="mt-6 grid gap-6 text-sm leading-7 text-[#5b4635]">
          <section>
            <h2 className="font-heading text-2xl font-semibold text-[#241b14]">What we store</h2>
            <p className="mt-2">
              Nimbus Vault stores member account records, encrypted vault credentials, uploaded file metadata,
              synced mailbox metadata, and any files or notes a member explicitly adds to the vault.
            </p>
          </section>
          <section>
            <h2 className="font-heading text-2xl font-semibold text-[#241b14]">Connected services</h2>
            <p className="mt-2">
              When an administrator connects a storage or mailbox source, Nimbus Vault may access file metadata,
              storage quota information, and mailbox content required to render the member vault experience.
            </p>
          </section>
          <section>
            <h2 className="font-heading text-2xl font-semibold text-[#241b14]">How data is used</h2>
            <p className="mt-2">
              Data is used only to authenticate users, show vault content, store uploaded files, support admin
              management, and maintain the sync and activity history required by the product.
            </p>
          </section>
          <section>
            <h2 className="font-heading text-2xl font-semibold text-[#241b14]">Retention and deletion</h2>
            <p className="mt-2">
              Administrators can remove connected accounts and delete member records. When a vault item is deleted,
              Nimbus Vault removes the app-side record and, when applicable, the mirrored source file reference.
            </p>
          </section>
          <section>
            <h2 className="font-heading text-2xl font-semibold text-[#241b14]">Contact</h2>
            <p className="mt-2">
              Replace this section with your real support email and legal contact details before production launch.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
