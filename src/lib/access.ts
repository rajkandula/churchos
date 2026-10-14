import { Types } from "mongoose";
import { Role } from "@/models/Role";
import { APP_KEYS, isAppKey } from "@/lib/apps";
import { NO_ACCESS, type Access } from "@/lib/access-shared";

// Server-only: resolves a user's access from the database. Client components
// import the pure helpers from "@/lib/access-shared" instead.
export { NO_ACCESS, canOpen, canManageUsers, type Access } from "@/lib/access-shared";

/** Resolve a user's app access from their owner flag and assigned role. */
export async function resolveAccess(user: {
  isOwner?: boolean | null;
  churchRole?: unknown;
  churchId?: unknown;
}): Promise<Access> {
  if (user.isOwner) {
    return { isOwner: true, roleId: null, roleName: "Owner", apps: [...APP_KEYS], all: true };
  }
  if (!user.churchRole || !user.churchId) return NO_ACCESS;
  if (!Types.ObjectId.isValid(String(user.churchRole))) return NO_ACCESS;
  const role = await Role.findOne({
    _id: new Types.ObjectId(String(user.churchRole)),
    churchId: new Types.ObjectId(String(user.churchId)),
  })
    .select("name apps system")
    .lean();
  if (!role) return NO_ACCESS;
  if (role.system) {
    return { isOwner: false, roleId: String(role._id), roleName: role.name, apps: [...APP_KEYS], all: true };
  }
  return {
    isOwner: false,
    roleId: String(role._id),
    roleName: role.name,
    apps: (role.apps ?? []).filter(isAppKey),
    all: false,
  };
}
