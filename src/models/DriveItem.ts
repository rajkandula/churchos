import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const driveItemSchema = new Schema(
  {
    churchId: {
      type: Schema.Types.ObjectId,
      ref: "Church",
      required: true,
      index: true,
    },
    type: { type: String, enum: ["folder", "file"], required: true },
    name: { type: String, required: true, trim: true },
    parent: {
      type: Schema.Types.ObjectId,
      ref: "DriveItem",
      default: null,
      index: true,
    },
    // Files only
    url: { type: String, default: "" },
    size: { type: Number, default: 0 },
    contentType: { type: String, default: "" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    createdByName: { type: String, default: "" },
  },
  { timestamps: true }
);

export type DriveItemDoc = InferSchemaType<typeof driveItemSchema>;

export const DriveItem: Model<DriveItemDoc> =
  mongoose.models.DriveItem ?? mongoose.model("DriveItem", driveItemSchema);
