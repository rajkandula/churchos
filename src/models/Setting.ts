import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

/** Generic per-church settings store — one document per setting key. */
const settingSchema = new Schema(
  {
    churchId: {
      type: Schema.Types.ObjectId,
      ref: "Church",
      required: true,
      index: true,
    },
    key: { type: String, required: true },
    value: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

settingSchema.index({ churchId: 1, key: 1 }, { unique: true });

export type SettingDoc = InferSchemaType<typeof settingSchema>;

export const Setting: Model<SettingDoc> =
  mongoose.models.Setting ?? mongoose.model("Setting", settingSchema);
