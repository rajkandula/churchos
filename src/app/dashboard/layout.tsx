import Link from "next/link";
import { redirect } from "next/navigation";
import { KeyRound } from "lucide-react";
import { getSession } from "@/lib/auth";
import { withDbRetry } from "@/lib/db";
import { User } from "@/models/User";
import { Navbar } from "@/components/Navbar";
import { ToastProvider } from "@/components/ui/Toast";
import { NO_ACCESS, resolveAccess, type Access } from "@/lib/access";
import { isSessionStale } from "@/lib/session-validity";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  // Unapproved accounts wait outside
  // On a cold start the DB can be briefly unreachable — render anyway
  // rather than crash the whole page; every API re-checks approval itself.
  let access: Access = NO_ACCESS;
  // Read from the database, never from the 7-day JWT: a demotion or a
  // password reset has to take effect on the next page load.
  let isSuperadmin = false;
  let mustSetPassword = false;
  try {
    const user = await withDbRetry(() =>
      User.findById(session.id)
        .select("status churchId isOwner churchRole role mustChangePassword sessionVersion")
        .lean()
    );
    if (!user) redirect("/login");
    // A password change, an admin reset or a disable revokes older cookies.
    if (isSessionStale(session, user)) redirect("/login?expired=1");
    if (user.status && user.status !== "approved") redirect("/pending");
    access = await resolveAccess(user);
    isSuperadmin = user.role === "superadmin";
    mustSetPassword = Boolean(user.mustChangePassword);
  } catch (err) {
    if (err && typeof err === "object" && "digest" in err) throw err; // redirects
    console.error("dashboard layout status check skipped:", err);
  }

  return (
    <ToastProvider>
      <div className="flex min-h-screen flex-col">
        <Navbar user={session} access={access} isSuperadmin={isSuperadmin} />
        {mustSetPassword && (
          // requireChurch() already blocks every app API for this account —
          // this is the visible half of that gate. A layout can't read the
          // pathname, so the strip stays up (including on the profile page)
          // until the password is actually changed.
          <div className="border-b border-amber-200 bg-amber-50 print:hidden">
            <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-x-2 gap-y-1 px-4 py-2.5 text-sm sm:px-6">
              <KeyRound className="h-4 w-4 shrink-0 text-amber-600" aria-hidden />
              <span className="font-semibold text-amber-900">
                You&apos;re still using a temporary password.
              </span>
              <Link
                href="/dashboard/profile?setPassword=1"
                className="font-semibold text-amber-800 underline underline-offset-2 transition-colors hover:text-amber-950"
              >
                Set your own password
              </Link>
            </div>
          </div>
        )}
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">
          {children}
        </main>
      </div>
    </ToastProvider>
  );
}
