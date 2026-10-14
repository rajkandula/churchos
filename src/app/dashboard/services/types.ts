/** Services app — order-of-service planning + volunteer scheduling. */

export const ITEM_TYPES = [
  "song",
  "prayer",
  "scripture",
  "sermon",
  "announcement",
  "offering",
  "communion",
  "video",
  "other",
] as const;
export type ItemType = (typeof ITEM_TYPES)[number];

export const ITEM_TYPE_LABELS: Record<ItemType, string> = {
  song: "Song",
  prayer: "Prayer",
  scripture: "Scripture",
  sermon: "Sermon",
  announcement: "Announcement",
  offering: "Offering",
  communion: "Communion",
  video: "Video",
  other: "Other",
};

/** Sensible starting length per item type (minutes) — editable after adding. */
export const ITEM_TYPE_DEFAULT_MIN: Record<ItemType, number> = {
  song: 5,
  prayer: 3,
  scripture: 3,
  sermon: 35,
  announcement: 5,
  offering: 5,
  communion: 10,
  video: 4,
  other: 5,
};

export const VOLUNTEER_STATUSES = ["scheduled", "confirmed", "declined"] as const;
export type VolunteerStatus = (typeof VOLUNTEER_STATUSES)[number];

export const VOLUNTEER_STATUS_LABELS: Record<VolunteerStatus, string> = {
  scheduled: "Scheduled",
  confirmed: "Confirmed",
  declined: "Declined",
};

export const VOLUNTEER_STATUS_STYLES: Record<VolunteerStatus, string> = {
  scheduled: "bg-amber-50 text-amber-700 ring-amber-600/20",
  confirmed: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  declined: "bg-rose-50 text-rose-700 ring-rose-600/20",
};

export const PLAN_STATUSES = ["draft", "final"] as const;
export type PlanStatus = (typeof PLAN_STATUSES)[number];

export const PLAN_STATUS_STYLES: Record<PlanStatus, string> = {
  draft: "bg-slate-100 text-slate-600 ring-slate-500/20",
  final: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
};

/** Run sheets start here when no other start time is known. */
export const DEFAULT_SERVICE_START = "09:00";

export type TeamMemberDto = {
  person: string;
  personName: string;
  roles: string[];
  photoUrl?: string;
  phone?: string;
  memberNo?: string;
};

export type TeamDto = {
  _id: string;
  name: string;
  description?: string;
  roles: string[];
  leader?: string | null;
  leaderName?: string;
  members: TeamMemberDto[];
  memberCount?: number;
  active: boolean;
  createdAt?: string;
};

export type PlanItemDto = {
  _id?: string;
  order: number;
  type: ItemType;
  title: string;
  detail?: string;
  owner?: string | null;
  ownerName?: string;
  ownerMemberNo?: string;
  ownerPhotoUrl?: string;
  durationMin: number;
};

export type PlanVolunteerDto = {
  _id?: string;
  team: string;
  teamName: string;
  role: string;
  person?: string | null;
  personName?: string;
  memberNo?: string;
  photoUrl?: string;
  phone?: string;
  status: VolunteerStatus;
};

export type PlanSummaryDto = {
  _id: string;
  date: string;
  title: string;
  theme?: string;
  preacherName?: string;
  status: PlanStatus;
  itemCount: number;
  volunteerCount: number;
  totalDurationMin: number;
};

export type PlanDto = {
  _id: string;
  date: string;
  title: string;
  theme?: string;
  scripture?: string;
  preacher?: string | null;
  preacherName?: string;
  preacherMemberNo?: string;
  preacherPhotoUrl?: string;
  notes?: string;
  items: PlanItemDto[];
  volunteers: PlanVolunteerDto[];
  status: PlanStatus;
  createdAt?: string;
  updatedAt?: string;
};

export type ChurchInfo = {
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  logoUrl?: string;
};

export function totalMinutes(items: { durationMin?: number }[]): number {
  return items.reduce((sum, i) => sum + (Number(i.durationMin) || 0), 0);
}

export function formatDuration(min: number): string {
  if (!min) return "0 min";
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** "09:00" + 35 → "09:35". */
export function addMinutes(hhmm: string, minutes: number): string {
  const [h, m] = hhmm.split(":").map((n) => Number(n) || 0);
  const total = (h * 60 + m + minutes + 24 * 60) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/** "09:35" → "9:35 am" for run sheets. */
export function formatClock(hhmm: string): string {
  const [h, m] = hhmm.split(":").map((n) => Number(n) || 0);
  const suffix = h >= 12 ? "pm" : "am";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${suffix}`;
}

export function monthKey(date: string): string {
  const d = new Date(date);
  return d.toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
}

export function weekday(date: string): string {
  return new Date(date).toLocaleDateString("en-IN", { weekday: "short", timeZone: "UTC" });
}
