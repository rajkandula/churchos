/** Events app — shared vocab and DTOs (client-safe, no mongoose). */

export const EVENT_STATUSES = ["draft", "published", "cancelled", "completed"] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

export const EVENT_STATUS_LABELS: Record<EventStatus, string> = {
  draft: "Draft",
  published: "Published",
  cancelled: "Cancelled",
  completed: "Completed",
};

export const EVENT_STATUS_STYLES: Record<EventStatus, string> = {
  draft: "bg-slate-100 text-slate-600 ring-slate-500/20",
  published: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  cancelled: "bg-rose-50 text-rose-700 ring-rose-600/20",
  completed: "bg-indigo-50 text-indigo-700 ring-indigo-600/20",
};

export const REGISTRATION_STATUSES = [
  "registered",
  "waitlisted",
  "cancelled",
  "attended",
] as const;
export type RegistrationStatus = (typeof REGISTRATION_STATUSES)[number];

export const REGISTRATION_STATUS_LABELS: Record<RegistrationStatus, string> = {
  registered: "Registered",
  waitlisted: "Waitlisted",
  cancelled: "Cancelled",
  attended: "Attended",
};

export const REGISTRATION_STATUS_STYLES: Record<RegistrationStatus, string> = {
  registered: "bg-sky-50 text-sky-700 border-sky-200",
  waitlisted: "bg-amber-50 text-amber-700 border-amber-200",
  cancelled: "bg-slate-100 text-slate-500 border-slate-200",
  attended: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

export const REGISTRATION_SOURCES = ["admin", "public"] as const;
export type RegistrationSource = (typeof REGISTRATION_SOURCES)[number];

export type EventDto = {
  _id: string;
  title: string;
  description?: string;
  startAt: string;
  endAt?: string | null;
  venue?: string;
  coverUrl?: string;
  capacity?: number | null;
  registrationOpen: boolean;
  fee: number;
  publicSlug?: string;
  status: EventStatus;
  organizer?: string | null;
  organizerName?: string;
  tags?: string[];
  registeredCount: number;
  spotsLeft: number | null;
  createdAt?: string;
};

export type RegistrationDto = {
  _id: string;
  event: string;
  person: string | null;
  name: string;
  phone?: string;
  email?: string;
  guests: number;
  notes?: string;
  status: RegistrationStatus;
  source: RegistrationSource;
  registeredAt: string;
};

export type EventStats = {
  registered: number;
  waitlisted: number;
  attended: number;
  cancelled: number;
  registeredCount: number;
  spotsLeft: number | null;
};

/** For <input type="datetime-local"> — local wall-clock, minute precision. */
export function toDateTimeInput(value?: string | Date | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

/** Card date badge — "14" / "Sep". */
export function dateParts(value: string | Date): { day: string; month: string } {
  const d = new Date(value);
  return {
    day: d.toLocaleDateString("en-IN", { day: "numeric" }),
    month: d.toLocaleDateString("en-IN", { month: "short" }),
  };
}

/** Human date range for an event — "Sat, 14 Sep 2026, 6:00 pm – 8:30 pm". */
export function formatEventRange(startAt: string | Date, endAt?: string | Date | null): string {
  const s = new Date(startAt);
  if (Number.isNaN(s.getTime())) return "—";
  const dateOpts: Intl.DateTimeFormatOptions = {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  };
  const timeOpts: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit", hour12: true };
  const startStr = `${s.toLocaleDateString("en-IN", dateOpts)}, ${s.toLocaleTimeString("en-IN", timeOpts)}`;
  if (!endAt) return startStr;
  const e = new Date(endAt);
  if (Number.isNaN(e.getTime())) return startStr;
  const sameDay = s.toDateString() === e.toDateString();
  return sameDay
    ? `${startStr} – ${e.toLocaleTimeString("en-IN", timeOpts)}`
    : `${startStr} – ${e.toLocaleDateString("en-IN", dateOpts)}, ${e.toLocaleTimeString("en-IN", timeOpts)}`;
}
