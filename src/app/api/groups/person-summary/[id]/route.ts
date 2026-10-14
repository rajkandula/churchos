import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { Group } from "@/models/Group";
import { jsonError, requireChurch, withApi } from "@/lib/api-helpers";
import { isValidObjectId } from "@/lib/person-fields";

type Params = { params: Promise<{ id: string }> };

/** GET → { groups: [{ _id, name, type, role }] } — every active group this
 *  person belongs to or leads. Consumed by the People profile tile. */
export async function GET(_req: NextRequest, { params }: Params) {
  return withApi(async () => {
    const user = await requireChurch("groups");
    const { id } = await params;
    if (!isValidObjectId(id)) return jsonError("Person not found.", 404);

    await connectDb();
    const pid = new Types.ObjectId(id);
    const groups = await Group.find({
      churchId: user.churchId,
      active: true,
      $or: [{ "members.person": pid }, { leader: pid }, { "coLeaders.person": pid }],
    })
      .select("name type leader coLeaders.person members.person members.role")
      .sort({ name: 1 })
      .lean();

    return NextResponse.json({
      groups: groups.map((g) => {
        let role = "member";
        if (g.leader && String(g.leader) === id) role = "leader";
        else if ((g.coLeaders ?? []).some((c) => String(c.person) === id))
          role = "co-leader";
        else {
          const m = (g.members ?? []).find((x) => String(x.person) === id);
          if (m?.role) role = m.role;
        }
        return { _id: String(g._id), name: g.name, type: g.type, role };
      }),
    });
  });
}
