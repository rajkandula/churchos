import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

export const AUDIENCE_TYPES = ["all", "members", "status", "tag", "group"] as const;
export type AudienceType = (typeof AUDIENCE_TYPES)[number];

/** Where an announcement is in its life: composed → scheduled → delivered. */
export const ANNOUNCEMENT_STATES = [
  "draft",
  "scheduled",
  "sent",
  "cancelled",
  "failed",
] as const;
export type AnnouncementState = (typeof ANNOUNCEMENT_STATES)[number];

/**
 * One broadcast — an email sent to a slice of the church directory.
 * Counts are snapshotted at send time so history reads the same forever.
 */
const announcementSchema = new Schema(
  {
    churchId: {
      type: Schema.Types.ObjectId,
      ref: "Church",
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true },
    // Plain text with line breaks; blank lines separate paragraphs.
    // Not required: a draft may be saved with nothing but a title.
    body: { type: String, default: "" },

    // Who it went to
    audienceType: { type: String, enum: AUDIENCE_TYPES, default: "all" },
    status: { type: String, trim: true, default: "" }, // when audienceType is "status"
    tag: { type: String, trim: true, default: "" },
    group: { type: Schema.Types.ObjectId, ref: "Group", default: null },
    groupName: { type: String, trim: true, default: "" },

    channel: { type: String, default: "email" },

    // Lifecycle. Rows written before drafts existed have no `state`, so the
    // default is "sent" — they are all delivered history.
    // (Not to be confused with `status` above, which is an audience filter.)
    state: { type: String, enum: ANNOUNCEMENT_STATES, default: "sent" },
    // When a scheduled announcement is due (stored UTC)
    sendAt: { type: Date, default: null },
    // Claim marker: set the moment a dispatch starts so two cron ticks
    // cannot both send the same announcement.
    dispatchStartedAt: { type: Date, default: null },
    // Why the last dispatch failed, in words the office can read
    lastError: { type: String, default: "" },

    // Presentation
    ctaLabel: { type: String, trim: true, default: "" },
    ctaUrl: { type: String, trim: true, default: "" },
    theme: { type: String, default: "classic" },

    // Delivery counts
    recipients: { type: Number, default: 0 }, // people matched
    sentTo: { type: Number, default: 0 }, // emails actually sent
    skipped: { type: Number, default: 0 }, // no email address
    failed: { type: Number, default: 0 },

    sentAt: { type: Date },
    sentBy: { type: Schema.Types.ObjectId, ref: "User" },
    sentByName: { type: String, trim: true, default: "" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

announcementSchema.index({ churchId: 1, createdAt: -1 });
// The scheduler's read: everything due, per church and (for the cron) across all
announcementSchema.index({ churchId: 1, state: 1, sendAt: 1 });
announcementSchema.index({ state: 1, sendAt: 1 });

export type AnnouncementDoc = InferSchemaType<typeof announcementSchema>;

export const Announcement: Model<AnnouncementDoc> =
  mongoose.models.Announcement ??
  mongoose.model("Announcement", announcementSchema, "announcements");
