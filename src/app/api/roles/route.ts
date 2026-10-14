import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { DEFAULT_ROLES, Role } from "@/models/Role";
import { User } from "@/models/User";
import { jsonError, readBody, requireChurchAdmin, withApi } from "@/lib/api-helpers";
import { logActivity } from "@/lib/audit";
import { exactMatch, parseApps, shapeRole } from "@/lib/users-admin";

/** A church's roles, seeding the starter set the first time anyone looks. */
export async function GET() {
  return withApi(async () => {
    const user = await requireChurchAdmin();
    await connectDb();
    const churchId = new Types.ObjectId(user.churchId);

    if ((await Role.countDocuments({ churchId })) === 0) {
      try {
        await Role.insertMany(
          DEFAULT_ROLES.map((r) => ({
            churchId,
            name: r.name,
            description: r.description,
            apps: r.apps,
            system: r.system === true,
            createdBy: new Types.ObjectId(user.id),
          })),
          { ordered: false }
        );
      } catch (err) {
        // Two first loads racing: the unique {churchId, name} index wins
        if ((err as { code?: number }).code !== 11000) throw err;
      }
    }

    const [roles, members] = await Promise.all([
      Role.find({ churchId }).lean(),
      User.find({ churchId, churchRole: { $ne: null } }).select("churchRole").lean(),
    ]);
    const counts = new Map<string, number>();
    for (const m of members) {
      const key = String(m.churchRole);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    roles.sort((a, b) => {
      if (a.system !== b.system) return a.system ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    return NextResponse.json({
      roles: roles.map((r) =>
        shapeRole(r, counts.get(String(r._id)) ?? 0, user.access.roleId)
      ),
    });
  });
}

export async function POST(req: NextRequest) {
  return withApi(async () => {
    const user = await requireChurchAdmin();
    const body = await readBody(req);

    const name = String(body.name ?? "").trim();
    if (!name) return jsonError("Please give the role a name.");
    if (name.length > 60) return jsonError("Role names are limited to 60 characters.");
    const description = String(body.description ?? "").trim();
    const parsed = parseApps(body.apps);
    if ("error" in parsed) return jsonError(parsed.error);

    await connectDb();
    const clash = await Role.findOne({
      churchId: user.churchId,
      name: exactMatch(name),
    })
      .select("_id")
      .lean();
    if (clash) return jsonError("A role with that name already exists.", 409);

    let role;
    try {
      role = await Role.create({
        churchId: user.churchId,
        name,
        description,
        apps: parsed.apps,
        system: false,
        createdBy: new Types.ObjectId(user.id),
      });
    } catch (err) {
      // Two admins naming a role the same thing at once — the unique index wins
      if ((err as { code?: number }).code === 11000)
        return jsonError("A role with that name already exists.", 409);
      throw err;
    }

    await logActivity(user, "create", "role", role.name, role._id);

    return NextResponse.json(
      { role: shapeRole(role.toObject(), 0, user.access.roleId) },
      { status: 201 }
    );
  });
}
