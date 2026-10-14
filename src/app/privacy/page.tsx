import type { Metadata } from "next";
import Link from "next/link";
import { PublicNav } from "@/components/marketing/PublicNav";
import { PublicFooter } from "@/components/marketing/PublicFooter";

export const metadata: Metadata = {
  title: "Privacy policy — ChurchOS",
};

function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mt-10 text-xl font-bold tracking-tight text-slate-900">
      {children}
    </h2>
  );
}

export default function PrivacyPage() {
  return (
    <div className="flex min-h-screen flex-col bg-[#f6f7fb]">
      <PublicNav />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-14 sm:px-6">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900">
          Privacy policy
        </h1>
        <p className="mt-2 text-sm text-slate-400">Last updated: 31 August 2026</p>

        <div className="mt-8 space-y-4 leading-relaxed text-slate-600">
          <p>
            ChurchOS is church management software. Churches use it to run their
            administration — and that means churches entrust us with information
            about their members, families and staff. We take that seriously.
            This page explains, in plain language, what we collect and how we
            handle it.
          </p>

          <H2>What we collect</H2>
          <p>
            <strong className="text-slate-800">Account information</strong> —
            when a church administrator registers: their name, username, email,
            and church name.
          </p>
          <p>
            <strong className="text-slate-800">Church records</strong> — the
            information churches enter to run their operations: member and staff
            profiles (names, dates of birth, guardian contact details,
            addresses), giving records, pledges, attendance and check-ins, groups, events,
            certificates, announcements and uploaded documents. This data
            belongs to the church; ChurchOS processes it on the church&apos;s
            behalf.
          </p>
          <p>
            <strong className="text-slate-800">Enquiries</strong> — messages
            sent through our contact form, with the contact details you provide.
          </p>

          <H2>Children&apos;s data</H2>
          <p>
            Church records often describe children — kids check-in, dedications, Sunday school. Churches, as the
            guardians&apos; point of contact, are responsible for collecting
            this information lawfully and with appropriate consent, consistent
            with India&apos;s Digital Personal Data Protection Act, 2023. We
            process it only to provide the service to the church — never for
            advertising, profiling, or sale. We do not knowingly collect
            information directly from children.
          </p>

          <H2>How data is stored</H2>
          <p>
            Records are stored in a managed MongoDB database; uploaded files
            (photos, documents) are stored in object storage. Transactional
            email (password resets, notices, approvals) is delivered through
            our email provider. Passwords are stored only as salted bcrypt
            hashes — we cannot read them. Public pages (the visitor card and
            event registration forms) collect what a visitor types in and
            never show member contact details or addresses.
          </p>

          <H2>What we never do</H2>
          <p>
            We do not sell personal data. We do not show ads. We do not share
            church records with third parties except the infrastructure
            providers named above, strictly to run the service.
          </p>

          <H2>Data ownership &amp; deletion</H2>
          <p>
            The church owns its data. Churches can export their records (CSV
            exports are built into the product) and can request full deletion
            of their account and records at any time via our{" "}
            <Link href="/contact" className="font-semibold text-indigo-600 hover:text-indigo-700">
              contact page
            </Link>
            .
          </p>

          <H2>Changes &amp; contact</H2>
          <p>
            If this policy changes materially, registered administrators will
            be notified by email. Questions? Reach us through the{" "}
            <Link href="/contact" className="font-semibold text-indigo-600 hover:text-indigo-700">
              contact page
            </Link>
            .
          </p>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
