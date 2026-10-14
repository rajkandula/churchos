import { Types } from "mongoose";
import { PERSON_STATUSES } from "@/lib/constants";

export function isValidObjectId(id: string): boolean {
  return Types.ObjectId.isValid(id) && String(new Types.ObjectId(id)) === id;
}

const STRING_FIELDS = [
  "name",
  "gender",
  "maritalStatus",
  "bloodGroup",
  "occupation",
  "photoUrl",
  "phone",
  "altPhone",
  "email",
  "address",
  "city",
  "state",
  "pincode",
  "householdRole",
  "source",
  "baptismPlace",
  "notes",
] as const;

const DATE_FIELDS = [
  "dob",
  "memberSince",
  "firstVisit",
  "baptismDate",
  "confirmationDate",
  "marriageDate",
  "dedicationDate",
] as const;

/** Whitelist + normalise the editable fields of a Person from a request body. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function pickPersonFields(body: any): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of STRING_FIELDS) {
    if (body[key] !== undefined) {
      const v = String(body[key] ?? "").trim();
      out[key] = key === "email" ? v.toLowerCase() : v;
    }
  }
  for (const key of DATE_FIELDS) {
    if (body[key] !== undefined) {
      const v = String(body[key] ?? "").trim();
      out[key] = v ? new Date(v) : null;
    }
  }
  if (body.household !== undefined) {
    const v = String(body.household ?? "").trim();
    out.household = v && isValidObjectId(v) ? v : null;
  }
  if (body.tags !== undefined) {
    const raw: unknown[] = Array.isArray(body.tags)
      ? body.tags
      : String(body.tags ?? "").split(",");
    out.tags = Array.from(
      new Set(raw.map((t) => String(t).trim().toLowerCase()).filter(Boolean))
    ).slice(0, 30);
  }
  if (body.documents !== undefined && Array.isArray(body.documents)) {
    out.documents = body.documents
      .filter(
        (d: unknown) =>
          d && typeof d === "object" && (d as { url?: string }).url
      )
      .map((d: { name?: string; url: string }) => ({
        name: String(d.name ?? "Document").slice(0, 120),
        url: String(d.url),
      }));
  }
  return out;
}

/** Search/filter params from the People list → a Mongo filter. */
export function buildPersonFilter(
  params: URLSearchParams
): Record<string, unknown> {
  const filter: Record<string, unknown> = {};
  const q = (params.get("q") ?? "").trim();
  if (q) {
    const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ name: re }, { phone: re }, { email: re }, { memberNo: re }];
  }
  const status = (params.get("status") ?? "").trim();
  if (status && (PERSON_STATUSES as readonly string[]).includes(status))
    filter.status = status;
  const tag = (params.get("tag") ?? "").trim().toLowerCase();
  if (tag) filter.tags = tag;
  const household = (params.get("household") ?? "").trim();
  if (household && isValidObjectId(household)) filter.household = household;
  const gender = (params.get("gender") ?? "").trim();
  if (gender) filter.gender = gender;
  return filter;
}
