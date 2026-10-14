/**
 * Certificates vocab + helpers. No mongoose import — the client pages and
 * the model both read from here (same split as lib/constants ↔ Person).
 */
import type { CertificateDoc } from "@/models/Certificate";

export const CERTIFICATE_TYPES = [
  "baptism",
  "dedication",
  "marriage",
  "membership",
  "confirmation",
  "appreciation",
] as const;
export type CertificateType = (typeof CERTIFICATE_TYPES)[number];

export const CERTIFICATE_LABELS: Record<CertificateType, string> = {
  baptism: "Baptism",
  dedication: "Child dedication",
  marriage: "Marriage",
  membership: "Membership",
  confirmation: "Confirmation",
  appreciation: "Appreciation",
};

/** Printed heading — "Certificate of Baptism". */
export const CERTIFICATE_TITLES: Record<CertificateType, string> = {
  baptism: "Certificate of Baptism",
  dedication: "Certificate of Dedication",
  marriage: "Certificate of Marriage",
  membership: "Certificate of Membership",
  confirmation: "Certificate of Confirmation",
  appreciation: "Certificate of Appreciation",
};

/** One-liners for the type picker. */
export const CERTIFICATE_DESCRIPTIONS: Record<CertificateType, string> = {
  baptism: "Records a believer's baptism — date and place.",
  dedication: "A child dedicated to the Lord by their parents.",
  marriage: "A couple united in holy matrimony.",
  membership: "Formal reception into the church's membership.",
  confirmation: "Confirmed in the faith after instruction.",
  appreciation: "Honours faithful service to the church.",
};

/** Scripture read on the certificate — editable per issue. */
export const DEFAULT_VERSES: Record<CertificateType, string> = {
  baptism:
    "We were buried therefore with him through baptism into death, that just as Christ was raised from the dead through the glory of the Father, so we also might walk in newness of life. — Romans 6:4",
  dedication:
    "For this child I prayed, and the LORD has given me my petition which I asked of him. Therefore I have also given him to the LORD; as long as he lives he is given to the LORD. — 1 Samuel 1:27-28",
  marriage:
    "Though one may be overpowered, two can withstand; and a threefold cord is not quickly broken. — Ecclesiastes 4:12",
  membership:
    "So then you are no longer strangers and foreigners, but you are fellow citizens with the saints and of the household of God. — Ephesians 2:19",
  confirmation:
    "For this cause I remind you that you should stir up the gift of God which is in you through the laying on of my hands. — 2 Timothy 1:6",
  appreciation:
    "And whatever you do, work heartily, as for the Lord and not for men. — Colossians 3:23",
};

/** Which Person milestone each certificate type reads from / writes back to. */
export const MILESTONE_FIELDS: Record<
  CertificateType,
  | "baptismDate"
  | "dedicationDate"
  | "marriageDate"
  | "memberSince"
  | "confirmationDate"
  | null
> = {
  baptism: "baptismDate",
  dedication: "dedicationDate",
  marriage: "marriageDate",
  membership: "memberSince",
  confirmation: "confirmationDate",
  appreciation: null,
};

export function isCertificateType(v: string): v is CertificateType {
  return (CERTIFICATE_TYPES as readonly string[]).includes(v);
}

/** "yyyy-mm-dd" or ISO → Date (UTC midnight for date-only), else null. */
export function parseDate(value: unknown): Date | null {
  const s = String(value ?? "").trim();
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Lean document → JSON-safe DTO with string ids. */
export function shapeCertificate(
  c: CertificateDoc & { _id: unknown; createdAt?: Date; updatedAt?: Date }
) {
  return {
    ...c,
    _id: String(c._id),
    churchId: String(c.churchId),
    person: c.person ? String(c.person) : null,
    spouse: c.spouse ? String(c.spouse) : null,
    createdBy: c.createdBy ? String(c.createdBy) : null,
  };
}
