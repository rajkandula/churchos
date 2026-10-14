import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { ConnectCard } from "@/models/ConnectCard";
import { Person } from "@/models/Person";
import { jsonError, requireChurch, withApi } from "@/lib/api-helpers";
import { isValidObjectId } from "@/lib/person-fields";
import { seqLabel, withSeqRetry } from "@/lib/seq";
import { logActivity } from "@/lib/audit";

type Params = { params: Promise<{ id: string }> };

/**
 * "Add to People" — turn the card into a Person (status visitor), link the
 * two, and mark the card joined. Uses the same member-number allocation as
 * POST /api/people so numbers never collide.
 */
export async function POST(_req: NextRequest, { params }: Params) {
  return withApi(async () => {
    const user = await requireChurch("connect");
    const { id } = await params;
    if (!isValidObjectId(id)) return jsonError("Card not found.", 404);

    await connectDb();
    const card = await ConnectCard.findOne({ _id: id, churchId: user.churchId }).lean();
    if (!card) return jsonError("Card not found.", 404);
    if (card.linkedPerson)
      return jsonError("This card has already been added to People.");

    const tags = Array.from(
      new Set(
        (card.interests ?? [])
          .map((i) => String(i).trim().toLowerCase())
          .filter(Boolean)
      )
    ).slice(0, 30);

    const person = await withSeqRetry(async (attempt) => {
      const seq =
        (await Person.countDocuments({ churchId: user.churchId })) + 1 + attempt;
      return Person.create({
        churchId: user.churchId,
        memberNo: seqLabel("P", seq),
        name: card.name,
        phone: card.phone ?? "",
        email: card.email ?? "",
        address: card.address ?? "",
        city: card.city ?? "",
        status: "visitor",
        source: card.howHeard ?? "",
        firstVisit: card.visitDate ?? new Date(),
        notes: card.prayerRequest ? `Prayer request: ${card.prayerRequest}` : "",
        tags,
        createdBy: new Types.ObjectId(user.id),
      });
    });
    if (!person)
      return jsonError("Could not allocate a member number. Try again.", 500);

    await ConnectCard.updateOne(
      { _id: id, churchId: user.churchId },
      {
        $set: {
          linkedPerson: person._id,
          ...(card.status === "joined" ? {} : { status: "joined" }),
        },
      }
    );

    await logActivity(
      user,
      "create",
      "person",
      `${person.name} (${person.memberNo})`,
      person._id
    );
    await logActivity(
      user,
      "update",
      "connectCard",
      `${card.name} → added to People (${person.memberNo})`,
      id
    );

    return NextResponse.json({ personId: String(person._id) }, { status: 201 });
  });
}
