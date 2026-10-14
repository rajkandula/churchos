import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import {
  AGE_GROUPS,
  CARD_SOURCES,
  CONNECT_STATUSES,
  FOLLOW_UP_METHODS,
} from "@/app/dashboard/connect/types";

/** One touch-point with a visitor — a call, a text, a home visit… */
const followUpSchema = new Schema(
  {
    at: { type: Date, default: Date.now },
    by: { type: String, trim: true, default: "" },
    method: { type: String, enum: FOLLOW_UP_METHODS, required: true },
    note: { type: String, trim: true, default: "" },
  },
  { _id: true }
);

/**
 * A first-time visitor card — filled in by the visitor on the public link
 * (QR code at the door) or typed in by staff. It moves through the
 * follow-up pipeline and can be converted into a Person.
 */
const connectCardSchema = new Schema(
  {
    churchId: {
      type: Schema.Types.ObjectId,
      ref: "Church",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    phone: { type: String, trim: true, default: "" },
    email: { type: String, trim: true, lowercase: true, default: "" },
    visitDate: { type: Date, default: Date.now },
    firstTime: { type: Boolean, default: true },
    // One of SOURCE_OPTIONS in src/lib/constants.ts
    howHeard: { type: String, trim: true, default: "" },
    interests: { type: [String], default: [] },
    prayerRequest: { type: String, trim: true, default: "" },
    ageGroup: { type: String, enum: [...AGE_GROUPS, ""], default: "" },
    address: { type: String, trim: true, default: "" },
    city: { type: String, trim: true, default: "" },

    status: { type: String, enum: CONNECT_STATUSES, default: "new" },
    assignedTo: { type: Schema.Types.ObjectId, ref: "User", default: null },
    // Snapshot so the card reads the same even if the user is renamed/removed
    assignedToName: { type: String, trim: true, default: "" },
    followUps: { type: [followUpSchema], default: [] },

    // Set once the card is converted into a People record
    linkedPerson: { type: Schema.Types.ObjectId, ref: "Person", default: null },
    source: { type: String, enum: CARD_SOURCES, default: "admin" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

connectCardSchema.index({ churchId: 1, status: 1, visitDate: -1 });
connectCardSchema.index({ churchId: 1, assignedTo: 1 });

export type ConnectCardDoc = InferSchemaType<typeof connectCardSchema>;

export const ConnectCard: Model<ConnectCardDoc> =
  mongoose.models.ConnectCard ??
  mongoose.model("ConnectCard", connectCardSchema, "connectcards");
