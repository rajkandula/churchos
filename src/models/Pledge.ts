import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

export const PLEDGE_FREQUENCIES = ["one-time", "weekly", "monthly", "yearly"] as const;
export const PLEDGE_STATUSES = ["active", "fulfilled", "cancelled"] as const;

/** A promise to give — progress is measured against actual donations. */
const pledgeSchema = new Schema(
  {
    churchId: {
      type: Schema.Types.ObjectId,
      ref: "Church",
      required: true,
      index: true,
    },
    person: { type: Schema.Types.ObjectId, ref: "Person", required: true },
    personName: { type: String, trim: true, default: "" },
    fund: { type: Schema.Types.ObjectId, ref: "Fund", default: null },
    fundName: { type: String, trim: true, default: "" },
    // Total promised over the whole pledge period
    amount: { type: Number, required: true, min: 1 },
    frequency: { type: String, enum: PLEDGE_FREQUENCIES, default: "one-time" },
    startDate: { type: Date },
    endDate: { type: Date },
    note: { type: String, trim: true, default: "" },
    status: { type: String, enum: PLEDGE_STATUSES, default: "active" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

pledgeSchema.index({ churchId: 1, person: 1 });
pledgeSchema.index({ churchId: 1, status: 1 });

export type PledgeDoc = InferSchemaType<typeof pledgeSchema>;

export const Pledge: Model<PledgeDoc> =
  mongoose.models.Pledge ?? mongoose.model("Pledge", pledgeSchema, "pledges");
