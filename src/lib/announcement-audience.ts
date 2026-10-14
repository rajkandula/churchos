import mongoose, { Types } from "mongoose";
import { Person } from "@/models/Person";
import { PERSON_STATUSES } from "@/lib/constants";
import { isValidObjectId } from "@/lib/person-fields";
import { AUDIENCE_TYPES, type AudienceType } from "@/models/Announcement";

export type AudienceInput = {
  audienceType: AudienceType;
  status: string;
  tag: string;
  group: string; // ObjectId string or ""
};

export type AudiencePerson = { _id: string; name: string; email: string };

export type ResolvedAudience = {
  input: AudienceInput;
  groupName: string;
  people: AudiencePerson[];
};

/** Statuses that never receive a broadcast, even for "Everyone". */
const EXCLUDED_STATUSES = ["deceased", "transferred"];

/** Whitelist + normalise the audience part of a request body.
 *  Returns an error message for bad input. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseAudience(body: any): AudienceInput | { error: string } {
  const audienceType = String(body.audienceType ?? "all") as AudienceType;
  if (!(AUDIENCE_TYPES as readonly string[]).includes(audienceType))
    return { error: "Invalid audience." };
  const status = String(body.status ?? "").trim();
  const tag = String(body.tag ?? "").trim().toLowerCase();
  const group = String(body.group ?? "").trim();

  if (audienceType === "status") {
    if (!(PERSON_STATUSES as readonly string[]).includes(status))
      return { error: "Please choose a status." };
  }
  if (audienceType === "tag" && !tag) return { error: "Please choose a tag." };
  if (audienceType === "group" && !isValidObjectId(group))
    return { error: "Please choose a group." };

  return {
    audienceType,
    status: audienceType === "status" ? status : "",
    tag: audienceType === "tag" ? tag : "",
    group: audienceType === "group" ? group : "",
  };
}

/** Read the Groups collection directly — the Group model is owned by
 *  another app, and only the member ids are needed here. */
async function findGroup(
  churchId: string,
  groupId: string
): Promise<{ name: string; personIds: Types.ObjectId[] } | null> {
  const db = mongoose.connection.db;
  if (!db) return null;
  const doc = await db.collection("groups").findOne(
    { _id: new Types.ObjectId(groupId), churchId: new Types.ObjectId(churchId) },
    { projection: { name: 1, members: 1 } }
  );
  if (!doc) return null;
  const members = Array.isArray(doc.members) ? doc.members : [];
  const personIds: Types.ObjectId[] = [];
  for (const m of members as { person?: unknown }[]) {
    const id = m?.person;
    if (id instanceof Types.ObjectId) personIds.push(id);
    else if (typeof id === "string" && isValidObjectId(id))
      personIds.push(new Types.ObjectId(id));
  }
  return { name: String(doc.name ?? ""), personIds };
}

/** Turn an audience choice into the concrete people it reaches. */
export async function resolveAudience(
  churchId: string,
  input: AudienceInput
): Promise<ResolvedAudience | { error: string }> {
  const filter: Record<string, unknown> = { churchId };
  let groupName = "";

  switch (input.audienceType) {
    case "all":
      filter.status = { $nin: EXCLUDED_STATUSES };
      break;
    case "members":
      filter.status = "member";
      break;
    case "status":
      filter.status = input.status;
      break;
    case "tag":
      filter.tags = input.tag;
      break;
    case "group": {
      const group = await findGroup(churchId, input.group);
      if (!group) return { error: "Group not found." };
      groupName = group.name;
      filter._id = { $in: group.personIds };
      break;
    }
  }

  const people = await Person.find(filter)
    .select("name email")
    .sort({ name: 1 })
    .lean();

  return {
    input,
    groupName,
    people: people.map((p) => ({
      _id: String(p._id),
      name: p.name,
      email: (p.email ?? "").trim().toLowerCase(),
    })),
  };
}
