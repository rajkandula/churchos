export type ServiceDto = {
  _id: string;
  name: string;
  dayOfWeek: string;
  time: string;
  location: string;
  active: boolean;
  sortOrder: number;
};

export type RosterPerson = {
  _id: string;
  name: string;
  memberNo: string;
  photoUrl?: string;
  householdName?: string;
  present: boolean;
};

export type AttendanceEntry = { person: string; personName: string; present: boolean };

export type AttendanceDto = {
  _id: string;
  service: string;
  serviceName: string;
  date: string;
  headcount: number;
  adults: number | null;
  children: number | null;
  entries: AttendanceEntry[];
  note: string;
  markedBy: string | null;
  markedByName: string;
  updatedAt: string | null;
};

export type RegisterRow = {
  person: string;
  personName: string;
  marks: Record<string, boolean | null>;
  presentCount: number;
  markedCount: number;
};

export type RegisterData = {
  from: string;
  to: string;
  dates: string[];
  rows: RegisterRow[];
  headcounts: Record<string, number>;
};

export type CheckInDto = {
  _id: string;
  date: string;
  service: string | null;
  serviceName: string;
  person: string;
  personName: string;
  age: number | null;
  guardianName: string;
  guardianPhone: string;
  securityCode: string;
  room: string;
  checkedInAt: string;
  checkedOutAt: string | null;
  checkedInBy: string | null;
  notes: string;
  allergies: string;
};

export const ROOM_SUGGESTIONS = ["Nursery", "Toddlers", "Kids", "Teens"] as const;

export const ATTENDANCE_TABS = [
  { value: "mark", label: "Mark" },
  { value: "register", label: "Register" },
  { value: "checkin", label: "Check-in" },
  { value: "services", label: "Services" },
] as const;

export type AttendanceTab = (typeof ATTENDANCE_TABS)[number]["value"];

export const selectClass =
  "h-10 cursor-pointer rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10";

export const inputClass =
  "h-10 rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10";

/** Label a service for a <select>: "Sunday Service · Sun 09:30". */
export function serviceLabel(s: ServiceDto): string {
  const bits = [s.dayOfWeek ? s.dayOfWeek.slice(0, 3) : "", s.time].filter(Boolean);
  return bits.length ? `${s.name} · ${bits.join(" ")}` : s.name;
}
