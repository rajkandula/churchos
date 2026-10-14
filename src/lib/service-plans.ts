import { Types } from "mongoose";
import { Person } from "@/models/Person";
import { Team } from "@/models/Team";
import { isValidObjectId } from "@/lib/person-fields";
import {
  ITEM_TYPES,
  VOLUNTEER_STATUSES,
  type PlanDto,
  type PlanItemDto,
  type PlanSummaryDto,
  type PlanVolunteerDto,
} from "@/app/dashboard/services/types";

export type PersonSnap = {
  name: string;
  memberNo: string;
  photoUrl: string;
  phone: string;
};

/** Look up display details for a set of people, church-scoped. */
export async function loadPeople(
  churchId: string,
  ids: Iterable<unknown>
): Promise<Map<string, PersonSnap>> {
  const wanted = Array.from(
    new Set(
      Array.from(ids)
        .map((id) => (id ? String(id) : ""))
        .filter((id) => id && isValidObjectId(id))
    )
  );
  if (!wanted.length) return new Map();
  const people = await Person.find({ _id: { $in: wanted }, churchId })
    .select("name memberNo photoUrl phone")
    .lean();
  return new Map(
    people.map((p) => [
      String(p._id),
      {
        name: p.name,
        memberNo: p.memberNo,
        photoUrl: p.photoUrl ?? "",
        phone: p.phone ?? "",
      },
    ])
  );
}

export async function loadTeams(
  churchId: string,
  ids: Iterable<unknown>
): Promise<Map<string, { name: string }>> {
  const wanted = Array.from(
    new Set(
      Array.from(ids)
        .map((id) => (id ? String(id) : ""))
        .filter((id) => id && isValidObjectId(id))
    )
  );
  if (!wanted.length) return new Map();
  const teams = await Team.find({ _id: { $in: wanted }, churchId })
    .select("name")
    .lean();
  return new Map(teams.map((t) => [String(t._id), { name: t.name }]));
}

type RawItem = {
  _id?: unknown;
  order?: unknown;
  type?: unknown;
  title?: unknown;
  detail?: unknown;
  owner?: unknown;
  durationMin?: unknown;
};

/** Validate + snapshot a full `items` array from a request body.
 *  Returns an error string for the first bad row. */
export async function buildItems(
  churchId: string,
  raw: unknown
): Promise<{ items?: Record<string, unknown>[]; error?: string }> {
  if (!Array.isArray(raw)) return { error: "Items must be a list." };
  if (raw.length > 100) return { error: "A plan can have at most 100 items." };
  const rows = raw as RawItem[];
  const people = await loadPeople(
    churchId,
    rows.map((r) => r.owner)
  );
  const items: Record<string, unknown>[] = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i] ?? {};
    const title = String(r.title ?? "").trim();
    if (!title) return { error: `Item ${i + 1} needs a title.` };
    const type = String(r.type ?? "other");
    if (!(ITEM_TYPES as readonly string[]).includes(type))
      return { error: `Item ${i + 1} has an unknown type.` };
    const ownerId = r.owner ? String(r.owner) : "";
    const owner = ownerId && people.has(ownerId) ? ownerId : null;
    const durationMin = Math.max(0, Math.min(600, Math.round(Number(r.durationMin) || 0)));
    const id = r._id ? String(r._id) : "";
    items.push({
      _id: id && isValidObjectId(id) ? new Types.ObjectId(id) : new Types.ObjectId(),
      order: i,
      type,
      title: title.slice(0, 200),
      detail: String(r.detail ?? "").trim().slice(0, 1000),
      owner,
      ownerName: owner ? people.get(owner)!.name : "",
      durationMin,
    });
  }
  return { items };
}

type RawVolunteer = {
  _id?: unknown;
  team?: unknown;
  role?: unknown;
  person?: unknown;
  status?: unknown;
};

/** Validate + snapshot a full `volunteers` array from a request body. */
export async function buildVolunteers(
  churchId: string,
  raw: unknown
): Promise<{ volunteers?: Record<string, unknown>[]; error?: string }> {
  if (!Array.isArray(raw)) return { error: "Volunteers must be a list." };
  if (raw.length > 200) return { error: "A plan can have at most 200 volunteer slots." };
  const rows = raw as RawVolunteer[];
  const [people, teams] = await Promise.all([
    loadPeople(churchId, rows.map((r) => r.person)),
    loadTeams(churchId, rows.map((r) => r.team)),
  ]);
  const volunteers: Record<string, unknown>[] = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i] ?? {};
    const teamId = r.team ? String(r.team) : "";
    const team = teams.get(teamId);
    if (!team) return { error: `Volunteer slot ${i + 1} refers to an unknown team.` };
    const personId = r.person ? String(r.person) : "";
    if (personId && !people.has(personId))
      return { error: `Volunteer slot ${i + 1} refers to an unknown person.` };
    const status = String(r.status ?? "scheduled");
    if (!(VOLUNTEER_STATUSES as readonly string[]).includes(status))
      return { error: `Volunteer slot ${i + 1} has an unknown status.` };
    const id = r._id ? String(r._id) : "";
    volunteers.push({
      _id: id && isValidObjectId(id) ? new Types.ObjectId(id) : new Types.ObjectId(),
      team: teamId,
      teamName: team.name,
      role: String(r.role ?? "").trim().slice(0, 80),
      person: personId || null,
      personName: personId ? people.get(personId)!.name : "",
      status: personId ? status : "scheduled",
    });
  }
  return { volunteers };
}

type LeanPlan = {
  _id: unknown;
  date: Date;
  title?: string;
  theme?: string;
  scripture?: string;
  preacher?: unknown;
  preacherName?: string;
  notes?: string;
  status?: string;
  items?: {
    _id?: unknown;
    order?: number;
    type?: string;
    title: string;
    detail?: string;
    owner?: unknown;
    ownerName?: string;
    durationMin?: number;
  }[];
  volunteers?: {
    _id?: unknown;
    team: unknown;
    teamName?: string;
    role?: string;
    person?: unknown;
    personName?: string;
    status?: string;
  }[];
  createdAt?: Date;
  updatedAt?: Date;
};

export function summarizePlan(p: LeanPlan): PlanSummaryDto {
  const items = p.items ?? [];
  return {
    _id: String(p._id),
    date: p.date.toISOString(),
    title: p.title ?? "",
    theme: p.theme ?? "",
    preacherName: p.preacherName ?? "",
    status: (p.status === "final" ? "final" : "draft") as PlanSummaryDto["status"],
    itemCount: items.length,
    volunteerCount: (p.volunteers ?? []).filter((v) => v.person).length,
    totalDurationMin: items.reduce((s, i) => s + (Number(i.durationMin) || 0), 0),
  };
}

/** Full plan for the editor — items in order, people enriched for pickers. */
export async function serializePlan(churchId: string, p: LeanPlan): Promise<PlanDto> {
  const items = [...(p.items ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const volunteers = p.volunteers ?? [];
  const people = await loadPeople(churchId, [
    p.preacher,
    ...items.map((i) => i.owner),
    ...volunteers.map((v) => v.person),
  ]);
  const preacher = p.preacher ? String(p.preacher) : null;
  return {
    _id: String(p._id),
    date: p.date.toISOString(),
    title: p.title ?? "",
    theme: p.theme ?? "",
    scripture: p.scripture ?? "",
    preacher,
    preacherName: p.preacherName ?? (preacher ? (people.get(preacher)?.name ?? "") : ""),
    preacherMemberNo: preacher ? (people.get(preacher)?.memberNo ?? "") : "",
    preacherPhotoUrl: preacher ? (people.get(preacher)?.photoUrl ?? "") : "",
    notes: p.notes ?? "",
    status: (p.status === "final" ? "final" : "draft") as PlanDto["status"],
    items: items.map((i, idx): PlanItemDto => {
      const owner = i.owner ? String(i.owner) : null;
      return {
        _id: i._id ? String(i._id) : undefined,
        order: idx,
        type: (i.type ?? "other") as PlanItemDto["type"],
        title: i.title,
        detail: i.detail ?? "",
        owner,
        ownerName: i.ownerName ?? "",
        ownerMemberNo: owner ? (people.get(owner)?.memberNo ?? "") : "",
        ownerPhotoUrl: owner ? (people.get(owner)?.photoUrl ?? "") : "",
        durationMin: Number(i.durationMin) || 0,
      };
    }),
    volunteers: volunteers.map((v): PlanVolunteerDto => {
      const person = v.person ? String(v.person) : null;
      const snap = person ? people.get(person) : undefined;
      return {
        _id: v._id ? String(v._id) : undefined,
        team: String(v.team),
        teamName: v.teamName ?? "",
        role: v.role ?? "",
        person,
        personName: v.personName ?? "",
        memberNo: snap?.memberNo ?? "",
        photoUrl: snap?.photoUrl ?? "",
        phone: snap?.phone ?? "",
        status: (v.status ?? "scheduled") as PlanVolunteerDto["status"],
      };
    }),
    createdAt: p.createdAt?.toISOString(),
    updatedAt: p.updatedAt?.toISOString(),
  };
}

/** Date-only input ("2026-09-06") → UTC midnight, or null if unparseable. */
export function parsePlanDate(value: unknown): Date | null {
  const s = String(value ?? "").trim();
  if (!s) return null;
  const d = /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T00:00:00.000Z`) : new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function planLabel(p: { title?: string; date: Date }): string {
  const day = p.date.toISOString().slice(0, 10);
  return `${p.title || "Service"} — ${day}`;
}

/** "Vocals, Keys, Drums" or ["Vocals", …] → de-duplicated trimmed list. */
export function parseRoles(raw: unknown): string[] {
  const list: unknown[] = Array.isArray(raw) ? raw : String(raw ?? "").split(",");
  return Array.from(
    new Set(list.map((r) => String(r).trim().slice(0, 60)).filter(Boolean))
  ).slice(0, 40);
}
