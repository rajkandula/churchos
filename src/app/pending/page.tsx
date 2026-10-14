import { redirect } from "next/navigation";
import { Hourglass, ShieldX } from "lucide-react";
import { getSession } from "@/lib/auth";
import { withDbRetry } from "@/lib/db";
import { User } from "@/models/User";
import { BrandMark } from "@/components/BrandMark";
import { SignOutButton } from "./SignOutButton";

export default async function PendingPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  let rejected = false;
  let disabled = false;
  try {
    const user = await withDbRetry(() => User.findById(session.id).lean());
    if (!user) redirect("/login");
    if (!user.status || user.status === "approved") redirect("/dashboard");
    rejected = user.status === "rejected";
    disabled = user.status === "disabled";
  } catch (err) {
    if (err && typeof err === "object" && "digest" in err) throw err; // redirects
    console.error("pending page status check skipped:", err);
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <BrandMark />
      <div className="mt-8 w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm animate-fade-up">
        <div
          className={`mx-auto flex h-14 w-14 items-center justify-center rounded-2xl ${
            rejected || disabled ? "bg-rose-50" : "bg-amber-50"
          }`}
        >
          {rejected || disabled ? (
            <ShieldX className="h-7 w-7 text-rose-600" aria-hidden />
          ) : (
            <Hourglass className="h-7 w-7 text-amber-600" aria-hidden />
          )}
        </div>
        <h1 className="mt-5 text-2xl font-bold tracking-tight text-slate-900">
          {disabled
            ? "Account disabled"
            : rejected
              ? "Registration not approved"
              : "Awaiting approval"}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">
          {disabled
            ? "Your church admin has disabled this account. Contact them if you think this is a mistake."
            : rejected
            ? "Your registration was reviewed and not approved. If you believe this is a mistake, please contact the administrator."
            : `Thanks for registering ${session.churchName ? `“${session.churchName}”` : "your church"}, ${session.name.split(" ")[0]}. The administrator has been notified and will review your account — you'll get an email at ${session.email} the moment it's approved.`}
        </p>
        <div className="mt-8">
          <SignOutButton />
        </div>
      </div>
    </div>
  );
}
