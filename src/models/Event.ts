import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { EVENT_STATUSES } from "@/app/dashboard/events/types";

/**
 * A gathering people can sign up for — conference, camp, outreach, dinner.
 * Registrations hang off this; the publicSlug makes the no-login signup link.
 */
const eventSchema = new Schema(
  {
    churchId: {
      type: Schema.Types.ObjectId,
      ref: "Church",
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: "" },
    startAt: { type: Date, required: true },
    endAt: { type: Date, default: null },
    venue: { type: String, trim: true, default: "" },
    // Storage bucket image URL
    coverUrl: { type: String, default: "" },
    // null = unlimited
    capacity: { type: Number, default: null, min: 0 },
    registrationOpen: { type: Boolean, default: true },
    // Display only — no payment processing
    fee: { type: Number, default: 0, min: 0 },
    // Unguessable code in the public link: /register/<church code>/<slug>
    publicSlug: { type: String, unique: true, sparse: true },
    status: {
      type: String,
      enum: EVENT_STATUSES,
      default: "published",
      index: true,
    },
    organizer: { type: Schema.Types.ObjectId, ref: "Person", default: null },
    organizerName: { type: String, trim: true, default: "" },
    tags: { type: [String], default: [] },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

eventSchema.index({ churchId: 1, startAt: -1 });

export type EventDoc = InferSchemaType<typeof eventSchema>;

export const Event: Model<EventDoc> =
  mongoose.models.Event ?? mongoose.model("Event", eventSchema, "events");
