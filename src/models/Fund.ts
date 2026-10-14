import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

/** A designated purpose money is given to — General, Building, Missions… */
const fundSchema = new Schema(
  {
    churchId: {
      type: Schema.Types.ObjectId,
      ref: "Church",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: "" },
    // Inactive funds stay on old receipts but disappear from the pickers
    active: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

fundSchema.index({ churchId: 1, name: 1 }, { unique: true });

export type FundDoc = InferSchemaType<typeof fundSchema>;

export const Fund: Model<FundDoc> =
  mongoose.models.Fund ?? mongoose.model("Fund", fundSchema, "funds");
