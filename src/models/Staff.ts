import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { EMPLOYMENT_TYPES, STAFF_STATUSES } from "@/app/dashboard/staff/types";

const documentSchema = new Schema(
  {
    name: { type: String, required: true },
    url: { type: String, required: true },
  },
  { _id: false }
);

const emergencyContactSchema = new Schema(
  {
    name: { type: String, trim: true, default: "" },
    phone: { type: String, trim: true, default: "" },
    relation: { type: String, trim: true, default: "" },
  },
  { _id: false }
);

/**
 * Pastors, staff and ministry leaders — the church's team roster. Optionally
 * linked to a People record; contact details are snapshotted here so the
 * roster reads the same even if the person's profile changes.
 */
const staffSchema = new Schema(
  {
    churchId: {
      type: Schema.Types.ObjectId,
      ref: "Church",
      required: true,
      index: true,
    },
    // Human-friendly, per-church sequential id — "S-0001"
    staffNo: { type: String, required: true },

    name: { type: String, required: true, trim: true },
    // Role
    title: { type: String, trim: true, default: "" },
    ministry: { type: String, trim: true, default: "" },
    employmentType: {
      type: String,
      enum: EMPLOYMENT_TYPES,
      default: "full-time",
    },
    joinDate: { type: Date },
    leaveDate: { type: Date, default: null },
    status: { type: String, enum: STAFF_STATUSES, default: "active" },
    ordinationDate: { type: Date },
    qualifications: { type: String, trim: true, default: "" },

    // Contact
    phone: { type: String, trim: true, default: "" },
    email: { type: String, trim: true, lowercase: true, default: "" },
    photoUrl: { type: String, default: "" },
    address: { type: String, trim: true, default: "" },
    emergencyContact: { type: emergencyContactSchema, default: () => ({}) },

    // Link to their People record, if they have one
    person: { type: Schema.Types.ObjectId, ref: "Person", default: null },

    documents: { type: [documentSchema], default: [] },
    notes: { type: String, trim: true, default: "" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

staffSchema.index({ churchId: 1, staffNo: 1 }, { unique: true });
staffSchema.index({ churchId: 1, status: 1, name: 1 });

export type StaffDoc = InferSchemaType<typeof staffSchema>;

export const Staff: Model<StaffDoc> =
  mongoose.models.Staff ?? mongoose.model("Staff", staffSchema, "staffs");
