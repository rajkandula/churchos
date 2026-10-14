import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import {
  REGISTRATION_SOURCES,
  REGISTRATION_STATUSES,
} from "@/app/dashboard/events/types";

/**
 * One signup for an event. `person` links to People when the registrant is
 * known; public signups start unlinked and can be converted with one click.
 * name/phone/email are snapshots so the list reads the same forever.
 */
const registrationSchema = new Schema(
  {
    churchId: {
      type: Schema.Types.ObjectId,
      ref: "Church",
      required: true,
      index: true,
    },
    event: { type: Schema.Types.ObjectId, ref: "Event", required: true },
    person: { type: Schema.Types.ObjectId, ref: "Person", default: null },
    name: { type: String, required: true, trim: true },
    phone: { type: String, trim: true, default: "" },
    email: { type: String, trim: true, lowercase: true, default: "" },
    // Extra people coming along — counts against capacity
    guests: { type: Number, default: 0, min: 0 },
    notes: { type: String, trim: true, default: "" },
    status: {
      type: String,
      enum: REGISTRATION_STATUSES,
      default: "registered",
      index: true,
    },
    source: { type: String, enum: REGISTRATION_SOURCES, default: "admin" },
    registeredAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

registrationSchema.index({ churchId: 1, event: 1 });
// Duplicate public signups (same event + phone/email) are rejected in the
// route so a cancelled signup can register again.
registrationSchema.index({ event: 1, phone: 1 });
registrationSchema.index({ event: 1, email: 1 });

export type RegistrationDoc = InferSchemaType<typeof registrationSchema>;

export const Registration: Model<RegistrationDoc> =
  mongoose.models.Registration ??
  mongoose.model("Registration", registrationSchema, "registrations");
