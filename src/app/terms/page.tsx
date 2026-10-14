import type { Metadata } from "next";
import Link from "next/link";
import { PublicNav } from "@/components/marketing/PublicNav";
import { PublicFooter } from "@/components/marketing/PublicFooter";

export const metadata: Metadata = {
  title: "Terms of service — ChurchOS",
};

function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mt-10 text-xl font-bold tracking-tight text-slate-900">
      {children}
    </h2>
  );
}

export default function TermsPage() {
  return (
    <div className="flex min-h-screen flex-col bg-[#f6f7fb]">
      <PublicNav />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-14 sm:px-6">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900">
          Terms of service
        </h1>
        <p className="mt-2 text-sm text-slate-400">Last updated: 31 August 2026</p>

        <div className="mt-8 space-y-4 leading-relaxed text-slate-600">
          <p>
            These terms govern the use of ChurchOS. By registering a church or
            using the service, you agree to them.
          </p>

          <H2>Accounts &amp; approval</H2>
          <p>
            Anyone may register a church, but accounts are activated only after
            review and approval by the ChurchOS team. We may decline or revoke
            accounts that misrepresent a church, misuse the platform, or breach
            these terms. You are responsible for keeping your credentials
            secure and for actions taken under your account.
          </p>

          <H2>Acceptable use</H2>
          <p>
            ChurchOS is for genuine church administration. You agree not to use
            it to store unlawful content, to send spam through its notice or
            email features, to attempt unauthorised access to other churches&apos;
            data, or to disrupt the service. Guardian contact details entered in
            the system may be used only for legitimate church communication.
          </p>

          <H2>Your data</H2>
          <p>
            The church owns the records it creates. We process them solely to
            provide the service, as described in our{" "}
            <Link href="/privacy" className="font-semibold text-indigo-600 hover:text-indigo-700">
              privacy policy
            </Link>
            . You can export your data at any time, and request deletion when
            you leave.
          </p>

          <H2>Service &amp; availability</H2>
          <p>
            We work to keep ChurchOS fast, secure and available, but the service
            is provided &quot;as is&quot; without warranties of uninterrupted
            availability. Churches should retain their own copies of critical
            documents. Features may evolve; material changes that affect your
            use will be communicated.
          </p>

          <H2>Fees</H2>
          <p>
            Current registrations are free. If paid plans are introduced,
            pricing will be communicated clearly in advance, and no church will
            be charged without explicitly opting in.
          </p>

          <H2>Liability</H2>
          <p>
            To the maximum extent permitted by law, ChurchOS is not liable for
            indirect or consequential losses arising from use of the service.
            Nothing in these terms limits liability that cannot be limited
            under law.
          </p>

          <H2>Termination</H2>
          <p>
            You may stop using ChurchOS at any time and request deletion of your
            data. We may suspend accounts that breach these terms, with notice
            where practical.
          </p>

          <H2>Governing law</H2>
          <p>
            These terms are governed by the laws of India. Questions about
            them? Reach us via the{" "}
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
