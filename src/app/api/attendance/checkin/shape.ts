import { dateKey } from "@/lib/attendance-dates";

/** Wire shape for one check-in — ids as strings, date as a key. */
export function shapeCheckIn(c: {
  _id: unknown;
  date: Date;
  service?: unknown;
  serviceName?: string | null;
  person: unknown;
  personName: string;
  age?: number | null;
  guardianName?: string | null;
  guardianPhone: string;
  securityCode: string;
  room?: string | null;
  checkedInAt: Date;
  checkedOutAt?: Date | null;
  checkedInBy?: unknown;
  notes?: string | null;
  allergies?: string | null;
}) {
  return {
    _id: String(c._id),
    date: dateKey(c.date),
    service: c.service ? String(c.service) : null,
    serviceName: c.serviceName ?? "",
    person: String(c.person),
    personName: c.personName,
    age: c.age ?? null,
    guardianName: c.guardianName ?? "",
    guardianPhone: c.guardianPhone,
    securityCode: c.securityCode,
    room: c.room ?? "",
    checkedInAt: c.checkedInAt,
    checkedOutAt: c.checkedOutAt ?? null,
    checkedInBy: c.checkedInBy ? String(c.checkedInBy) : null,
    notes: c.notes ?? "",
    allergies: c.allergies ?? "",
  };
}
