import { isValidObjectId } from "@/lib/person-fields";
import {
  EMPLOYMENT_TYPES,
  STAFF_STATUSES,
} from "@/app/dashboard/staff/types";

const STRING_FIELDS = [
  "name",
  "title",
  "ministry",
  "phone",
  "email",
  "photoUrl",
  "qualifications",
  "address",
  "notes",
] as const;

const DATE_FIELDS = ["joinDate", "leaveDate", "ordinationDate"] as const;

const PHONE_RE = /^[0-9+\-\s()]{6,20}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Whitelist + normalise the editable fields of a Staff record.
 *  Returns an error message instead of the update when input is invalid. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function pickStaffFields(body: any):
  | { ok: true; update: Record<string, unknown> }
  | { ok: false; error: string } {
  const update: Record<string, unknown> = {};

  for (const key of STRING_FIELDS) {
    if (body[key] !== undefined) {
      const v = String(body[key] ?? "").trim();
      update[key] = key === "email" ? v.toLowerCase() : v;
    }
  }
  if (update.name === "") return { ok: false, error: "Please enter the staff member's name." };
  if (update.phone && !PHONE_RE.test(String(update.phone)))
    return { ok: false, error: "Please enter a valid phone number." };
  if (update.email && !EMAIL_RE.test(String(update.email)))
    return { ok: false, error: "Please enter a valid email address." };

  for (const key of DATE_FIELDS) {
    if (body[key] !== undefined) {
      const v = String(body[key] ?? "").trim();
      if (!v) {
        update[key] = null;
      } else {
        const d = new Date(v);
        if (Number.isNaN(d.getTime()))
          return { ok: false, error: "One of the dates is not valid." };
        update[key] = d;
      }
    }
  }

  if (body.employmentType !== undefined) {
    const v = String(body.employmentType ?? "");
    if (!(EMPLOYMENT_TYPES as readonly string[]).includes(v))
      return { ok: false, error: "Invalid employment type." };
    update.employmentType = v;
  }
  if (body.status !== undefined) {
    const v = String(body.status ?? "");
    if (!(STAFF_STATUSES as readonly string[]).includes(v))
      return { ok: false, error: "Invalid status." };
    update.status = v;
  }

  if (body.person !== undefined) {
    const v = String(body.person ?? "").trim();
    if (v && !isValidObjectId(v))
      return { ok: false, error: "The linked person is not valid." };
    update.person = v || null;
  }

  if (body.emergencyContact !== undefined) {
    const ec = body.emergencyContact ?? {};
    const phone = String(ec.phone ?? "").trim();
    if (phone && !PHONE_RE.test(phone))
      return { ok: false, error: "Please enter a valid emergency contact phone number." };
    update.emergencyContact = {
      name: String(ec.name ?? "").trim().slice(0, 120),
      phone,
      relation: String(ec.relation ?? "").trim().slice(0, 60),
    };
  }

  if (body.documents !== undefined && Array.isArray(body.documents)) {
    update.documents = body.documents
      .filter(
        (d: unknown) =>
          d && typeof d === "object" && (d as { url?: string }).url
      )
      .map((d: { name?: string; url: string }) => ({
        name: String(d.name ?? "Document").slice(0, 120),
        url: String(d.url),
      }));
  }

  return { ok: true, update };
}

/** Search/filter params from the Staff list → a Mongo filter. */
export function buildStaffFilter(
  params: URLSearchParams
): Record<string, unknown> {
  const filter: Record<string, unknown> = {};
  const q = (params.get("q") ?? "").trim();
  if (q) {
    const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [
      { name: re },
      { title: re },
      { ministry: re },
      { staffNo: re },
      { phone: re },
      { email: re },
    ];
  }
  const status = (params.get("status") ?? "").trim();
  if (status && (STAFF_STATUSES as readonly string[]).includes(status))
    filter.status = status;
  const ministry = (params.get("ministry") ?? "").trim();
  if (ministry) filter.ministry = ministry;
  return filter;
}
