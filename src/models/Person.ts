import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import {
  GENDER_OPTIONS,
  HOUSEHOLD_ROLES,
  MARITAL_STATUSES,
  PERSON_STATUSES,
} from "@/lib/constants";

const documentSchema = new Schema(
  {
    name: { type: String, required: true },
    url: { type: String, required: true },
  },
  { _id: false }
);

/**
 * The master record — one document per person the church knows: members,
 * regular attenders, first-time visitors, children. Every other app
 * (Giving, Attendance, Groups, Certificates…) references this by _id.
 */
const personSchema = new Schema(
  {
    churchId: {
      type: Schema.Types.ObjectId,
      ref: "Church",
      required: true,
      index: true,
    },
    // Human-friendly, per-church sequential id — "P-0001"
    memberNo: { type: String, required: true },

    // Identity
    name: { type: String, required: true, trim: true },
    gender: { type: String, enum: [...GENDER_OPTIONS, ""], default: "" },
    dob: { type: Date },
    maritalStatus: { type: String, enum: [...MARITAL_STATUSES, ""], default: "" },
    bloodGroup: { type: String, trim: true, default: "" },
    occupation: { type: String, trim: true, default: "" },
    photoUrl: { type: String, default: "" },

    // Contact
    phone: { type: String, trim: true, default: "", index: true },
    altPhone: { type: String, trim: true, default: "" },
    email: { type: String, trim: true, lowercase: true, default: "" },
    address: { type: String, trim: true, default: "" },
    city: { type: String, trim: true, default: "" },
    state: { type: String, trim: true, default: "" },
    pincode: { type: String, trim: true, default: "" },

    // Household
    household: {
      type: Schema.Types.ObjectId,
      ref: "Household",
      default: null,
      index: true,
    },
    householdRole: {
      type: String,
      enum: [...HOUSEHOLD_ROLES, ""],
      default: "",
    },

    // Membership
    status: {
      type: String,
      enum: PERSON_STATUSES,
      default: "visitor",
      index: true,
    },
    memberSince: { type: Date },
    firstVisit: { type: Date },
    // How they found the church — referral, walk-in, online, event…
    source: { type: String, trim: true, default: "" },

    // Milestones (sacramental records) — Certificates read from here
    baptismDate: { type: Date },
    baptismPlace: { type: String, trim: true, default: "" },
    confirmationDate: { type: Date },
    marriageDate: { type: Date },
    dedicationDate: { type: Date },

    // Free-form labels — "choir", "youth", "usher", "needs follow-up"
    tags: { type: [String], default: [] },

    documents: { type: [documentSchema], default: [] },
    notes: { type: String, trim: true, default: "" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

personSchema.index({ churchId: 1, memberNo: 1 }, { unique: true });
personSchema.index({ churchId: 1, name: 1 });
personSchema.index({ churchId: 1, tags: 1 });

export type PersonDoc = InferSchemaType<typeof personSchema>;

export const Person: Model<PersonDoc> =
  mongoose.models.Person ?? mongoose.model("Person", personSchema, "people");
