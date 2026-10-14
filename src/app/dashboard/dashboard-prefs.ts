import { isAppKey, type AppKey } from "@/lib/apps";

/**
 * Pure helpers shared by the server page, the API route and the client
 * launcher. No React, no mongoose — safe to import from anywhere.
 */

export type Density = "comfortable" | "compact";

export type DashboardPrefs = {
  /** App keys in the order this person wants them. */
  order: string[];
  /** App keys this person keeps off their dashboard. */
  hidden: string[];
  density: Density;
};

/** What everyone gets until they arrange anything: registry order, nothing
 *  hidden, the roomy cards the dashboard has always shown. */
export const DEFAULT_PREFS: DashboardPrefs = {
  order: [],
  hidden: [],
  density: "comfortable",
};

/** A launcher app flattened to a plain object the server can serialise. */
export type LauncherApp = {
  key: AppKey;
  name: string;
  description: string;
  href: string;
  accent: string;
};

export function isDensity(value: unknown): value is Density {
  return value === "comfortable" || value === "compact";
}

/**
 * Apply a person's arrangement to the apps they may open.
 *
 * Keys listed in `order` come first, in that order; anything else keeps its
 * registry order and is appended after — so an app added to the registry
 * later shows up on its own instead of vanishing because an old preference
 * document never mentioned it.
 */
export function arrangeApps<T extends { key: string }>(
  available: readonly T[],
  prefs: DashboardPrefs
): { visible: T[]; hiddenApps: T[] } {
  const byKey = new Map<string, T>(available.map((app) => [app.key, app]));
  const placed = new Set<string>();
  const ordered: T[] = [];

  for (const key of prefs.order) {
    const app = byKey.get(key);
    if (!app || placed.has(key)) continue;
    placed.add(key);
    ordered.push(app);
  }
  for (const app of available) {
    if (placed.has(app.key)) continue;
    placed.add(app.key);
    ordered.push(app);
  }

  const hidden = new Set(prefs.hidden);
  return {
    visible: ordered.filter((app) => !hidden.has(app.key)),
    hiddenApps: ordered.filter((app) => hidden.has(app.key)),
  };
}

/**
 * Clean a stored (or posted) preference document into the shape the UI
 * uses: unknown or removed app keys are dropped, an unknown density falls
 * back to the roomy default.
 */
export function normalizePrefs(raw: {
  order?: unknown;
  hidden?: unknown;
  density?: unknown;
} | null | undefined): DashboardPrefs {
  if (!raw) return { ...DEFAULT_PREFS };
  const keys = (value: unknown): string[] =>
    Array.isArray(value) ? value.filter((v): v is AppKey => isAppKey(v)) : [];
  return {
    order: keys(raw.order),
    hidden: keys(raw.hidden),
    density: isDensity(raw.density) ? raw.density : DEFAULT_PREFS.density,
  };
}
