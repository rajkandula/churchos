import { NextRequest, NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { Person } from "@/models/Person";
import { Household } from "@/models/Household";
import { jsonError, readBody, requireChurch, withApi } from "@/lib/api-helpers";
import { canOpen } from "@/lib/access";
import { isValidObjectId, pickPersonFields } from "@/lib/person-fields";
import { logActivity, moveToRecycleBin } from "@/lib/audit";
import { PERSON_STATUSES } from "@/lib/constants";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  return withApi(async () => {
    const user = await requireChurch();
    const { id } = await params;
    if (!isValidObjectId(id)) return jsonError("Person not found.", 404);

    await connectDb();
    const person = await Person.findOne({ _id: id, churchId: user.churchId }).lean();
    if (!person) return jsonError("Person not found.", 404);

    // The rest of the household, for the profile's family card
    let household: { _id: string; name: string } | null = null;
    let family: { _id: string; name: string; householdRole: string; photoUrl: string }[] = [];
    if (person.household) {
      const h = await Household.findOne({
        _id: person.household,
        churchId: user.churchId,
      }).lean();
      if (h) household = { _id: String(h._id), name: h.name };
      const members = await Person.find({
        churchId: user.churchId,
        household: person.household,
        _id: { $ne: person._id },
      })
        .select("name householdRole photoUrl")
        .lean();
      family = members.map((m) => ({
        _id: String(m._id),
        name: m.name,
        householdRole: m.householdRole ?? "",
        photoUrl: m.photoUrl ?? "",
      }));
    }

    // Unkeyed so pickers can resolve a person; roles without the People app
    // see only the picker fields, never notes, milestones or documents.
    const picker = {
      _id: String(person._id),
      memberNo: person.memberNo,
      name: person.name,
      phone: person.phone ?? "",
      email: person.email ?? "",
      photoUrl: person.photoUrl ?? "",
      status: person.status,
      household: person.household ? String(person.household) : null,
      householdName: household?.name ?? "",
    };
    const full = canOpen(user.access, "people");

    return NextResponse.json({
      person: full ? { ...person, ...picker } : picker,
      family,
    });
  });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  return withApi(async () => {
    const user = await requireChurch("people");
    const { id } = await params;
    if (!isValidObjectId(id)) return jsonError("Person not found.", 404);
    const body = await readBody(req);

    const update = pickPersonFields(body);
    if (body.status !== undefined) {
      if (!(PERSON_STATUSES as readonly string[]).includes(body.status))
        return jsonError("Invalid status.");
      update.status = body.status;
    }
    if (update.name === "") return jsonError("Name cannot be empty.");
    if (
      update.phone !== undefined &&
      update.phone !== "" &&
      !/^[0-9+\-\s()]{6,20}$/.test(String(update.phone))
    )
      return jsonError("Please enter a valid phone number.");
    if (
      update.email !== undefined &&
      update.email !== "" &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(update.email))
    )
      return jsonError("Please enter a valid email address.");

    await connectDb();
    if (update.household) {
      const h = await Household.findOne({
        _id: update.household,
        churchId: user.churchId,
      }).lean();
      if (!h) return jsonError("Household not found.");
    }

    const person = await Person.findOneAndUpdate(
      { _id: id, churchId: user.churchId },
      update,
      { new: true, runValidators: true }
    ).lean();
    if (!person) return jsonError("Person not found.", 404);

    await logActivity(
      user,
      "update",
      "person",
      `${person.name} (${person.memberNo})`,
      id
    );

    return NextResponse.json({ person });
  });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  return withApi(async () => {
    const user = await requireChurch("people");
    const { id } = await params;
    if (!isValidObjectId(id)) return jsonError("Person not found.", 404);

    await connectDb();
    const person = await Person.findOne({ _id: id, churchId: user.churchId }).lean();
    if (!person) return jsonError("Person not found.", 404);
    await moveToRecycleBin({
      user,
      itemType: "person",
      label: `${person.name} (${person.memberNo})`,
      doc: person,
    });
    await Person.deleteOne({ _id: id, churchId: user.churchId });
    await Household.updateMany(
      { churchId: user.churchId, head: person._id },
      { $set: { head: null } }
    );

    return NextResponse.json({ ok: true });
  });
}
