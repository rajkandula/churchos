import type { AppKey } from "@/lib/apps";

export type UserStatus = "approved" | "disabled" | "pending" | "rejected";

/** GET /api/users → users[] */
export type UserDto = {
  _id: string;
  name: string;
  username: string;
  email: string;
  status: UserStatus;
  isOwner: boolean;
  role: { _id: string; name: string } | null;
  lastLoginAt: string | null;
  createdAt: string | null;
  isYou: boolean;
  mustChangePassword: boolean;
  /** A company admin who belongs to this church — managed from the Company console. */
  isSuperadmin: boolean;
};

/** GET /api/roles → roles[] */
export type RoleDto = {
  _id: string;
  name: string;
  description: string;
  apps: AppKey[];
  system: boolean;
  userCount: number;
  createdAt: string | null;
  /** The role the signed-in admin holds right now. */
  isYours: boolean;
};

export const STATUS_LABELS: Record<UserStatus, string> = {
  approved: "Active",
  disabled: "Disabled",
  pending: "Pending",
  rejected: "Rejected",
};

export const STATUS_PILLS: Record<UserStatus, string> = {
  approved: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  disabled: "bg-slate-100 text-slate-600 ring-slate-500/20",
  pending: "bg-amber-50 text-amber-700 ring-amber-600/20",
  rejected: "bg-rose-50 text-rose-700 ring-rose-600/20",
};

export const MIN_PASSWORD_LENGTH = 8;

/** "Samuel Thomas-Raj" → "samuel.thomas.raj" — a starting point for the username field. */
export function suggestUsername(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .split(/[\s\-]+/)
    .filter(Boolean)
    .join(".")
    .replace(/[^a-z0-9._]/g, "")
    .replace(/\.{2,}/g, ".")
    .replace(/^[._]+|[._]+$/g, "")
    .slice(0, 30);
}

/** Where a new user signs in — the current site, so staging and live differ correctly. */
export function signInUrl(): string {
  return typeof window === "undefined" ? "/login" : `${window.location.origin}/login`;
}

/** Copy to the clipboard; false when the browser refuses (insecure context, no permission). */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** The text the admin hands over — everything needed for a first sign-in. */
export function shareText({ username, password }: { username: string; password: string }): string {
  return [
    "Your ChurchOS sign-in",
    `Link: ${signInUrl()}`,
    `Username: ${username}`,
    `Temporary password: ${password}`,
    "You'll be asked to set your own password after signing in.",
  ].join("\n");
}
