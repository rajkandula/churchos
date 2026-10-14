import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { Group } from "@/models/Group";
import { jsonError, readBody, requireChurch, withApi } from "@/lib/api-helpers";
import { logActivity } from "@/lib/audit";
import {
  groupPeopleIds,
  isDuplicateKey,
  loadPeople,
  pickGroupFields,
  resolveLeaders,
  toGroupDto,
} from "@/lib/groups";
import { GROUP_TYPES } from "@/app/dashboard/groups/types";

/** GET /api/groups?q=&type=&active=  → { groups: GroupDto[] } (no meetings) */
export async function GET(req: NextRequest) {
  return withApi(async () => {
    const user = await requireChurch("groups");
    await connectDb();

    const params = req.nextUrl.searchParams;
    const filter: Record<string, unknown> = { churchId: user.churchId };
    const q = (params.get("q") ?? "").trim();
    if (q) {
      const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [{ name: re }, { leaderName: re }, { location: re }, { tags: re }];
    }
    const type = (params.get("type") ?? "").trim();
    if (type && (GROUP_TYPES as readonly string[]).includes(type)) filter.type = type;
    const active = (params.get("active") ?? "").trim();
    if (active === "true") filter.active = true;
    else if (active === "false") filter.active = false;

    const groups = await Group.find(filter)
      .select("-meetings")
      .sort({ name: 1 })
      .limit(500)
      .lean();

    // Leader / co-leader photos for the cards (members stay as snapshots)
    const leaderIds: string[] = [];
    for (const g of groups) {
      if (g.leader) leaderIds.push(String(g.leader));
      for (const c of g.coLeaders ?? []) leaderIds.push(String(c.person));
    }
    const people = await loadPeople(user.churchId, leaderIds);

    return NextResponse.json({
      groups: groups.map((g) => {
        const dto = toGroupDto(g, undefined);
        const leaderLive = g.leader ? people.get(String(g.leader)) : undefined;
        return {
          ...dto,
          leaderName: leaderLive?.name || dto.leaderName,
          leaderPhotoUrl: leaderLive?.photoUrl ?? "",
          coLeaders: dto.coLeaders.map((c) => ({
            ...c,
            personName: people.get(c.person)?.name || c.personName,
            photoUrl: people.get(c.person)?.photoUrl ?? "",
          })),
        };
      }),
    });
  });
}

/** POST /api/groups → { group } (201) */
export async function POST(req: NextRequest) {
  return withApi(async () => {
    const user = await requireChurch("groups");
    const body = await readBody(req);

    const name = String(body.name ?? "").trim();
    if (!name) return jsonError("Please enter the group's name.");
    const { update, error } = pickGroupFields({ ...body, name });
    if (error) return jsonError(error);

    await connectDb();
    const leaders = await resolveLeaders(user.churchId, body);
    if (leaders.error) return jsonError(leaders.error);

    let created;
    try {
      created = await Group.create({
        churchId: user.churchId,
        ...update,
        ...leaders.update,
        createdBy: new Types.ObjectId(user.id),
      });
    } catch (err) {
      if (isDuplicateKey(err))
        return jsonError("A group with that name already exists.");
      throw err;
    }

    await logActivity(user, "create", "group", created.name, created._id);

    const g = created.toObject();
    const people = await loadPeople(user.churchId, groupPeopleIds(g));
    return NextResponse.json({ group: toGroupDto(g, people) }, { status: 201 });
  });
}
