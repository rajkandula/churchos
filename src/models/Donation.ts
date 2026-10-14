import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { PAYMENT_MODES } from "@/lib/constants";

/**
 * One gift received. Names are snapshotted so a receipt reads the same
 * forever, even if the person or fund is later renamed or deleted.
 */
const donationSchema = new Schema(
  {
    churchId: {
      type: Schema.Types.ObjectId,
      ref: "Church",
      required: true,
      index: true,
    },
    // Human-friendly, per-church sequential id — "R-0001"
    receiptNo: { type: String, required: true },

    // null = anonymous / cash-plate offering
    person: { type: Schema.Types.ObjectId, ref: "Person", default: null },
    personName: { type: String, trim: true, default: "Anonymous" },

    fund: { type: Schema.Types.ObjectId, ref: "Fund", required: true },
    fundName: { type: String, trim: true, default: "" },

    amount: { type: Number, required: true, min: 1 },
    mode: { type: String, enum: PAYMENT_MODES, default: "Cash" },
    date: { type: Date, required: true },
    // Cheque number, UPI reference, transaction id…
    reference: { type: String, trim: true, default: "" },
    note: { type: String, trim: true, default: "" },

    // Calendar year of `date` ("2026") — statements filter on this directly
    year: { type: String, default: "" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

// Keep `year` in step with `date` on every save
donationSchema.pre("validate", function () {
  if (this.date instanceof Date && !Number.isNaN(this.date.getTime())) {
    this.year = String(this.date.getUTCFullYear());
  }
});

donationSchema.index({ churchId: 1, receiptNo: 1 }, { unique: true });
donationSchema.index({ churchId: 1, date: -1 });
donationSchema.index({ churchId: 1, person: 1, year: 1 });
donationSchema.index({ churchId: 1, fund: 1 });

export type DonationDoc = InferSchemaType<typeof donationSchema>;

export const Donation: Model<DonationDoc> =
  mongoose.models.Donation ??
  mongoose.model("Donation", donationSchema, "donations");
