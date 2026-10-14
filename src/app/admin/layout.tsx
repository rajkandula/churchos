import Link from "next/link";
import { redirect } from "next/navigation";
import { Building2 } from "lucide-react";
import { getSession } from "@/lib/auth";
import { withDbRetry } from "@/lib/db";
import { User } from "@/models/User";
import { ToastProvider } from "@/components/ui/Toast";
import { isSessionStale } from "@/lib/session-validity";

// The company console — platform owners only. The role check reads the
// database so a fresh promotion works without re-login.
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  // Fail closed: the console is only rendered when the check actually
  // said yes. A transient DB error must not expose it.
  try {
    const user = await withDbRetry(() =>
      User.findById(session.id).select("role sessionVersion").lean()
    );
    if (!user) redirect("/login");
    if (isSessionStale(session, user)) redirect("/login?expired=1");
    if (user.role !== "superadmin") redirect("/dashboard");
  } catch (err) {
    if (err && typeof err === "object" && "digest" in err) throw err; // redirects
    console.error("admin layout role check failed:", err);
    redirect("/dashboard");
  }

  return (
    <ToastProvider>
      <div className="flex min-h-screen flex-col">
        <header className="sticky top-0 z-40 border-b border-slate-700 bg-slate-900">
          <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
            <span className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-white">
                <Building2 className="h-4.5 w-4.5" aria-hidden />
              </span>
              <span className="font-bold tracking-tight text-white">
                Church<span className="text-indigo-400">OS</span>
                <span className="ml-2 text-sm font-medium text-slate-400">
                  Company console
                </span>
              </span>
            </span>
            <Link
              href="/dashboard"
              className="text-sm font-semibold text-slate-300 transition-colors duration-200 hover:text-white"
            >
              ← Church dashboard
            </Link>
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">
          {children}
        </main>
      </div>
    </ToastProvider>
  );
}
