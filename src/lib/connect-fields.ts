import { SOURCE_OPTIONS } from "@/lib/constants";
import {
  AGE_GROUPS,
  INTEREST_OPTIONS,
  type ConnectCardDto,
} from "@/app/dashboard/connect/types";
import type { ConnectCardDoc } from "@/models/ConnectCard";

export const PHONE_RE = /^[0-9+\-\s()]{6,20}$/;
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Normalise a list of interests: known options only, de-duplicated. */
export function pickInterests(raw: unknown): string[] {
  const list: unknown[] = Array.isArray(raw)
    ? raw
    : String(raw ?? "")
        .split(",")
        .filter(Boolean);
  const known = new Set<string>(INTEREST_OPTIONS);
  return Array.from(
    new Set(list.map((i) => String(i).trim()).filter((i) => known.has(i)))
  );
}

/**
 * Whitelist + normalise the editable fields of a connect card from a
 * request body. Returns `{ error }` for the first invalid value so routes
 * can hand it straight to jsonError().
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function pickCardFields(body: any):
  | { error: string; fields?: undefined }
  | { error?: undefined; fields: Record<string, unknown> } {
  const out: Record<string, unknown> = {};

  if (body.name !== undefined) {
    const name = String(body.name ?? "").trim().slice(0, 120);
    if (!name) return { error: "Please enter the visitor's name." };
    out.name = name;
  }
  if (body.phone !== undefined) {
    const phone = String(body.phone ?? "").trim();
    if (phone && !PHONE_RE.test(phone))
      return { error: "Please enter a valid phone number." };
    out.phone = phone;
  }
  if (body.email !== undefined) {
    const email = String(body.email ?? "").trim().toLowerCase().slice(0, 160);
    if (email && !EMAIL_RE.test(email))
      return { error: "Please enter a valid email address." };
    out.email = email;
  }
  if (body.visitDate !== undefined) {
    const v = String(body.visitDate ?? "").trim();
    if (v) {
      const d = new Date(v);
      if (Number.isNaN(d.getTime())) return { error: "Invalid visit date." };
      out.visitDate = d;
    }
  }
  if (body.firstTime !== undefined) out.firstTime = Boolean(body.firstTime);
  if (body.howHeard !== undefined) {
    const v = String(body.howHeard ?? "").trim();
    if (v && !(SOURCE_OPTIONS as readonly string[]).includes(v))
      return { error: "Invalid 'how did you hear about us' option." };
    out.howHeard = v;
  }
  if (body.interests !== undefined) out.interests = pickInterests(body.interests);
  if (body.prayerRequest !== undefined)
    out.prayerRequest = String(body.prayerRequest ?? "").trim().slice(0, 2000);
  if (body.ageGroup !== undefined) {
    const v = String(body.ageGroup ?? "").trim();
    if (v && !(AGE_GROUPS as readonly string[]).includes(v))
      return { error: "Invalid age group." };
    out.ageGroup = v;
  }
  if (body.address !== undefined)
    out.address = String(body.address ?? "").trim().slice(0, 300);
  if (body.city !== undefined)
    out.city = String(body.city ?? "").trim().slice(0, 100);

  return { fields: out };
}

/** Lean mongoose doc → JSON-safe DTO the dashboard reads. */
export function shapeCard(
  c: ConnectCardDoc & { _id: unknown; createdAt?: Date; updatedAt?: Date }
): ConnectCardDto {
  return {
    _id: String(c._id),
    name: c.name,
    phone: c.phone ?? "",
    email: c.email ?? "",
    visitDate: c.visitDate ? new Date(c.visitDate).toISOString() : "",
    firstTime: c.firstTime ?? true,
    howHeard: c.howHeard ?? "",
    interests: c.interests ?? [],
    prayerRequest: c.prayerRequest ?? "",
    ageGroup: (c.ageGroup ?? "") as ConnectCardDto["ageGroup"],
    address: c.address ?? "",
    city: c.city ?? "",
    status: c.status ?? "new",
    assignedTo: c.assignedTo ? String(c.assignedTo) : null,
    assignedToName: c.assignedToName ?? "",
    followUps: (c.followUps ?? []).map((f) => ({
      _id: String((f as { _id?: unknown })._id ?? ""),
      at: f.at ? new Date(f.at).toISOString() : "",
      by: f.by ?? "",
      method: f.method,
      note: f.note ?? "",
    })),
    linkedPerson: c.linkedPerson ? String(c.linkedPerson) : null,
    source: c.source ?? "admin",
    createdAt: c.createdAt ? new Date(c.createdAt).toISOString() : undefined,
    updatedAt: c.updatedAt ? new Date(c.updatedAt).toISOString() : undefined,
  };
}
