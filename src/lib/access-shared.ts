import type { AppKey } from "@/lib/apps";

/** What a signed-in church user is allowed to open. Client-safe (no mongoose). */
export type Access = {
  /** Registered the church — full access, can manage users and roles. */
  isOwner: boolean;
  roleId: string | null;
  roleName: string;
  /** App keys this user may open. */
  apps: AppKey[];
  /** True for owners and the system "Church admin" role. */
  all: boolean;
};

export const NO_ACCESS: Access = {
  isOwner: false,
  roleId: null,
  roleName: "",
  apps: [],
  all: false,
};

export function canOpen(access: Access, app: AppKey): boolean {
  return access.all || access.apps.includes(app);
}

/** Owners and anyone whose role includes the Users & roles app. */
export function canManageUsers(access: Access): boolean {
  return canOpen(access, "users");
}
