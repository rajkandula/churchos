import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

/**
 * A church's own reusable announcement — "the one we send every Christmas".
 * Built-in starters live in src/lib/announcement-templates.ts and are never
 * stored here; this collection is only what a church saved itself.
 */
const announcementTemplateSchema = new Schema(
  {
    churchId: {
      type: Schema.Types.ObjectId,
      ref: "Church",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: "" },
    title: { type: String, trim: true, default: "" },
    body: { type: String, default: "" },
    ctaLabel: { type: String, trim: true, default: "" },
    ctaUrl: { type: String, trim: true, default: "" },
    category: { type: String, trim: true, default: "Custom" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

announcementTemplateSchema.index({ churchId: 1, name: 1 }, { unique: true });

export type AnnouncementTemplateDoc = InferSchemaType<
  typeof announcementTemplateSchema
>;

export const AnnouncementTemplate: Model<AnnouncementTemplateDoc> =
  mongoose.models.AnnouncementTemplate ??
  mongoose.model(
    "AnnouncementTemplate",
    announcementTemplateSchema,
    "announcementtemplates"
  );
