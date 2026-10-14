import type { Metadata } from "next";
import Link from "next/link";
import { SearchX } from "lucide-react";
import { withDbRetry } from "@/lib/db";
import { findChurchByCode } from "@/lib/public-church";
import { INTEREST_OPTIONS } from "@/app/dashboard/connect/types";
import { ConnectForm } from "./ConnectForm";

type Props = { params: Promise<{ church: string }> };

export const metadata: Metadata = {
  title: "Connect card",
  description: "Tell us a little about yourself so we can say hello.",
};

/**
 * Public visitor card — reached via the QR code at the door. No sign-in.
 * Resolves the church code on the server so an unknown link shows a
 * friendly 404 instead of an empty form.
 */
export default async function PublicConnectPage({ params }: Props) {
  const { church: code } = await params;

  let church: { name: string; logoUrl: string } | null = null;
  let unavailable = false;
  try {
    const found = await withDbRetry(() => findChurchByCode(code));
    if (found) church = { name: found.name, logoUrl: found.logoUrl ?? "" };
  } catch (err) {
    console.error("public connect page:", err);
    unavailable = true;
  }

  if (!church) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#f6f7fb] px-4 py-12">
        <div className="animate-fade-up w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
            <SearchX className="h-7 w-7 text-slate-500" aria-hidden />
          </div>
          <h1 className="mt-5 text-2xl font-bold tracking-tight text-slate-900">
            {unavailable ? "We're having trouble right now" : "Church not found"}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">
            {unavailable
              ? "Please try again in a moment, or let someone at the welcome desk know."
              : "This connect card link doesn't match any church. Check the QR code or ask someone at the welcome desk for the right link."}
          </p>
          <Link
            href="/"
            className="mt-6 inline-flex h-10 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition-colors duration-200 hover:border-indigo-200 hover:text-indigo-600"
          >
            Go to ChurchOS
          </Link>
        </div>
      </div>
    );
  }

  return <ConnectForm code={code} church={church} interests={[...INTEREST_OPTIONS]} />;
}
