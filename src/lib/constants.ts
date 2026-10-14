/** Shared vocab — every app reads its enums from here. */

export const GENDER_OPTIONS = ["Male", "Female", "Other"] as const;

export const MARITAL_STATUSES = ["Single", "Married", "Widowed", "Divorced"] as const;

export const HOUSEHOLD_ROLES = ["head", "spouse", "child", "other"] as const;
export const HOUSEHOLD_ROLE_LABELS: Record<string, string> = {
  head: "Head",
  spouse: "Spouse",
  child: "Child",
  other: "Other",
};

/** Where someone stands with the church — the People app's main filter. */
export const PERSON_STATUSES = [
  "visitor",
  "regular",
  "member",
  "inactive",
  "transferred",
  "deceased",
] as const;
export type PersonStatus = (typeof PERSON_STATUSES)[number];

export const PERSON_STATUS_LABELS: Record<PersonStatus, string> = {
  visitor: "Visitor",
  regular: "Regular attender",
  member: "Member",
  inactive: "Inactive",
  transferred: "Transferred",
  deceased: "Deceased",
};

export const SOURCE_OPTIONS = [
  "Invited by a friend",
  "Walk-in",
  "Website",
  "Social media",
  "Event / outreach",
  "Transferred from another church",
  "Born into the church",
  "Other",
] as const;

/** How money comes in — Giving records one of these per donation. */
export const PAYMENT_MODES = [
  "Cash",
  "UPI",
  "Card",
  "Cheque",
  "Bank transfer",
  "Online",
] as const;

/** Common gathering names — churches can add their own in Attendance. */
export const DEFAULT_SERVICES = [
  "Sunday Service",
  "Midweek Service",
  "Prayer Meeting",
  "Youth Meeting",
  "Sunday School",
] as const;

export const DEFAULT_FUNDS = [
  { name: "General Fund", description: "Tithes and regular offerings" },
  { name: "Building Fund", description: "Construction and facilities" },
  { name: "Missions", description: "Outreach and mission support" },
  { name: "Benevolence", description: "Helping families in need" },
] as const;

export const DAYS_OF_WEEK = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;
