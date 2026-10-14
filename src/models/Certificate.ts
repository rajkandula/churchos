import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { CERTIFICATE_TYPES } from "@/lib/certificates";

export {
  CERTIFICATE_TYPES,
  CERTIFICATE_LABELS,
  DEFAULT_VERSES,
  type CertificateType,
} from "@/lib/certificates";

/**
 * Everything printed on the certificate is frozen here at issue time, so a
 * reprint years later reads exactly as the original — even if the person,
 * the pastor or the church letterhead has since changed.
 */
const snapshotSchema = new Schema(
  {
    personName: { type: String, trim: true, default: "" },
    memberNo: { type: String, trim: true, default: "" },
    dob: { type: Date, default: null },
    gender: { type: String, trim: true, default: "" },
    // Person has no parent fields — entered on the form
    fatherName: { type: String, trim: true, default: "" },
    motherName: { type: String, trim: true, default: "" },
    spouseName: { type: String, trim: true, default: "" },
    // Baptism / dedication / marriage / membership / confirmation date
    eventDate: { type: Date, default: null },
    place: { type: String, trim: true, default: "" },
    officiant: { type: String, trim: true, default: "" },
    witnesses: { type: String, trim: true, default: "" },
    // Scripture reference / quotation
    verse: { type: String, trim: true, default: "" },
    remark: { type: String, trim: true, default: "" },
    // Letterhead
    churchName: { type: String, trim: true, default: "" },
    churchAddress: { type: String, trim: true, default: "" },
    logoUrl: { type: String, default: "" },
    pastorName: { type: String, trim: true, default: "" },
  },
  { _id: false }
);

const certificateSchema = new Schema(
  {
    churchId: {
      type: Schema.Types.ObjectId,
      ref: "Church",
      required: true,
      index: true,
    },
    // Human-friendly, per-church sequential id — "C-0001"
    serialNo: { type: String, required: true },
    type: { type: String, enum: CERTIFICATE_TYPES, required: true },
    person: { type: Schema.Types.ObjectId, ref: "Person", required: true },
    // Marriage certificates only
    spouse: { type: Schema.Types.ObjectId, ref: "Person", default: null },
    data: { type: snapshotSchema, required: true },
    issuedAt: { type: Date, default: Date.now },
    issuedBy: { type: String, trim: true, default: "" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

certificateSchema.index({ churchId: 1, serialNo: 1 }, { unique: true });
certificateSchema.index({ churchId: 1, person: 1 });
certificateSchema.index({ churchId: 1, issuedAt: -1 });

export type CertificateDoc = InferSchemaType<typeof certificateSchema>;

export const Certificate: Model<CertificateDoc> =
  mongoose.models.Certificate ??
  mongoose.model("Certificate", certificateSchema, "certificates");
