import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const contactMessageSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true, default: "" },
    phone: { type: String, trim: true, default: "" },
    churchName: { type: String, trim: true, default: "" },
    message: { type: String, required: true, trim: true },
    status: { type: String, enum: ["new", "handled"], default: "new" },
  },
  { timestamps: true }
);

export type ContactMessageDoc = InferSchemaType<typeof contactMessageSchema>;

export const ContactMessage: Model<ContactMessageDoc> =
  mongoose.models.ContactMessage ??
  mongoose.model("ContactMessage", contactMessageSchema);
