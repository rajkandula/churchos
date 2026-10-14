import { DAYS_OF_WEEK } from "@/lib/constants";

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Whitelist + validate the editable fields of a Service from a request body.
 *  Returns an error message instead of a patch when something is invalid. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function pickServiceFields(body: any):
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; error: string } {
  const data: Record<string, unknown> = {};
  if (body.name !== undefined) {
    const name = String(body.name ?? "").trim();
    if (!name) return { ok: false, error: "Please enter the service name." };
    data.name = name.slice(0, 80);
  }
  if (body.dayOfWeek !== undefined) {
    const day = String(body.dayOfWeek ?? "").trim();
    if (day && !(DAYS_OF_WEEK as readonly string[]).includes(day))
      return { ok: false, error: "Invalid day of week." };
    data.dayOfWeek = day;
  }
  if (body.time !== undefined) {
    const time = String(body.time ?? "").trim();
    if (time && !TIME_RE.test(time))
      return { ok: false, error: "Time must be HH:MM (24-hour)." };
    data.time = time;
  }
  if (body.location !== undefined)
    data.location = String(body.location ?? "").trim().slice(0, 120);
  if (body.active !== undefined) data.active = Boolean(body.active);
  if (body.sortOrder !== undefined) {
    const n = Number(body.sortOrder);
    data.sortOrder = Number.isFinite(n) ? Math.round(n) : 0;
  }
  return { ok: true, data };
}

export function isDuplicateKeyError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { code?: number }).code === 11000
  );
}
