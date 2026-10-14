import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const memberSchema = new Schema(
  {
    person: { type: Schema.Types.ObjectId, ref: "Person", required: true },
    personName: { type: String, trim: true, default: "" },
    // Which of the team's roles this member can fill — ["Vocals", "Keys"]
    roles: { type: [String], default: [] },
  },
  { _id: false }
);

/**
 * A serving team — Worship, Ushers, Media, Kids… Each team defines the
 * roles it schedules people into on a service plan.
 */
const teamSchema = new Schema(
  {
    churchId: {
      type: Schema.Types.ObjectId,
      ref: "Church",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: "" },
    roles: { type: [String], default: [] },
    leader: { type: Schema.Types.ObjectId, ref: "Person", default: null },
    leaderName: { type: String, trim: true, default: "" },
    members: { type: [memberSchema], default: [] },
    active: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

teamSchema.index({ churchId: 1, name: 1 }, { unique: true });

export type TeamDoc = InferSchemaType<typeof teamSchema>;

export const Team: Model<TeamDoc> =
  mongoose.models.Team ?? mongoose.model("Team", teamSchema, "teams");
