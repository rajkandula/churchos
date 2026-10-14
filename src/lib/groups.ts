import { Types } from "mongoose";
import { Person } from "@/models/Person";
import { Group, type GroupDoc } from "@/models/Group";
import { DAYS_OF_WEEK } from "@/lib/constants";
import { isValidObjectId } from "@/lib/person-fields";
import {
  GROUP_FREQUENCIES,
  GROUP_TYPES,
  MEMBER_ROLES,
  formatTime12,
  type GroupDto,
  type GroupMeetingDto,
  type GroupMemberDto,
} from "@/app/dashboard/groups/types";

type LeanGroup = GroupDoc & { _id: Types.ObjectId };

export type PersonSnapshot = {
  name: string;
  photoUrl: string;
  phone: string;
  status: string;
  memberNo: string;
};

/** Whitelist + normalise the scalar fields of a Group from a request body. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function pickGroupFields(body: any): {
  update: Record<string, unknown>;
  error?: string;
} {
  const update: Record<string, unknown> = {};

  if (body.name !== undefined) {
    const name = String(body.name ?? "").trim();
    if (!name) return { update, error: "Please enter the group's name." };
    update.name = name.slice(0, 120);
  }
  if (body.type !== undefined) {
    const type = String(body.type ?? "");
    if (!(GROUP_TYPES as readonly string[]).includes(type))
      return { update, error: "Invalid group type." };
    update.type = type;
  }
  for (const key of ["description", "location"] as const) {
    if (body[key] !== undefined) update[key] = String(body[key] ?? "").trim();
  }
  if (body.meetingDay !== undefined) {
    const day = String(body.meetingDay ?? "").trim();
    if (day && !(DAYS_OF_WEEK as readonly string[]).includes(day))
      return { update, error: "Invalid meeting day." };
    update.meetingDay = day;
  }
  if (body.meetingTime !== undefined) {
    const time = String(body.meetingTime ?? "").trim();
    if (time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time))
      return { update, error: "Meeting time must be HH:MM." };
    update.meetingTime = time;
  }
  if (body.frequency !== undefined) {
    const frequency = String(body.frequency ?? "");
    if (!(GROUP_FREQUENCIES as readonly string[]).includes(frequency))
      return { update, error: "Invalid meeting frequency." };
    update.frequency = frequency;
  }
  if (body.capacity !== undefined) {
    const raw = body.capacity;
    if (raw === null || raw === "") {
      update.capacity = null;
    } else {
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n))
        return { update, error: "Capacity must be a whole number." };
      update.capacity = n === 0 ? null : n;
    }
  }
  if (body.open !== undefined) update.open = Boolean(body.open);
  if (body.active !== undefined) update.active = Boolean(body.active);
  if (body.tags !== undefined) {
    const raw: unknown[] = Array.isArray(body.tags)
      ? body.tags
      : String(body.tags ?? "").split(",");
    update.tags = Array.from(
      new Set(raw.map((t) => String(t).trim().toLowerCase()).filter(Boolean))
    ).slice(0, 30);
  }
  return { update };
}

/** Fetch the live People behind a set of ids (this church only). */
export async function loadPeople(
  churchId: string,
  ids: Iterable<unknown>
): Promise<Map<string, PersonSnapshot>> {
  const list = Array.from(new Set(Array.from(ids).map(String).filter(Boolean)));
  if (!list.length) return new Map();
  const people = await Person.find({ _id: { $in: list }, churchId })
    .select("name photoUrl phone status memberNo")
    .lean();
  return new Map(
    people.map((p) => [
      String(p._id),
      {
        name: p.name,
        photoUrl: p.photoUrl ?? "",
        phone: p.phone ?? "",
        status: p.status ?? "",
        memberNo: p.memberNo,
      },
    ])
  );
}

/** Resolve leader / coLeaders from a request body, validating that every
 *  person belongs to this church and snapshotting their names. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function resolveLeaders(churchId: string, body: any): Promise<{
  update: Record<string, unknown>;
  error?: string;
}> {
  const update: Record<string, unknown> = {};
  const wantIds: string[] = [];

  let leaderId: string | null | undefined;
  if (body.leader !== undefined) {
    const v =
      body.leader && typeof body.leader === "object"
        ? String(body.leader._id ?? "")
        : String(body.leader ?? "").trim();
    if (!v) leaderId = null;
    else if (!isValidObjectId(v)) return { update, error: "Leader not found." };
    else {
      leaderId = v;
      wantIds.push(v);
    }
  }

  let coIds: string[] | undefined;
  if (body.coLeaders !== undefined) {
    if (!Array.isArray(body.coLeaders))
      return { update, error: "Co-leaders must be a list." };
    coIds = Array.from(
      new Set(
        body.coLeaders
          .map((c: unknown) =>
            c && typeof c === "object"
              ? String((c as { person?: unknown; _id?: unknown }).person ?? (c as { _id?: unknown })._id ?? "")
              : String(c ?? "")
          )
          .map((s: string) => s.trim())
          .filter(Boolean)
      )
    ) as string[];
    if (coIds.some((id) => !isValidObjectId(id)))
      return { update, error: "Co-leader not found." };
    wantIds.push(...coIds);
  }

  const people = await loadPeople(churchId, wantIds);

  if (leaderId !== undefined) {
    if (leaderId === null) {
      update.leader = null;
      update.leaderName = "";
    } else {
      const p = people.get(leaderId);
      if (!p) return { update, error: "Leader not found in this church." };
      update.leader = new Types.ObjectId(leaderId);
      update.leaderName = p.name;
    }
  }
  if (coIds !== undefined) {
    const ids = leaderId ? coIds.filter((id) => id !== leaderId) : coIds;
    const coLeaders = [];
    for (const id of ids) {
      const p = people.get(id);
      if (!p) return { update, error: "Co-leader not found in this church." };
      coLeaders.push({ person: new Types.ObjectId(id), personName: p.name });
    }
    update.coLeaders = coLeaders;
  }
  return { update };
}

export function isMemberRole(role: string): boolean {
  return (MEMBER_ROLES as readonly string[]).includes(role);
}

/** Next occurrence of the meeting slot as a short label, or "" for ad-hoc. */
export function nextMeetingLabel(g: {
  meetingDay?: string | null;
  meetingTime?: string | null;
  frequency?: string | null;
  active?: boolean | null;
}): string {
  if (!g.active || !g.meetingDay || g.frequency === "ad-hoc") return "";
  const dayIndex = (DAYS_OF_WEEK as readonly string[]).indexOf(g.meetingDay);
  if (dayIndex < 0) return "";
  const now = new Date();
  let diff = (dayIndex - now.getDay() + 7) % 7;
  if (diff === 0 && g.meetingTime) {
    const [h, m] = g.meetingTime.split(":").map(Number);
    const slot = new Date(now);
    slot.setHours(h, m, 0, 0);
    if (slot.getTime() < now.getTime()) diff = 7;
  }
  const next = new Date(now);
  next.setDate(now.getDate() + diff);
  const date = next.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const time = formatTime12(g.meetingTime);
  return time ? `${date} · ${time}` : date;
}

function toMeetingDto(m: LeanGroup["meetings"][number]): GroupMeetingDto {
  const present = (m.present ?? []).map(String);
  return {
    _id: String(m._id),
    date: m.date instanceof Date ? m.date.toISOString() : String(m.date),
    present,
    note: m.note ?? "",
    presentCount: present.length,
  };
}

/** Plain, id-stringified shape for the client. `people` (if given) adds the
 *  live photo/phone/status to members and leaders. */
export function toGroupDto(
  g: LeanGroup,
  people?: Map<string, PersonSnapshot>,
  opts: { includeMeetings?: boolean } = {}
): GroupDto {
  const leaderId = g.leader ? String(g.leader) : null;
  const leaderLive = leaderId ? people?.get(leaderId) : undefined;
  const members: GroupMemberDto[] = (g.members ?? []).map((m) => {
    const id = String(m.person);
    const live = people?.get(id);
    return {
      person: id,
      personName: live?.name || m.personName || "",
      role: m.role || "member",
      joinedAt: m.joinedAt ? new Date(m.joinedAt).toISOString() : null,
      ...(people
        ? {
            photoUrl: live?.photoUrl ?? "",
            phone: live?.phone ?? "",
            status: live?.status ?? "",
            exists: Boolean(live),
          }
        : {}),
    };
  });
  const meetings = opts.includeMeetings
    ? (g.meetings ?? [])
        .map(toMeetingDto)
        .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    : undefined;
  return {
    _id: String(g._id),
    name: g.name,
    type: g.type as GroupDto["type"],
    description: g.description ?? "",
    leader: leaderId,
    leaderName: leaderLive?.name || g.leaderName || "",
    leaderPhotoUrl: leaderLive?.photoUrl ?? "",
    coLeaders: (g.coLeaders ?? []).map((c) => {
      const id = String(c.person);
      const live = people?.get(id);
      return {
        person: id,
        personName: live?.name || c.personName || "",
        photoUrl: live?.photoUrl ?? "",
      };
    }),
    meetingDay: g.meetingDay ?? "",
    meetingTime: g.meetingTime ?? "",
    frequency: g.frequency as GroupDto["frequency"],
    location: g.location ?? "",
    members,
    capacity: g.capacity ?? null,
    open: g.open ?? true,
    tags: g.tags ?? [],
    active: g.active ?? true,
    ...(meetings ? { meetings } : {}),
    memberCount: members.length,
    nextMeeting: nextMeetingLabel(g),
    createdAt: g.createdAt ? new Date(g.createdAt).toISOString() : undefined,
    updatedAt: g.updatedAt ? new Date(g.updatedAt).toISOString() : undefined,
  };
}

/** Every person id referenced by a group (leader, co-leaders, members). */
export function groupPeopleIds(g: LeanGroup): string[] {
  const ids: string[] = [];
  if (g.leader) ids.push(String(g.leader));
  for (const c of g.coLeaders ?? []) ids.push(String(c.person));
  for (const m of g.members ?? []) ids.push(String(m.person));
  return ids;
}

/** One group with members enriched from the live People register. */
export async function loadGroupDetail(
  churchId: string,
  id: string
): Promise<GroupDto | null> {
  const g = (await Group.findOne({ _id: id, churchId }).lean()) as LeanGroup | null;
  if (!g) return null;
  const people = await loadPeople(churchId, groupPeopleIds(g));
  return toGroupDto(g, people, { includeMeetings: true });
}

export function isDuplicateKey(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { code?: number }).code === 11000
  );
}
