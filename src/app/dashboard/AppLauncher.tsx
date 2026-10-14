"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { ArrowRight, LayoutGrid } from "lucide-react";
import { useState, type ReactNode } from "react";
import { APP_ICONS } from "@/lib/app-icons";
import { Button } from "@/components/ui/Button";
import {
  arrangeApps,
  type DashboardPrefs,
  type LauncherApp,
} from "./dashboard-prefs";

// Browser-only: the panel arrives already open when the navbar sends someone
// here with ?customize=1, and Drawer portals into document.body — which does
// not exist while the page is being rendered on the server.
const CustomizeAppsDrawer = dynamic(
  () => import("./CustomizeAppsDrawer").then((m) => m.CustomizeAppsDrawer),
  { ssr: false }
);

/** The compact tile — mobile's home-screen look, now available everywhere. */
function AppTile({ app }: { app: LauncherApp }) {
  const Icon = APP_ICONS[app.key];
  return (
    <Link
      href={app.href}
      className="flex flex-col items-center gap-2.5 rounded-2xl border border-slate-200 bg-white px-2 py-4 shadow-sm transition-transform duration-150 active:scale-95"
    >
      <span
        className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${app.accent} text-white shadow-md`}
      >
        <Icon className="h-6 w-6" aria-hidden />
      </span>
      <span className="text-center text-xs leading-tight font-semibold text-slate-800">
        {app.name}
      </span>
    </Link>
  );
}

/** The roomy card — icon, name, description, "Open app". */
function AppCard({ app }: { app: LauncherApp }) {
  const Icon = APP_ICONS[app.key];
  return (
    <Link
      href={app.href}
      className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-lg hover:shadow-indigo-600/10"
    >
      <div
        className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${app.accent} text-white shadow-md shadow-indigo-600/25`}
      >
        <Icon className="h-6 w-6" aria-hidden />
      </div>
      <h2 className="mt-4 text-lg font-bold text-slate-900">{app.name}</h2>
      <p className="mt-1 text-sm leading-relaxed text-slate-500">
        {app.description}
      </p>
      <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-600">
        Open app
        <ArrowRight
          className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
          aria-hidden
        />
      </span>
    </Link>
  );
}

/**
 * The dashboard launcher, arranged the way this person asked for.
 *
 * The arrangement is applied on the server too (the same pure helper), so
 * the first paint is already correct — this component only owns the
 * Customize panel. `initialCustomizeOpen` comes from ?customize=1, which is
 * how the navbar item opens the panel from any page; the page keys this
 * component on that flag so arriving with it always mounts the panel open.
 */
export function AppLauncher({
  apps,
  prefs,
  initialCustomizeOpen = false,
  children,
}: {
  apps: LauncherApp[];
  prefs: DashboardPrefs;
  initialCustomizeOpen?: boolean;
  /** The greeting block — server-rendered, sits beside the Customize button. */
  children: ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(initialCustomizeOpen);
  const { visible } = arrangeApps(apps, prefs);
  const compact = prefs.density === "compact";

  /** Drop ?customize=1 so the navbar item can open the panel again. */
  function clearFlag() {
    if (initialCustomizeOpen) router.replace("/dashboard", { scroll: false });
  }

  function close() {
    setOpen(false);
    clearFlag();
  }

  function saved() {
    setOpen(false);
    clearFlag();
    router.refresh();
  }

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">{children}</div>
        {apps.length > 0 && (
          <Button
            variant="secondary"
            onClick={() => setOpen(true)}
            className="shrink-0"
          >
            <LayoutGrid className="h-4 w-4" aria-hidden />
            Customize
          </Button>
        )}
      </div>

      {visible.length === 0 && apps.length > 0 && (
        <p className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white/60 px-5 py-6 text-center text-sm text-slate-500">
          Every app is hidden right now.{" "}
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="cursor-pointer font-semibold text-indigo-600 hover:underline"
          >
            Show some again
          </button>
          .
        </p>
      )}

      {compact ? (
        <div className="mt-6 grid grid-cols-3 gap-3 sm:mt-8 sm:grid-cols-4 lg:grid-cols-6">
          {visible.map((app) => (
            <AppTile key={app.key} app={app} />
          ))}
        </div>
      ) : (
        <>
          {/* Mobile: home-screen tile grid — every app visible without scrolling */}
          <div className="mt-6 grid grid-cols-3 gap-3 sm:hidden">
            {visible.map((app) => (
              <AppTile key={app.key} app={app} />
            ))}
          </div>

          {/* Desktop: descriptive cards */}
          <div className="mt-8 hidden gap-4 sm:grid sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((app) => (
              <AppCard key={app.key} app={app} />
            ))}
          </div>
        </>
      )}

      {open && (
        <CustomizeAppsDrawer
          open
          onClose={close}
          onSaved={saved}
          apps={apps}
          prefs={prefs}
        />
      )}
    </>
  );
}
