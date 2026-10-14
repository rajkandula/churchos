/**
 * The app registry — one entry per app on the launcher. Roles grant access
 * by app key, so this is the single source of truth for what can be granted.
 * Keep it free of React/mongoose imports: both the launcher and the role
 * editor (client) and the API guards (server) read it.
 */
export const APPS = [
  {
    key: "people",
    name: "People",
    description: "The church directory — members, visitors, households, milestones and documents.",
    href: "/dashboard/people",
    accent: "from-indigo-500 to-violet-600",
  },
  {
    key: "connect",
    name: "Connect",
    description: "First-time visitor cards and follow-up — from hello to member, nobody slips through.",
    href: "/dashboard/connect",
    accent: "from-pink-500 to-rose-600",
  },
  {
    key: "giving",
    name: "Giving",
    description: "Tithes and offerings by fund, receipts, pledges and year-end giving statements.",
    href: "/dashboard/giving",
    accent: "from-emerald-500 to-teal-600",
  },
  {
    key: "attendance",
    name: "Attendance",
    description: "Headcounts and per-person attendance for every service, plus kids check-in.",
    href: "/dashboard/attendance",
    accent: "from-amber-500 to-orange-600",
  },
  {
    key: "groups",
    name: "Groups",
    description: "Small groups, ministries and teams — leaders, rosters and meeting details.",
    href: "/dashboard/groups",
    accent: "from-sky-500 to-indigo-600",
  },
  {
    key: "events",
    name: "Events",
    description: "Conferences, camps and outreach — with public registration links.",
    href: "/dashboard/events",
    accent: "from-violet-500 to-purple-600",
  },
  {
    key: "services",
    name: "Services",
    description: "Plan the order of service and schedule volunteers — worship, ushers, media.",
    href: "/dashboard/services",
    accent: "from-cyan-500 to-sky-600",
  },
  {
    key: "announcements",
    name: "Announcements",
    description: "Emails to the whole church, members only, or a single group.",
    href: "/dashboard/announcements",
    accent: "from-fuchsia-500 to-violet-600",
  },
  {
    key: "certificates",
    name: "Certificates",
    description: "Baptism, dedication, marriage and membership certificates — printed from the record.",
    href: "/dashboard/certificates",
    accent: "from-slate-600 to-slate-800",
  },
  {
    key: "staff",
    name: "Staff",
    description: "Pastors, staff and ministry leaders — roles and contact details.",
    href: "/dashboard/staff",
    accent: "from-lime-500 to-green-600",
  },
  {
    key: "drive",
    name: "Drive",
    description: "The church's shared documents — folders, uploads, everything in one place.",
    href: "/dashboard/drive",
    accent: "from-blue-400 to-indigo-600",
  },
  {
    key: "analytics",
    name: "Analytics",
    description: "The whole church at a glance — people, giving, attendance, groups.",
    href: "/dashboard/analytics",
    accent: "from-teal-500 to-emerald-600",
  },
  {
    key: "activity",
    name: "Activity",
    description: "Every change across your apps — who did what, and when.",
    href: "/dashboard/activity",
    accent: "from-sky-500 to-cyan-600",
  },
  {
    key: "recycle",
    name: "Recycle Bin",
    description: "Deleted records land here — restore anything with one click.",
    href: "/dashboard/recycle",
    accent: "from-slate-400 to-slate-600",
  },
  {
    key: "settings",
    name: "Church settings",
    description: "Name, logo, address, currency and the public church code.",
    href: "/dashboard/settings",
    accent: "from-slate-500 to-slate-700",
    admin: true,
  },
  {
    key: "users",
    name: "Users & roles",
    description: "Who can sign in, and which apps each role can open.",
    href: "/dashboard/users",
    accent: "from-rose-500 to-orange-600",
    admin: true,
  },
] as const;

export type AppKey = (typeof APPS)[number]["key"];

export const APP_KEYS = APPS.map((a) => a.key) as AppKey[];

/** Apps shown as launcher tiles (the admin ones live in the profile menu). */
export const LAUNCHER_APPS = APPS.filter((a) => !("admin" in a && a.admin));

export const ADMIN_APP_KEYS: AppKey[] = ["settings", "users"];

export function isAppKey(value: unknown): value is AppKey {
  return typeof value === "string" && (APP_KEYS as string[]).includes(value);
}

export function appName(key: string): string {
  return APPS.find((a) => a.key === key)?.name ?? key;
}
