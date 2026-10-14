"use client";

import { ADMIN_APP_KEYS, APPS, APP_KEYS, type AppKey } from "@/lib/apps";
import { APP_ICONS } from "@/lib/app-icons";

/**
 * What a role actually opens, shown as chips: granted apps in colour, the rest
 * struck through in grey — so a reader sees both halves of the decision at a
 * glance. Administration sits in its own row because granting it is bigger.
 */

type AppEntry = (typeof APPS)[number];

const LAUNCHER_ENTRIES: AppEntry[] = APPS.filter((a) => !ADMIN_APP_KEYS.includes(a.key));
const ADMIN_ENTRIES: AppEntry[] = APPS.filter((a) => ADMIN_APP_KEYS.includes(a.key));
const TOTAL_APPS = APP_KEYS.length;

function AppChip({
  app,
  granted,
  admin = false,
}: {
  app: AppEntry;
  granted: boolean;
  admin?: boolean;
}) {
  const Icon = APP_ICONS[app.key];
  const tone = !granted
    ? "border-slate-200 bg-slate-50 text-slate-400 line-through decoration-slate-300"
    : admin
      ? "border-rose-200 bg-rose-50 text-rose-700"
      : "border-indigo-200 bg-indigo-50 text-indigo-700";
  return (
    <span
      title={granted ? `Can open ${app.name}` : `Cannot open ${app.name}`}
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${tone}`}
    >
      <Icon className={`h-3 w-3 ${granted ? "" : "opacity-50"}`} aria-hidden />
      {app.name}
      <span className="sr-only">{granted ? " — allowed" : " — not allowed"}</span>
    </span>
  );
}

export function AppAccessPreview({
  apps,
  compact = false,
  limit = 3,
  className = "",
}: {
  apps: AppKey[];
  /** Row-sized version: granted chips only, plus a "+N more" affordance. */
  compact?: boolean;
  /** How many chips compact mode shows before it counts the rest. */
  limit?: number;
  className?: string;
}) {
  const granted = new Set(apps);
  const grantedEntries = APPS.filter((a) => granted.has(a.key));
  const adminGranted = ADMIN_ENTRIES.filter((a) => granted.has(a.key));

  if (compact) {
    if (grantedEntries.length === 0) {
      return (
        <p className={`text-[11px] font-semibold text-amber-600 ${className}`}>
          No apps — can&apos;t open anything
        </p>
      );
    }
    const shown = grantedEntries.slice(0, limit);
    const rest = grantedEntries.slice(limit);
    return (
      <div className={`flex flex-wrap items-center gap-1 ${className}`}>
        {shown.map((app) => (
          <AppChip
            key={app.key}
            app={app}
            granted
            admin={ADMIN_APP_KEYS.includes(app.key)}
          />
        ))}
        {rest.length > 0 && (
          <span
            title={rest.map((a) => a.name).join(", ")}
            className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-500"
          >
            +{rest.length} more
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 ${className}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[13px] font-semibold text-slate-700" aria-live="polite">
          Opens {grantedEntries.length} of {TOTAL_APPS} apps
        </p>
        {adminGranted.length > 0 && (
          <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700 ring-1 ring-rose-600/20">
            Includes administration
          </span>
        )}
      </div>

      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {LAUNCHER_ENTRIES.map((app) => (
          <AppChip key={app.key} app={app} granted={granted.has(app.key)} />
        ))}
      </div>

      <div className="mt-3 border-t border-slate-200 pt-2.5">
        <p className="text-[11px] font-bold tracking-widest text-slate-400 uppercase">
          Administration
        </p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {ADMIN_ENTRIES.map((app) => (
            <AppChip key={app.key} app={app} granted={granted.has(app.key)} admin />
          ))}
        </div>
      </div>

      <p className="mt-2.5 text-[11px] text-slate-500">
        Struck-through apps stay hidden — they never appear on this person&apos;s dashboard.
      </p>
    </div>
  );
}
