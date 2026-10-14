import { NextRequest, NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { Team } from "@/models/Team";
import { Person } from "@/models/Person";
import { ServicePlan } from "@/models/ServicePlan";
import { jsonError, readBody, requireChurch, withApi } from "@/lib/api-helpers";
import { isValidObjectId } from "@/lib/person-fields";
import { logActivity, moveToRecycleBin } from "@/lib/audit";
import { loadPeople, parseRoles } from "@/lib/service-plans";

type Params = { params: Promise<{ id: string }> };

async function shape(churchId: string, t: NonNullable<Awaited<ReturnType<typeof Team.findOne>>>) {
  const members = t.members ?? [];
  const people = await loadPeople(
    churchId,
    members.map((m) => m.person)
  );
  return {
    _id: String(t._id),
    name: t.name,
    description: t.description ?? "",
    roles: t.roles ?? [],
    leader: t.leader ? String(t.leader) : null,
    leaderName: t.leaderName ?? "",
    members: members.map((m) => {
      const snap = people.get(String(m.person));
      return {
        person: String(m.person),
        personName: m.personName || snap?.name || "",
        roles: m.roles ?? [],
        photoUrl: snap?.photoUrl ?? "",
        phone: snap?.phone ?? "",
        memberNo: snap?.memberNo ?? "",
      };
    }),
    memberCount: members.length,
    active: t.active !== false,
    createdAt: t.createdAt?.toISOString(),
  };
}

export async function GET(_req: NextRequest, { params }: Params) {
  return withApi(async () => {
    const user = await requireChurch("services");
    const { id } = await params;
    if (!isValidObjectId(id)) return jsonError("Team not found.", 404);
    await connectDb();
    const team = await Team.findOne({ _id: id, churchId: user.churchId });
    if (!team) return jsonError("Team not found.", 404);
    return NextResponse.json({ team: await shape(user.churchId, team) });
  });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  return withApi(async () => {
    const user = await requireChurch("services");
    const { id } = await params;
    if (!isValidObjectId(id)) return jsonError("Team not found.", 404);
    const body = await readBody(req);

    await connectDb();
    const team = await Team.findOne({ _id: id, churchId: user.churchId });
    if (!team) return jsonError("Team not found.", 404);

    // Scalar fields
    if (body.name !== undefined) {
      const name = String(body.name ?? "").trim();
      if (!name) return jsonError("Name cannot be empty.");
      const clash = await Team.findOne({
        churchId: user.churchId,
        name,
        _id: { $ne: team._id },
      })
        .select("_id")
        .lean();
      if (clash) return jsonError("A team with that name already exists.");
      team.name = name;
    }
    if (body.description !== undefined) team.description = String(body.description ?? "").trim();
    if (body.roles !== undefined) team.roles = parseRoles(body.roles);
    if (body.active !== undefined) team.active = Boolean(body.active);
    if (body.leader !== undefined) {
      const leaderId = String(body.leader ?? "").trim();
      if (!leaderId) {
        team.leader = null;
        team.leaderName = "";
      } else {
        if (!isValidObjectId(leaderId)) return jsonError("Leader not found.");
        const leader = await Person.findOne({ _id: leaderId, churchId: user.churchId })
          .select("name")
          .lean();
        if (!leader) return jsonError("Leader not found.");
        team.leader = leader._id;
        team.leaderName = leader.name;
      }
    }

    // Membership operations
    if (body.addMember !== undefined) {
      const personId = String(body.addMember?.personId ?? "").trim();
      if (!isValidObjectId(personId)) return jsonError("Person not found.");
      const person = await Person.findOne({ _id: personId, churchId: user.churchId })
        .select("name")
        .lean();
      if (!person) return jsonError("Person not found.");
      const roles = parseRoles(body.addMember?.roles);
      const existing = team.members.find((m) => String(m.person) === personId);
      if (existing) {
        existing.personName = person.name;
        existing.roles = Array.from(new Set([...(existing.roles ?? []), ...roles]));
      } else {
        team.members.push({ person: person._id, personName: person.name, roles });
      }
    }
    if (body.removeMember !== undefined) {
      const personId = String(body.removeMember ?? "").trim();
      const idx = team.members.findIndex((m) => String(m.person) === personId);
      if (idx < 0) return jsonError("That person is not on this team.");
      team.members.splice(idx, 1);
    }
    if (body.setRoles !== undefined) {
      const personId = String(body.setRoles?.personId ?? "").trim();
      const member = team.members.find((m) => String(m.person) === personId);
      if (!member) return jsonError("That person is not on this team.");
      member.roles = parseRoles(body.setRoles?.roles);
    }

    await team.save();
    await logActivity(user, "update", "team", team.name, team._id);
    return NextResponse.json({ team: await shape(user.churchId, team) });
  });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  return withApi(async () => {
    const user = await requireChurch("services");
    const { id } = await params;
    if (!isValidObjectId(id)) return jsonError("Team not found.", 404);

    await connectDb();
    const team = await Team.findOne({ _id: id, churchId: user.churchId }).lean();
    if (!team) return jsonError("Team not found.", 404);

    await moveToRecycleBin({ user, itemType: "team", label: team.name, doc: team });
    await Team.deleteOne({ _id: id, churchId: user.churchId });
    // Plans keep the snapshotted teamName on their slots, so nothing else changes.
    const planCount = await ServicePlan.countDocuments({
      churchId: user.churchId,
      "volunteers.team": team._id,
    });
    return NextResponse.json({ ok: true, plansReferencing: planCount });
  });
}
