export {
  CERTIFICATE_TYPES,
  CERTIFICATE_LABELS,
  CERTIFICATE_TITLES,
  CERTIFICATE_DESCRIPTIONS,
  DEFAULT_VERSES,
  MILESTONE_FIELDS,
  type CertificateType,
} from "@/lib/certificates";
import type { CertificateType } from "@/lib/certificates";

export type CertificateSnapshot = {
  personName: string;
  memberNo: string;
  dob?: string | null;
  gender?: string;
  fatherName?: string;
  motherName?: string;
  spouseName?: string;
  eventDate?: string | null;
  place?: string;
  officiant?: string;
  witnesses?: string;
  verse?: string;
  remark?: string;
  churchName?: string;
  churchAddress?: string;
  logoUrl?: string;
  pastorName?: string;
};

export type CertificateDto = {
  _id: string;
  serialNo: string;
  type: CertificateType;
  person: string | null;
  spouse?: string | null;
  data: CertificateSnapshot;
  issuedAt: string;
  issuedBy?: string;
  createdAt?: string;
};

export type CertificateListResponse = {
  certificates: CertificateDto[];
  counts: Record<string, number>;
  total: number;
};

export type ChurchInfo = {
  name: string;
  address?: string;
  logoUrl?: string;
  pastorName?: string;
};

export const TYPE_PILL_STYLES: Record<CertificateType, string> = {
  baptism: "bg-sky-50 text-sky-700 ring-sky-600/20",
  dedication: "bg-amber-50 text-amber-700 ring-amber-600/20",
  marriage: "bg-rose-50 text-rose-700 ring-rose-600/20",
  membership: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  confirmation: "bg-violet-50 text-violet-700 ring-violet-600/20",
  appreciation: "bg-indigo-50 text-indigo-700 ring-indigo-600/20",
};

/** Long-form date for the printed certificate — "14 March 2026". Date-only
 *  values are UTC midnight, so format in UTC to keep the day stable. */
export function formatCertificateDate(value?: string | Date | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
