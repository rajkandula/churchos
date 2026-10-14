/**
 * Attendance stores calendar days as UTC midnight so a service on
 * "2026-09-06" is the same document no matter the viewer's timezone.
 * These helpers are plain TS (no mongoose, no "use client") so both the
 * API routes and the dashboard pages can share them.
 */

const KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** "YYYY-MM-DD" → UTC midnight, or null when malformed / impossible. */
export function parseDateKey(value: unknown): Date | null {
  const s = String(value ?? "").trim();
  const m = KEY_RE.exec(s);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (Number.isNaN(d.getTime())) return null;
  // Reject overflowed dates like 2026-02-31
  return d.toISOString().slice(0, 10) === s ? d : null;
}

/** Any date/ISO string → "YYYY-MM-DD" (UTC calendar day). */
export function dateKey(value: Date | string): string {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

/** Today's calendar date where the code runs, as a key. */
export function todayKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Shift a key by whole days (negative = past). */
export function addDaysToKey(key: string, days: number): string {
  const d = parseDateKey(key) ?? new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Whole years between a date of birth and a reference day. */
export function ageOn(dob: Date | string | null | undefined, on: Date): number | null {
  if (!dob) return null;
  const b = new Date(dob);
  if (Number.isNaN(b.getTime())) return null;
  let age = on.getUTCFullYear() - b.getUTCFullYear();
  const beforeBirthday =
    on.getUTCMonth() < b.getUTCMonth() ||
    (on.getUTCMonth() === b.getUTCMonth() && on.getUTCDate() < b.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age < 0 ? null : age;
}
