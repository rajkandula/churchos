/** Groups vocab — shared by the model, the API and the UI (no mongoose here). */

export const GROUP_TYPES = ["small-group", "ministry", "team", "class", "other"] as const;
export type GroupType = (typeof GROUP_TYPES)[number];

export const GROUP_TYPE_LABELS: Record<GroupType, string> = {
  "small-group": "Small group",
  ministry: "Ministry",
  team: "Team",
  class: "Class",
  other: "Other",
};

export const GROUP_TYPE_STYLES: Record<GroupType, string> = {
  "small-group": "bg-indigo-50 text-indigo-700 ring-indigo-600/20",
  ministry: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  team: "bg-amber-50 text-amber-700 ring-amber-600/20",
  class: "bg-sky-50 text-sky-700 ring-sky-600/20",
  other: "bg-slate-100 text-slate-600 ring-slate-500/20",
};

export const GROUP_FREQUENCIES = ["weekly", "fortnightly", "monthly", "ad-hoc"] as const;
export type GroupFrequency = (typeof GROUP_FREQUENCIES)[number];

export const GROUP_FREQUENCY_LABELS: Record<GroupFrequency, string> = {
  weekly: "Weekly",
  fortnightly: "Fortnightly",
  monthly: "Monthly",
  "ad-hoc": "Ad hoc",
};

export const MEMBER_ROLES = ["member", "leader", "co-leader", "host", "apprentice"] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];

export const MEMBER_ROLE_LABELS: Record<MemberRole, string> = {
  member: "Member",
  leader: "Leader",
  "co-leader": "Co-leader",
  host: "Host",
  apprentice: "Apprentice",
};

export type GroupMemberDto = {
  person: string;
  personName: string;
  role: string;
  joinedAt?: string | null;
  // Live from the Person record (only on the detail endpoint)
  photoUrl?: string;
  phone?: string;
  status?: string;
  /** false when the Person record has since been deleted */
  exists?: boolean;
};

export type GroupCoLeaderDto = {
  person: string;
  personName: string;
  photoUrl?: string;
};

export type GroupMeetingDto = {
  _id: string;
  date: string;
  present: string[];
  note: string;
  presentCount: number;
};

export type GroupDto = {
  _id: string;
  name: string;
  type: GroupType;
  description?: string;
  leader: string | null;
  leaderName?: string;
  leaderPhotoUrl?: string;
  coLeaders: GroupCoLeaderDto[];
  meetingDay?: string;
  meetingTime?: string;
  frequency: GroupFrequency;
  location?: string;
  members: GroupMemberDto[];
  capacity?: number | null;
  open: boolean;
  tags: string[];
  active: boolean;
  meetings?: GroupMeetingDto[];
  memberCount: number;
  /** "Wed 4 Sep · 7:00 PM" — empty for ad-hoc groups or no meeting day */
  nextMeeting?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type GroupsOptions = {
  types: { type: string; count: number }[];
  total: number;
  totalMembers: number;
};

/** "19:00" → "7:00 PM" */
export function formatTime12(hhmm?: string | null): string {
  if (!hhmm) return "";
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!m) return hhmm;
  const h = Number(m[1]);
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m[2]} ${suffix}`;
}

/** "Wednesdays 7:00 PM · Room 2" */
export function meetingLine(g: {
  meetingDay?: string;
  meetingTime?: string;
  frequency?: string;
  location?: string;
}): string {
  const day = g.meetingDay ?? "";
  const time = formatTime12(g.meetingTime);
  let when = "";
  if (g.frequency === "ad-hoc") {
    when = day ? `Ad hoc, usually ${day}s` : "Ad hoc";
  } else if (day) {
    when =
      g.frequency === "fortnightly"
        ? `Every other ${day}`
        : g.frequency === "monthly"
          ? `Monthly on ${day}s`
          : `${day}s`;
  }
  const first = [when, time].filter(Boolean).join(" ");
  return [first, g.location].filter(Boolean).join(" · ");
}
