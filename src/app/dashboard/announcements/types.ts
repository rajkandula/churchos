export type AudienceType = "all" | "members" | "status" | "tag" | "group";

export const AUDIENCE_OPTIONS: { value: AudienceType; label: string; hint: string }[] = [
  { value: "all", label: "Everyone", hint: "Everyone on record except transferred and deceased" },
  { value: "members", label: "Members only", hint: "People whose status is Member" },
  { value: "status", label: "A status", hint: "Everyone with a particular status" },
  { value: "tag", label: "A tag", hint: "Everyone carrying a tag, e.g. choir" },
  { value: "group", label: "A group", hint: "Members of a small group or ministry" },
];

/** Where an announcement is in its life: a draft, waiting for its time,
 *  already out, called off, or a dispatch that broke. NOT the same thing as
 *  `status`, which is the Person status an announcement targets. */
export type AnnouncementState = "draft" | "scheduled" | "sent" | "cancelled" | "failed";

export type EmailTheme = "classic" | "plain" | "bold";

export type AnnouncementDto = {
  _id: string;
  title: string;
  body: string;
  audienceType: AudienceType;
  status?: string;
  tag?: string;
  group?: string | null;
  groupName?: string;
  channel?: string;
  recipients: number;
  sentTo: number;
  skipped: number;
  failed: number;
  sentAt?: string | null;
  sentBy?: string | null;
  sentByName?: string;
  createdAt?: string;
  updatedAt?: string;
  /** Lifecycle. Legacy rows read back as "sent". */
  state: AnnouncementState;
  /** When a scheduled announcement is due (ISO, UTC). */
  sendAt?: string | null;
  ctaLabel?: string;
  ctaUrl?: string;
  theme?: EmailTheme;
  /** Why the last dispatch failed. */
  lastError?: string;
};

export type AnnouncementOptions = {
  tags: string[];
  groups: { _id: string; name: string }[];
  statuses: { value: string; label: string; count: number }[];
};

export type AudiencePreview = {
  recipients: number;
  withEmail: number;
  withoutEmail: number;
  groupName: string;
  sample: string[];
};

export type SendResult = {
  announcement: AnnouncementDto;
  mailUnavailable?: boolean;
  warning?: string;
};

export type RenderResult = { html: string; text: string };

/** A starting point for a message — either shipped with ChurchOS (`key`)
 *  or saved by this church (`_id`). */
export type Template = {
  _id?: string;
  key?: string;
  name: string;
  description: string;
  title: string;
  body: string;
  ctaLabel?: string;
  ctaUrl?: string;
  category: string;
};

export type TemplatesResponse = { builtIn: Template[]; saved: Template[] };

export const TEMPLATE_CATEGORIES = [
  "Services",
  "Events",
  "Giving",
  "Pastoral",
  "Volunteers",
  "General",
] as const;

/** The three history tabs. */
export type HistoryTab = "sent" | "scheduled" | "drafts";

export const HISTORY_TABS: { value: HistoryTab; label: string }[] = [
  { value: "sent", label: "Sent" },
  { value: "scheduled", label: "Scheduled" },
  { value: "drafts", label: "Drafts" },
];

/** Which tab a row belongs in. Cancelled and failed sit with the scheduled
 *  ones — they are all "meant to go out, hasn't happened". */
export function tabFor(state: AnnouncementState): HistoryTab {
  if (state === "draft") return "drafts";
  if (state === "sent") return "sent";
  return "scheduled";
}

/** Human label for a saved announcement's audience. */
export function audienceLabel(
  a: Pick<AnnouncementDto, "audienceType" | "status" | "tag" | "groupName">,
  statusLabels: Record<string, string>
): string {
  switch (a.audienceType) {
    case "members":
      return "Members only";
    case "status":
      return statusLabels[a.status ?? ""] ?? a.status ?? "A status";
    case "tag":
      return `Tag: ${a.tag ?? ""}`;
    case "group":
      return a.groupName ? `Group: ${a.groupName}` : "A group";
    default:
      return "Everyone";
  }
}

/** "" is fine (no button). Anything else must be a real http(s) link. */
export function isValidLinkUrl(value: string): boolean {
  const v = value.trim();
  if (!v) return true;
  try {
    const url = new URL(v);
    return (url.protocol === "http:" || url.protocol === "https:") && Boolean(url.hostname);
  } catch {
    return false;
  }
}

/** A Date as the local-time string an <input type="datetime-local"> wants. */
export function toDateTimeLocalInput(value: Date | string): string {
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

/** Tomorrow at 9:00 AM, local. Call this from an event handler, never from a
 *  render path — it depends on the viewer's clock and timezone. */
export function defaultScheduleValue(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return toDateTimeLocalInput(d);
}

/** "Tuesday 9 September at 9:00 am" */
export function describeSendTime(value: Date | string): string {
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "";
  const day = d.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const time = d.toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  return `${day} at ${time}`;
}

/** "in 3 days" / "2 hours ago" — a rough, friendly distance from now. */
export function relativeToNow(value: Date | string): string {
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "";
  const diff = d.getTime() - Date.now();
  const ahead = diff >= 0;
  const mins = Math.round(Math.abs(diff) / 60000);
  const say = (n: number, unit: string) =>
    `${ahead ? "in " : ""}${n} ${unit}${n === 1 ? "" : "s"}${ahead ? "" : " ago"}`;
  if (mins < 1) return ahead ? "any moment now" : "just now";
  if (mins < 60) return say(mins, "minute");
  const hours = Math.round(mins / 60);
  if (hours < 24) return say(hours, "hour");
  const days = Math.round(hours / 24);
  if (days < 31) return say(days, "day");
  return say(Math.round(days / 30), "month");
}

export const STATE_LABELS: Record<AnnouncementState, string> = {
  draft: "Draft",
  scheduled: "Scheduled",
  sent: "Sent",
  cancelled: "Cancelled",
  failed: "Failed",
};
