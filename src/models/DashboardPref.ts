import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

/**
 * One person's private arrangement of the dashboard launcher — which apps
 * they show, in what order, and how roomy the tiles are.
 *
 * Per USER, not per church: two people in the same church never see each
 * other's arrangement, and this changes nothing about what they may open.
 * App keys are stored as raw strings (validated with isAppKey when read and
 * written) so a key added to the registry later can never break an old
 * document, and a key removed from it is simply ignored.
 */
const dashboardPrefSchema = new Schema(
  {
    churchId: {
      type: Schema.Types.ObjectId,
      ref: "Church",
      required: true,
      index: true,
    },
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    /** Preferred order, most-wanted first. Keys missing from it keep the
     *  registry order and are appended after. */
    order: { type: [String], default: [] },
    /** Apps this person chose to keep off their dashboard. */
    hidden: { type: [String], default: [] },
    /** "comfortable" = name + description cards, "compact" = icon tiles. */
    density: {
      type: String,
      enum: ["comfortable", "compact"],
      default: "comfortable",
    },
  },
  { timestamps: true, collection: "dashboardprefs" }
);

dashboardPrefSchema.index({ churchId: 1, user: 1 }, { unique: true });

export type DashboardPrefDoc = InferSchemaType<typeof dashboardPrefSchema>;

export const DashboardPref: Model<DashboardPrefDoc> =
  mongoose.models.DashboardPref ??
  mongoose.model("DashboardPref", dashboardPrefSchema);
