import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { Team } from "@/models/Team";
import { Person } from "@/models/Person";
import { jsonError, readBody, requireChurch, withApi } from "@/lib/api-helpers";
import { isValidObjectId } from "@/lib/person-fields";
import { logActivity } from "@/lib/audit";
import { parseRoles } from "@/lib/service-plans";

/** All teams with a member count — the Teams tab. */
export async function GET() {
  return withApi(async () => {
    const user = await requireChurch("services");
    await connectDb();
    const teams = await Team.find({ churchId: user.churchId }).sort({ name: 1 }).lean();
    return NextResponse.json({
      teams: teams.map((t) => ({
        _id: String(t._id),
        name: t.name,
        description: t.description ?? "",
        roles: t.roles ?? [],
        leader: t.leader ? String(t.leader) : null,
        leaderName: t.leaderName ?? "",
        members: (t.members ?? []).map((m) => ({
          person: String(m.person),
          personName: m.personName ?? "",
          roles: m.roles ?? [],
        })),
        memberCount: (t.members ?? []).length,
        active: t.active !== false,
        createdAt: t.createdAt?.toISOString(),
      })),
    });
  });
}

export async function POST(req: NextRequest) {
  return withApi(async () => {
    const user = await requireChurch("services");
    const body = await readBody(req);

    const name = String(body.name ?? "").trim();
    if (!name) return jsonError("Please enter the team's name.");
    const description = String(body.description ?? "").trim();
    const roles = parseRoles(body.roles);
    const leaderId = String(body.leader ?? "").trim();
    if (leaderId && !isValidObjectId(leaderId)) return jsonError("Leader not found.");

    await connectDb();
    let leaderName = "";
    if (leaderId) {
      const leader = await Person.findOne({ _id: leaderId, churchId: user.churchId })
        .select("name")
        .lean();
      if (!leader) return jsonError("Leader not found.");
      leaderName = leader.name;
    }

    const exists = await Team.findOne({ churchId: user.churchId, name }).select("_id").lean();
    if (exists) return jsonError("A team with that name already exists.");

    const team = await Team.create({
      churchId: user.churchId,
      name,
      description,
      roles,
      leader: leaderId || null,
      leaderName,
      // The leader is usually on the team too
      members: leaderId ? [{ person: leaderId, personName: leaderName, roles: [] }] : [],
      createdBy: new Types.ObjectId(user.id),
    });

    await logActivity(user, "create", "team", team.name, team._id);
    return NextResponse.json({ team }, { status: 201 });
  });
}
