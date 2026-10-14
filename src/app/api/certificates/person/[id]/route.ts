import { NextRequest, NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { Person } from "@/models/Person";
import { jsonError, requireChurch, withApi } from "@/lib/api-helpers";
import { isValidObjectId } from "@/lib/person-fields";

type Params = { params: Promise<{ id: string }> };

/**
 * The milestone fields the issue form prefills from the register. The People
 * read is keyed to the People app, so a Certificates-only role gets nothing
 * back from it — this route hands over exactly the fields the form uses and
 * nothing more (no notes, documents, tags or household detail).
 */
export async function GET(_req: NextRequest, { params }: Params) {
  return withApi(async () => {
    const user = await requireChurch("certificates");
    const { id } = await params;
    if (!isValidObjectId(id)) return jsonError("Person not found.", 404);

    await connectDb();
    const person = await Person.findOne({ _id: id, churchId: user.churchId })
      .select(
        "memberNo name phone email photoUrl status baptismDate baptismPlace dedicationDate marriageDate memberSince confirmationDate"
      )
      .lean();
    if (!person) return jsonError("Person not found.", 404);

    return NextResponse.json({
      person: {
        _id: String(person._id),
        memberNo: person.memberNo,
        name: person.name,
        phone: person.phone ?? "",
        email: person.email ?? "",
        photoUrl: person.photoUrl ?? "",
        status: person.status,
        baptismDate: person.baptismDate ?? null,
        baptismPlace: person.baptismPlace ?? "",
        dedicationDate: person.dedicationDate ?? null,
        marriageDate: person.marriageDate ?? null,
        memberSince: person.memberSince ?? null,
        confirmationDate: person.confirmationDate ?? null,
      },
    });
  });
}
