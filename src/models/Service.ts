import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { DAYS_OF_WEEK } from "@/lib/constants";

/**
 * A recurring gathering type — Sunday Service, Midweek, Sunday School…
 * Attendance and check-ins are recorded against one of these per day.
 */
const serviceSchema = new Schema(
  {
    churchId: {
      type: Schema.Types.ObjectId,
      ref: "Church",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    dayOfWeek: { type: String, enum: [...DAYS_OF_WEEK, ""], default: "" },
    // "HH:MM" 24h
    time: { type: String, trim: true, default: "" },
    location: { type: String, trim: true, default: "" },
    active: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

serviceSchema.index({ churchId: 1, name: 1 }, { unique: true });

export type ServiceDoc = InferSchemaType<typeof serviceSchema>;

export const Service: Model<ServiceDoc> =
  mongoose.models.Service ?? mongoose.model("Service", serviceSchema, "services");
