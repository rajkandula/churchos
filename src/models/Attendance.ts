import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const entrySchema = new Schema(
  {
    person: { type: Schema.Types.ObjectId, ref: "Person", required: true },
    // Snapshot — the register must read the same even if the person is renamed or deleted
    personName: { type: String, required: true, trim: true },
    present: { type: Boolean, required: true, default: false },
  },
  { _id: false }
);

/**
 * One document per church + service + calendar day: the headcount for the
 * room plus a present/absent mark for each person on the roster.
 */
const attendanceSchema = new Schema(
  {
    churchId: {
      type: Schema.Types.ObjectId,
      ref: "Church",
      required: true,
      index: true,
    },
    service: { type: Schema.Types.ObjectId, ref: "Service", required: true },
    serviceName: { type: String, required: true, trim: true },
    // UTC midnight
    date: { type: Date, required: true },
    // Everyone in the room — may exceed the number of marked people
    headcount: { type: Number, default: 0, min: 0 },
    adults: { type: Number, min: 0 },
    children: { type: Number, min: 0 },
    entries: { type: [entrySchema], default: [] },
    note: { type: String, trim: true, default: "" },
    markedBy: { type: Schema.Types.ObjectId, ref: "User" },
    markedByName: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

attendanceSchema.index({ churchId: 1, service: 1, date: 1 }, { unique: true });
attendanceSchema.index({ churchId: 1, date: -1 });
attendanceSchema.index({ churchId: 1, "entries.person": 1, date: -1 });

export type AttendanceDoc = InferSchemaType<typeof attendanceSchema>;

export const Attendance: Model<AttendanceDoc> =
  mongoose.models.Attendance ??
  mongoose.model("Attendance", attendanceSchema, "attendances");
