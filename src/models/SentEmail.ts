import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

/** Outgoing mail from the company mailbox (composes and replies). */
const sentEmailSchema = new Schema(
  {
    to: { type: String, required: true },
    subject: { type: String, required: true },
    text: { type: String, default: "" },
    kind: { type: String, enum: ["compose", "reply"], default: "compose" },
    sentAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

export type SentEmailDoc = InferSchemaType<typeof sentEmailSchema>;

export const SentEmail: Model<SentEmailDoc> =
  mongoose.models.SentEmail ?? mongoose.model("SentEmail", sentEmailSchema);
