import Link from "next/link";
import { ArrowRight, Lock, RotateCw, ShieldCheck, TriangleAlert } from "lucide-react";
import { getSession } from "@/lib/auth";
import { withDbRetry } from "@/lib/db";
import { User } from "@/models/User";
import { Church } from "@/models/Church";
import { DashboardPref } from "@/models/DashboardPref";
import { canOpen, canManageUsers, resolveAccess, NO_ACCESS, type Access } from "@/lib/access";
import { LAUNCHER_APPS } from "@/lib/apps";
import { AppLauncher } from "./AppLauncher";
import {
  DEFAULT_PREFS,
  normalizePrefs,
  type DashboardPrefs,
  type LauncherApp,
} from "./dashboard-prefs";

type Props = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function DashboardPage({ searchParams }: Props) {
  const session = await getSession();
  const firstName = session?.name.split(" ")[0] ?? "there";
  // The navbar's "Arrange dashboard" item lands here with ?customize=1 —
  // it keys <AppLauncher>, so arriving with the flag mounts the panel open.
  const customize = (await searchParams).customize === "1";

  // The church's live name, this user's app access, and their own launcher
  // arrangement — from the DB, not the JWT snapshot, so role changes apply
  // on the next page load.
  let churchName = session?.churchName ?? "";
  let access: Access = NO_ACCESS;
  let prefs: DashboardPrefs = { ...DEFAULT_PREFS };
  let checkFailed = false;
  if (session) {
    try {
      const account = await withDbRetry(() =>
        User.findById(session.id).select("churchId isOwner churchRole").lean()
      );
      if (account?.churchId) {
        const church = await Church.findById(account.churchId).select("name").lean();
        if (church?.name) churchName = church.name;
        access = await resolveAccess(account);
        // Private to this user — never shared with the rest of the church.
        const saved = await DashboardPref.findOne({
          churchId: account.churchId,
          user: session.id,
        })
          .select("order hidden density")
          .lean();
        prefs = normalizePrefs(saved);
      }
    } catch (err) {
      console.error("dashboard access check failed:", err);
      checkFailed = true;
    }
  }

  // Plain objects so the arrangement can be applied on both sides of the wire
  const apps: LauncherApp[] = LAUNCHER_APPS.filter((a) => canOpen(access, a.key)).map(
    ({ key, name, description, href, accent }) => ({
      key,
      name,
      description,
      href,
      accent,
    })
  );

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  if (checkFailed) {
    // We don't know what this user can open, so we claim neither.
    // A plain anchor re-runs the whole check on the server.
    return (
      <div className="animate-fade-up">
        <div className="mx-auto mt-16 max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
            <TriangleAlert className="h-7 w-7 text-slate-500" aria-hidden />
          </div>
          <h1 className="mt-5 text-xl font-bold tracking-tight text-slate-900">
            Couldn&apos;t check your access
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">
            We couldn&apos;t reach the server to load your apps. Nothing is wrong
            with your account — please retry in a moment.
          </p>
          <a
            href="/dashboard"
            className="mt-6 inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-indigo-700"
          >
            <RotateCw className="h-4 w-4" aria-hidden />
            Try again
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-up">
      <AppLauncher
        key={customize ? "launcher-customize" : "launcher"}
        apps={apps}
        prefs={prefs}
        initialCustomizeOpen={customize}
      >
        <p className="text-sm font-medium text-indigo-600">{greeting}</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          {firstName}, welcome to {churchName || "your church"}.
        </h1>
        <p className="mt-2 text-sm text-slate-500 sm:text-base">
          {access.roleName && !access.isOwner
            ? `Signed in as ${access.roleName}. Pick an app to get started.`
            : "Pick an app to get started."}
        </p>
      </AppLauncher>

      {apps.length === 0 && (
        <div className="mx-auto mt-12 max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50">
            <Lock className="h-7 w-7 text-amber-600" aria-hidden />
          </div>
          <h2 className="mt-5 text-xl font-bold tracking-tight text-slate-900">
            No apps yet
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">
            Your account doesn&apos;t have a role with any apps. Ask your church
            admin to assign you one.
          </p>
        </div>
      )}

      {canManageUsers(access) && (
        <Link
          href="/dashboard/users"
          className="mt-6 flex items-center gap-4 rounded-2xl border border-dashed border-slate-300 bg-white/60 px-5 py-4 transition-colors hover:border-indigo-300 hover:bg-indigo-50/40"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 to-orange-600 text-white shadow-md">
            <ShieldCheck className="h-5 w-5" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold text-slate-900">Users &amp; roles</span>
            <span className="block text-xs text-slate-500">
              Add your team, create roles, and choose which apps each role can open.
            </span>
          </span>
          <ArrowRight className="h-4 w-4 text-slate-400" aria-hidden />
        </Link>
      )}
    </div>
  );
}
