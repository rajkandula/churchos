import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { Group } from "@/models/Group";
import { Person } from "@/models/Person";
import { jsonError, readBody, requireChurch, withApi } from "@/lib/api-helpers";
import { isValidObjectId } from "@/lib/person-fields";
import { logActivity } from "@/lib/audit";
import { isMemberRole, loadGroupDetail } from "@/lib/groups";

type Params = { params: Promise<{ id: string }> };

async function parse(req: NextRequest, params: Params["params"]) {
  const { id } = await params;
  const body = await readBody(req);
  const personId = String(body.personId ?? "").trim();
  const role = String(body.role ?? "member").trim() || "member";
  return { id, personId, role, body };
}

/** POST { personId, role } — add a member (no duplicates, enforces capacity) → { group } */
export async function POST(req: NextRequest, { params }: Params) {
  return withApi(async () => {
    const user = await requireChurch("groups");
    const { id, personId, role } = await parse(req, params);
    if (!isValidObjectId(id)) return jsonError("Group not found.", 404);
    if (!isValidObjectId(personId)) return jsonError("Please choose a person.");
    if (!isMemberRole(role)) return jsonError("Invalid member role.");

    await connectDb();
    const [group, person] = await Promise.all([
      Group.findOne({ _id: id, churchId: user.churchId })
        .select("name members capacity")
        .lean(),
      Person.findOne({ _id: personId, churchId: user.churchId })
        .select("name")
        .lean(),
    ]);
    if (!group) return jsonError("Group not found.", 404);
    if (!person) return jsonError("Person not found in this church.");

    const members = group.members ?? [];
    if (members.some((m) => String(m.person) === personId))
      return jsonError(`${person.name} is already in this group.`);
    if (group.capacity && members.length >= group.capacity)
      return jsonError(
        `This group is full (${group.capacity} of ${group.capacity}). Raise the capacity to add more.`
      );

    // Atomic: the $ne guard means a concurrent add can't duplicate them
    const res = await Group.updateOne(
      {
        _id: id,
        churchId: user.churchId,
        "members.person": { $ne: new Types.ObjectId(personId) },
      },
      {
        $push: {
          members: {
            person: new Types.ObjectId(personId),
            personName: person.name,
            role,
            joinedAt: new Date(),
          },
        },
      }
    );
    if (res.modifiedCount === 0)
      return jsonError(`${person.name} is already in this group.`);

    await logActivity(
      user,
      "update",
      "group",
      `${group.name} — added ${person.name}`,
      id
    );

    return NextResponse.json({ group: await loadGroupDetail(user.churchId, id) });
  });
}

/** PATCH { personId, role } — change a member's role → { group } */
export async function PATCH(req: NextRequest, { params }: Params) {
  return withApi(async () => {
    const user = await requireChurch("groups");
    const { id, personId, role } = await parse(req, params);
    if (!isValidObjectId(id)) return jsonError("Group not found.", 404);
    if (!isValidObjectId(personId)) return jsonError("Member not found.", 404);
    if (!isMemberRole(role)) return jsonError("Invalid member role.");

    await connectDb();
    const updated = await Group.findOneAndUpdate(
      {
        _id: id,
        churchId: user.churchId,
        "members.person": new Types.ObjectId(personId),
      },
      { $set: { "members.$.role": role } },
      { new: true }
    )
      .select("name members")
      .lean();
    if (!updated) return jsonError("Member not found in this group.", 404);

    const member = updated.members.find((m) => String(m.person) === personId);
    await logActivity(
      user,
      "update",
      "group",
      `${updated.name} — ${member?.personName ?? "member"} is now ${role}`,
      id
    );

    return NextResponse.json({ group: await loadGroupDetail(user.churchId, id) });
  });
}

/** DELETE { personId } — remove a member → { group } */
export async function DELETE(req: NextRequest, { params }: Params) {
  return withApi(async () => {
    const user = await requireChurch("groups");
    const { id, personId } = await parse(req, params);
    if (!isValidObjectId(id)) return jsonError("Group not found.", 404);
    if (!isValidObjectId(personId)) return jsonError("Member not found.", 404);

    await connectDb();
    const group = await Group.findOne({ _id: id, churchId: user.churchId })
      .select("name members")
      .lean();
    if (!group) return jsonError("Group not found.", 404);
    const member = (group.members ?? []).find((m) => String(m.person) === personId);
    if (!member) return jsonError("Member not found in this group.", 404);

    await Group.updateOne(
      { _id: id, churchId: user.churchId },
      { $pull: { members: { person: new Types.ObjectId(personId) } } }
    );

    await logActivity(
      user,
      "update",
      "group",
      `${group.name} — removed ${member.personName || "a member"}`,
      id
    );

    return NextResponse.json({ group: await loadGroupDetail(user.churchId, id) });
  });
}
