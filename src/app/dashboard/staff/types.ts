/** Staff app vocab — the model, API and UI all read from here. */

export const STAFF_STATUSES = ["active", "on-leave", "left"] as const;
export type StaffStatus = (typeof STAFF_STATUSES)[number];

export const STAFF_STATUS_LABELS: Record<StaffStatus, string> = {
  active: "Active",
  "on-leave": "On leave",
  left: "Left",
};

export const EMPLOYMENT_TYPES = [
  "full-time",
  "part-time",
  "volunteer",
  "bi-vocational",
] as const;
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];

export const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
  "full-time": "Full-time",
  "part-time": "Part-time",
  volunteer: "Volunteer",
  "bi-vocational": "Bi-vocational",
};

/** Suggestions for the title field — churches can type anything else. */
export const COMMON_TITLES = [
  "Senior Pastor",
  "Associate Pastor",
  "Assistant Pastor",
  "Youth Pastor",
  "Worship Leader",
  "Children's Director",
  "Women's Ministry Leader",
  "Men's Ministry Leader",
  "Missions Coordinator",
  "Administrator",
  "Office Secretary",
  "Accountant",
  "Sunday School Superintendent",
  "Choir Director",
  "Media & Communications",
  "Caretaker",
  "Security",
  "Driver",
] as const;

export type StaffDto = {
  _id: string;
  staffNo: string;
  name: string;
  title?: string;
  ministry?: string;
  employmentType: EmploymentType;
  phone?: string;
  email?: string;
  photoUrl?: string;
  joinDate?: string | null;
  leaveDate?: string | null;
  status: StaffStatus;
  person?: string | null;
  personName?: string;
  personMemberNo?: string;
  ordinationDate?: string | null;
  qualifications?: string;
  emergencyContact?: { name?: string; phone?: string; relation?: string };
  address?: string;
  notes?: string;
  documents?: { name: string; url: string }[];
  createdAt?: string;
};

export type StaffListResponse = {
  staff: StaffDto[];
  ministries: string[];
  counts: Record<StaffStatus, number>;
  total: number;
};

export const STATUS_STYLES: Record<StaffStatus, string> = {
  active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  "on-leave": "bg-amber-50 text-amber-700 border-amber-200",
  left: "bg-slate-100 text-slate-500 border-slate-200",
};

export const TYPE_PILL_STYLES: Record<EmploymentType, string> = {
  "full-time": "bg-indigo-50 text-indigo-700",
  "part-time": "bg-sky-50 text-sky-700",
  volunteer: "bg-violet-50 text-violet-700",
  "bi-vocational": "bg-teal-50 text-teal-700",
};
