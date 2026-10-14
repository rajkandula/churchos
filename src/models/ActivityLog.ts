import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

/** One entry per change anywhere in the church's apps — who, what, when. */
const activityLogSchema = new Schema(
  {
    churchId: {
      type: Schema.Types.ObjectId,
      ref: "Church",
      required: true,
      index: true,
    },
    userId: { type: Schema.Types.ObjectId, ref: "User" },
    userName: { type: String, default: "" },
    action: {
      type: String,
      enum: ["create", "update", "delete", "restore"],
      required: true,
    },
    itemType: { type: String, required: true },
    itemId: { type: String, default: "" },
    label: { type: String, required: true },
  },
  { timestamps: true }
);

activityLogSchema.index({ churchId: 1, createdAt: -1 });

export type ActivityLogDoc = InferSchemaType<typeof activityLogSchema>;

export const ActivityLog: Model<ActivityLogDoc> =
  mongoose.models.ActivityLog ??
  mongoose.model("ActivityLog", activityLogSchema);
