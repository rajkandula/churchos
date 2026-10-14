import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

/** A family / home unit — people share an address and a mailing identity. */
const householdSchema = new Schema(
  {
    churchId: {
      type: Schema.Types.ObjectId,
      ref: "Church",
      required: true,
      index: true,
    },
    // e.g. "The Thomas family"
    name: { type: String, required: true, trim: true },
    head: { type: Schema.Types.ObjectId, ref: "Person", default: null },
    phone: { type: String, trim: true, default: "" },
    email: { type: String, trim: true, lowercase: true, default: "" },
    address: { type: String, trim: true, default: "" },
    city: { type: String, trim: true, default: "" },
    state: { type: String, trim: true, default: "" },
    pincode: { type: String, trim: true, default: "" },
    // Weddings, dedications, "moved to the city in 2019"…
    anniversary: { type: Date },
    notes: { type: String, trim: true, default: "" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

householdSchema.index({ churchId: 1, name: 1 });

export type HouseholdDoc = InferSchemaType<typeof householdSchema>;

export const Household: Model<HouseholdDoc> =
  mongoose.models.Household ?? mongoose.model("Household", householdSchema);
