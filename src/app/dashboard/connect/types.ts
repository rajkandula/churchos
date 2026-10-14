/** Connect app vocab — shared by the model, API routes and both UIs.
 *  Pure constants only (no mongoose, no React) so it is safe on the client. */

export const CONNECT_STATUSES = [
  "new",
  "contacted",
  "visited-again",
  "joined",
  "closed",
] as const;
export type ConnectStatus = (typeof CONNECT_STATUSES)[number];

export const CONNECT_STATUS_LABELS: Record<ConnectStatus, string> = {
  new: "New",
  contacted: "Contacted",
  "visited-again": "Visited again",
  joined: "Joined",
  closed: "Closed",
};

export const STATUS_STYLES: Record<ConnectStatus, string> = {
  new: "bg-amber-50 text-amber-700 border-amber-200",
  contacted: "bg-sky-50 text-sky-700 border-sky-200",
  "visited-again": "bg-violet-50 text-violet-700 border-violet-200",
  joined: "bg-emerald-50 text-emerald-700 border-emerald-200",
  closed: "bg-slate-100 text-slate-600 border-slate-200",
};

/** Column accent (top border) on the board. */
export const COLUMN_ACCENT: Record<ConnectStatus, string> = {
  new: "border-t-amber-400",
  contacted: "border-t-sky-400",
  "visited-again": "border-t-violet-400",
  joined: "border-t-emerald-400",
  closed: "border-t-slate-300",
};

export const INTEREST_OPTIONS = [
  "Join a small group",
  "Baptism",
  "Volunteer",
  "Kids ministry",
  "Talk to a pastor",
  "Membership class",
] as const;

export const AGE_GROUPS = ["child", "youth", "adult", "senior"] as const;
export type AgeGroup = (typeof AGE_GROUPS)[number];
export const AGE_GROUP_LABELS: Record<AgeGroup, string> = {
  child: "Child (under 13)",
  youth: "Youth (13–25)",
  adult: "Adult",
  senior: "Senior",
};

export const FOLLOW_UP_METHODS = [
  "call",
  "text",
  "email",
  "visit",
  "in-person",
] as const;
export type FollowUpMethod = (typeof FOLLOW_UP_METHODS)[number];
export const FOLLOW_UP_METHOD_LABELS: Record<FollowUpMethod, string> = {
  call: "Phone call",
  text: "Text / WhatsApp",
  email: "Email",
  visit: "Home visit",
  "in-person": "In person",
};

export const CARD_SOURCES = ["public", "admin"] as const;

export type FollowUpDto = {
  _id: string;
  at: string;
  by: string;
  method: FollowUpMethod;
  note: string;
};

export type ConnectCardDto = {
  _id: string;
  name: string;
  phone: string;
  email: string;
  visitDate: string;
  firstTime: boolean;
  howHeard: string;
  interests: string[];
  prayerRequest: string;
  ageGroup: AgeGroup | "";
  address: string;
  city: string;
  status: ConnectStatus;
  assignedTo: string | null;
  assignedToName: string;
  followUps: FollowUpDto[];
  linkedPerson: string | null;
  source: "public" | "admin";
  createdAt?: string;
  updatedAt?: string;
};

export type Assignee = { _id: string; name: string };

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/** Whole days between a date and now (never negative). */
export function daysSince(value: string | Date): number {
  const d = new Date(value).getTime();
  if (Number.isNaN(d)) return 0;
  return Math.max(0, Math.floor((Date.now() - d) / 86_400_000));
}
