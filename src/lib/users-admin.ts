/**
 * Server-side helpers shared by the Users & roles API routes
 * (/api/users, /api/roles). Keep validation identical to signup so an
 * account created here behaves like one that registered itself.
 */
import { Types } from "mongoose";
import type { UserDoc } from "@/models/User";
import { APP_KEYS, isAppKey, type AppKey } from "@/lib/apps";

export const USERNAME_RE = /^[a-z0-9._]{3,30}$/;
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const MIN_PASSWORD_LENGTH = 8;

export const USERNAME_MESSAGE =
  "Username must be 3–30 characters — lowercase letters, numbers, dots or underscores.";
export const EMAIL_MESSAGE = "Please enter a valid email address.";
export const USERNAME_TAKEN = "That username is already taken.";
export const EMAIL_TAKEN = "An account with that email already exists.";

export type UserStatus = "approved" | "disabled" | "pending" | "rejected";

/** What the Users tab renders for one account. Never includes secrets. */
export type UserSummary = {
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
  /** A company admin who happens to belong to this church — read-only here. */
  isSuperadmin: boolean;
};

type LeanUser = Pick<
  UserDoc,
  | "name"
  | "username"
  | "email"
  | "status"
  | "isOwner"
  | "churchRole"
  | "lastLoginAt"
  | "mustChangePassword"
> & { _id: Types.ObjectId; createdAt?: Date | null; role?: string | null };

export function shapeUser(
  u: LeanUser,
  roleNames: Map<string, string>,
  actorId: string
): UserSummary {
  const roleId = u.churchRole ? String(u.churchRole) : "";
  const roleName = roleId ? roleNames.get(roleId) : undefined;
  return {
    _id: String(u._id),
    name: u.name,
    username: u.username,
    email: u.email,
    // Legacy accounts without a status behave as approved everywhere else
    status: (u.status ?? "approved") as UserStatus,
    isOwner: u.isOwner === true,
    role: roleId && roleName !== undefined ? { _id: roleId, name: roleName } : null,
    lastLoginAt: u.lastLoginAt ? new Date(u.lastLoginAt).toISOString() : null,
    createdAt: u.createdAt ? new Date(u.createdAt).toISOString() : null,
    isYou: String(u._id) === actorId,
    mustChangePassword: u.mustChangePassword === true,
    isSuperadmin: u.role === "superadmin",
  };
}

/** Escape user input for use inside a RegExp (case-insensitive matches). */
export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Anchored, case-insensitive exact match — for "unique per church" names. */
export function exactMatch(value: string): RegExp {
  return new RegExp(`^${escapeRegex(value)}$`, "i");
}

/** Validate the `apps` array from a request body → unique app keys, or an error message. */
export function parseApps(raw: unknown): { apps: AppKey[] } | { error: string } {
  if (raw === undefined || raw === null) return { apps: [] };
  if (!Array.isArray(raw)) return { error: "Apps must be a list of app keys." };
  const apps: AppKey[] = [];
  for (const key of raw) {
    if (!isAppKey(key)) return { error: `Unknown app "${String(key)}".` };
    if (!apps.includes(key)) apps.push(key);
  }
  return { apps };
}

/** What the Roles tab renders for one role. */
export type RoleSummary = {
  _id: string;
  name: string;
  description: string;
  apps: AppKey[];
  system: boolean;
  userCount: number;
  createdAt: string | null;
  /** The role the person looking at this list holds right now. */
  isYours: boolean;
};

export function shapeRole(
  r: {
    _id: unknown;
    name: string;
    description?: string | null;
    apps?: string[] | null;
    system?: boolean | null;
    createdAt?: Date | null;
  },
  userCount = 0,
  actorRoleId: string | null = null
): RoleSummary {
  return {
    _id: String(r._id),
    name: r.name,
    description: r.description ?? "",
    // The built-in role always has every app — read it from the live registry
    // so a newly added app shows up without a database write.
    apps: r.system === true ? [...APP_KEYS] : (r.apps ?? []).filter(isAppKey),
    system: r.system === true,
    userCount,
    createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : null,
    isYours: actorRoleId !== null && String(r._id) === actorRoleId,
  };
}
