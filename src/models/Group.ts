import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { DAYS_OF_WEEK } from "@/lib/constants";
import { GROUP_FREQUENCIES, GROUP_TYPES } from "@/app/dashboard/groups/types";

const coLeaderSchema = new Schema(
  {
    person: { type: Schema.Types.ObjectId, ref: "Person", required: true },
    personName: { type: String, trim: true, default: "" },
  },
  { _id: false }
);

const memberSchema = new Schema(
  {
    person: { type: Schema.Types.ObjectId, ref: "Person", required: true },
    // Snapshot — still readable after the Person record is deleted
    personName: { type: String, trim: true, default: "" },
    role: { type: String, trim: true, default: "member" },
    joinedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

/** Simple meeting log — who turned up on a given date. */
const meetingSchema = new Schema(
  {
    date: { type: Date, required: true },
    present: { type: [Schema.Types.ObjectId], default: [] },
    note: { type: String, trim: true, default: "" },
  },
  { _id: true }
);

/**
 * A small group, ministry, serving team or class — a named set of people
 * with a leader and (usually) a regular meeting slot.
 */
const groupSchema = new Schema(
  {
    churchId: {
      type: Schema.Types.ObjectId,
      ref: "Church",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: GROUP_TYPES, default: "small-group" },
    description: { type: String, trim: true, default: "" },

    leader: { type: Schema.Types.ObjectId, ref: "Person", default: null },
    leaderName: { type: String, trim: true, default: "" },
    coLeaders: { type: [coLeaderSchema], default: [] },

    // Meeting slot
    meetingDay: { type: String, enum: [...DAYS_OF_WEEK, ""], default: "" },
    // "HH:MM" 24h
    meetingTime: { type: String, trim: true, default: "" },
    frequency: { type: String, enum: GROUP_FREQUENCIES, default: "weekly" },
    location: { type: String, trim: true, default: "" },

    members: { type: [memberSchema], default: [] },
    capacity: { type: Number, default: null },
    // Accepting new members
    open: { type: Boolean, default: true },
    tags: { type: [String], default: [] },
    active: { type: Boolean, default: true },

    meetings: { type: [meetingSchema], default: [] },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

groupSchema.index({ churchId: 1, name: 1 }, { unique: true });
groupSchema.index({ churchId: 1, "members.person": 1 });

export type GroupDoc = InferSchemaType<typeof groupSchema>;

export const Group: Model<GroupDoc> =
  mongoose.models.Group ?? mongoose.model("Group", groupSchema, "groups");
