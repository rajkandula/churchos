import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

/**
 * Kids check-in — one record per child per drop-off. The security code is
 * printed on both halves of the label so the guardian can collect the child.
 */
const checkInSchema = new Schema(
  {
    churchId: {
      type: Schema.Types.ObjectId,
      ref: "Church",
      required: true,
      index: true,
    },
    // UTC midnight
    date: { type: Date, required: true },
    service: { type: Schema.Types.ObjectId, ref: "Service", default: null },
    serviceName: { type: String, trim: true, default: "" },
    person: { type: Schema.Types.ObjectId, ref: "Person", required: true },
    personName: { type: String, required: true, trim: true },
    // Computed from the person's date of birth at check-in, when known
    age: { type: Number },
    guardianName: { type: String, trim: true, default: "" },
    guardianPhone: { type: String, required: true, trim: true },
    // 4 chars A-Z0-9, unique per church + day
    securityCode: { type: String, required: true, uppercase: true, trim: true },
    room: { type: String, trim: true, default: "" },
    checkedInAt: { type: Date, required: true, default: Date.now },
    checkedOutAt: { type: Date, default: null },
    checkedInBy: { type: Schema.Types.ObjectId, ref: "User" },
    notes: { type: String, trim: true, default: "" },
    allergies: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

checkInSchema.index({ churchId: 1, date: -1 });
checkInSchema.index({ churchId: 1, date: 1, securityCode: 1 }, { unique: true });
checkInSchema.index({ churchId: 1, person: 1, date: -1 });

export type CheckInDoc = InferSchemaType<typeof checkInSchema>;

export const CheckIn: Model<CheckInDoc> =
  mongoose.models.CheckIn ?? mongoose.model("CheckIn", checkInSchema, "checkins");
