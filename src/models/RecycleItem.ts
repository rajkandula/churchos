import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

/** A deleted record, kept whole so it can be restored from the Recycle Bin. */
const recycleItemSchema = new Schema(
  {
    churchId: {
      type: Schema.Types.ObjectId,
      ref: "Church",
      required: true,
      index: true,
    },
    itemType: { type: String, required: true },
    label: { type: String, required: true },
    // The original document, exactly as it was (including _id)
    data: { type: Schema.Types.Mixed, required: true },
    // Cascade-deleted dependents, e.g. an exam's marks: { collection, docs }
    related: { type: Schema.Types.Mixed, default: null },
    deletedBy: {
      id: { type: String, default: "" },
      name: { type: String, default: "" },
    },
    deletedAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

export type RecycleItemDoc = InferSchemaType<typeof recycleItemSchema>;

export const RecycleItem: Model<RecycleItemDoc> =
  mongoose.models.RecycleItem ??
  mongoose.model("RecycleItem", recycleItemSchema);
