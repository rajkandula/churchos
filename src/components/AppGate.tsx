import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Lock, RotateCw, TriangleAlert } from "lucide-react";
import { getSession } from "@/lib/auth";
import { withDbRetry } from "@/lib/db";
import { User } from "@/models/User";
import { canOpen, resolveAccess } from "@/lib/access";
import { isSessionStale } from "@/lib/session-validity";
import { APPS, appName, type AppKey } from "@/lib/apps";

function BackToDashboard() {
  return (
    <Link
      href="/dashboard"
      className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors duration-200 hover:text-indigo-600"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden />
      Dashboard
    </Link>
  );
}

/**
 * Server-side gate for an app's pages. Each app folder under /dashboard has
 * a layout.tsx that wraps its children in <AppGate app="…">. The API routes
 * enforce the same rule independently via requireChurch(app).
 */
export async function AppGate({
  app,
  children,
}: {
  app: AppKey;
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  // Fail closed: a page is rendered only when the check actually said yes.
  let allowed = false;
  let checkFailed = false;
  try {
    const user = await withDbRetry(() =>
      User.findById(session.id)
        .select("isOwner churchRole churchId status sessionVersion")
        .lean()
    );
    if (!user) redirect("/login");
    if (isSessionStale(session, user)) redirect("/login?expired=1");
    const access = await resolveAccess(user);
    allowed = canOpen(access, app);
  } catch (err) {
    if (err && typeof err === "object" && "digest" in err) throw err; // redirects
    console.error("app gate check failed:", err);
    checkFailed = true;
  }

  if (checkFailed) {
    // We don't know whether this user may open the app, so we claim neither.
    // A plain anchor re-runs the check from scratch on the server.
    const href = APPS.find((a) => a.key === app)?.href ?? "/dashboard";
    return (
      <div className="animate-fade-up">
        <BackToDashboard />
        <div className="mx-auto mt-16 max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
            <TriangleAlert className="h-7 w-7 text-slate-500" aria-hidden />
          </div>
          <h1 className="mt-5 text-xl font-bold tracking-tight text-slate-900">
            Couldn&apos;t check your access
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">
            We couldn&apos;t reach the server to confirm what you can open. Nothing
            is wrong with your account — please retry in a moment.
          </p>
          <a
            href={href}
            className="mt-6 inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-indigo-700"
          >
            <RotateCw className="h-4 w-4" aria-hidden />
            Try again
          </a>
        </div>
      </div>
    );
  }

  if (allowed) return <>{children}</>;

  return (
    <div className="animate-fade-up">
      <BackToDashboard />
      <div className="mx-auto mt-16 max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50">
          <Lock className="h-7 w-7 text-amber-600" aria-hidden />
        </div>
        <h1 className="mt-5 text-xl font-bold tracking-tight text-slate-900">
          No access to {appName(app)}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">
          Your role doesn&apos;t include this app. Ask your church admin to add{" "}
          {appName(app)} to your role, or to move you to a role that has it.
        </p>
      </div>
    </div>
  );
}
