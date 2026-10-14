import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

/** Mail received for the company — the company console Mailbox.
 *  Written by the inbound-mail webhook (POST /api/mail/inbound), read here. */
const replySchema = new Schema(
  {
    text: { type: String, required: true },
    sentAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const inboundEmailSchema = new Schema(
  {
    from: { type: String, required: true },
    fromName: { type: String, default: "" },
    to: { type: String, default: "" },
    subject: { type: String, default: "(no subject)" },
    text: { type: String, default: "" },
    html: { type: String, default: "" },
    read: { type: Boolean, default: false, index: true },
    replies: { type: [replySchema], default: [] },
    receivedAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

export type InboundEmailDoc = InferSchemaType<typeof inboundEmailSchema>;

export const InboundEmail: Model<InboundEmailDoc> =
  mongoose.models.InboundEmail ??
  mongoose.model("InboundEmail", inboundEmailSchema);
