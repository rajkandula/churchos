export type PersonDto = {
  _id: string;
  memberNo: string;
  name: string;
  gender?: string;
  dob?: string | null;
  maritalStatus?: string;
  bloodGroup?: string;
  occupation?: string;
  photoUrl?: string;
  phone?: string;
  altPhone?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  household?: string | null;
  householdName?: string;
  householdRole?: string;
  status: "visitor" | "regular" | "member" | "inactive" | "transferred" | "deceased";
  memberSince?: string | null;
  firstVisit?: string | null;
  source?: string;
  baptismDate?: string | null;
  baptismPlace?: string;
  confirmationDate?: string | null;
  marriageDate?: string | null;
  dedicationDate?: string | null;
  tags?: string[];
  documents?: { name: string; url: string }[];
  notes?: string;
  createdAt?: string;
};

export type PeopleOptions = {
  counts: Record<string, number>;
  total: number;
  tags: { tag: string; count: number }[];
  households: { _id: string; name: string }[];
};

export type HouseholdDto = {
  _id: string;
  name: string;
  head?: string | null;
  headName?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  anniversary?: string | null;
  notes?: string;
  memberCount?: number;
  memberNames?: string[];
};

export const STATUS_STYLES: Record<string, string> = {
  visitor: "bg-amber-50 text-amber-700 border-amber-200",
  regular: "bg-sky-50 text-sky-700 border-sky-200",
  member: "bg-emerald-50 text-emerald-700 border-emerald-200",
  inactive: "bg-slate-100 text-slate-600 border-slate-200",
  transferred: "bg-violet-50 text-violet-700 border-violet-200",
  deceased: "bg-slate-100 text-slate-500 border-slate-200",
};

export const PILL_STYLES: Record<string, string> = {
  visitor: "bg-amber-50 text-amber-700 ring-amber-600/20",
  regular: "bg-sky-50 text-sky-700 ring-sky-600/20",
  member: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  inactive: "bg-slate-100 text-slate-600 ring-slate-500/20",
  transferred: "bg-violet-50 text-violet-700 ring-violet-600/20",
  deceased: "bg-slate-100 text-slate-500 ring-slate-400/20",
};

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
