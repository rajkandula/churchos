import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

/** One tenant — every record in the app belongs to exactly one church. */
const churchSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    // Public link name, e.g. "grace-community-church" — the last part of this
    // church's public URLs (/connect/<code>, /register/<code>/<event>). Not an
    // official church code: it is derived from the name the first time a public
    // link is needed and the owner can rename it in settings.
    code: { type: String, unique: true, sparse: true },
    // Previous link names — every link ever shared stays valid forever.
    codeHistory: { type: [String], default: [] },
    logoUrl: { type: String, default: "" },
    denomination: { type: String, trim: true, default: "" },
    pastorName: { type: String, trim: true, default: "" },
    address: { type: String, trim: true, default: "" },
    phone: { type: String, trim: true, default: "" },
    email: { type: String, trim: true, lowercase: true, default: "" },
    website: { type: String, trim: true, default: "" },
    // ISO 4217 — drives every amount shown in Giving
    currency: { type: String, trim: true, uppercase: true, default: "INR" },
  },
  { timestamps: true }
);

export type ChurchDoc = InferSchemaType<typeof churchSchema>;

export const Church: Model<ChurchDoc> =
  mongoose.models.Church ?? mongoose.model("Church", churchSchema);
