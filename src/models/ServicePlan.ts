import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import {
  ITEM_TYPES,
  PLAN_STATUSES,
  VOLUNTEER_STATUSES,
} from "@/app/dashboard/services/types";

/** One line of the order of service — a song, the sermon, the offering… */
const itemSchema = new Schema(
  {
    order: { type: Number, default: 0 },
    type: { type: String, enum: ITEM_TYPES, default: "other" },
    title: { type: String, required: true, trim: true },
    // Key / arrangement, scripture reference, cue notes
    detail: { type: String, trim: true, default: "" },
    owner: { type: Schema.Types.ObjectId, ref: "Person", default: null },
    ownerName: { type: String, trim: true, default: "" },
    durationMin: { type: Number, default: 0, min: 0 },
  },
  { _id: true }
);

/** A volunteer slot — a role on a team, filled (or not yet) by a person. */
const volunteerSchema = new Schema(
  {
    team: { type: Schema.Types.ObjectId, ref: "Team", required: true },
    teamName: { type: String, trim: true, default: "" },
    role: { type: String, trim: true, default: "" },
    person: { type: Schema.Types.ObjectId, ref: "Person", default: null },
    personName: { type: String, trim: true, default: "" },
    status: { type: String, enum: VOLUNTEER_STATUSES, default: "scheduled" },
  },
  { _id: true }
);

/** One planned gathering — its running order plus who is serving. */
const servicePlanSchema = new Schema(
  {
    churchId: {
      type: Schema.Types.ObjectId,
      ref: "Church",
      required: true,
      index: true,
    },
    date: { type: Date, required: true },
    title: { type: String, trim: true, default: "Sunday Service" },
    theme: { type: String, trim: true, default: "" },
    scripture: { type: String, trim: true, default: "" },
    preacher: { type: Schema.Types.ObjectId, ref: "Person", default: null },
    preacherName: { type: String, trim: true, default: "" },
    notes: { type: String, trim: true, default: "" },
    items: { type: [itemSchema], default: [] },
    volunteers: { type: [volunteerSchema], default: [] },
    status: { type: String, enum: PLAN_STATUSES, default: "draft" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

servicePlanSchema.index({ churchId: 1, date: -1 });

export type ServicePlanDoc = InferSchemaType<typeof servicePlanSchema>;

export const ServicePlan: Model<ServicePlanDoc> =
  mongoose.models.ServicePlan ??
  mongoose.model("ServicePlan", servicePlanSchema, "serviceplans");
