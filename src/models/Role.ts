import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { APP_KEYS } from "@/lib/apps";

/**
 * A named bundle of app permissions, created by the church owner — e.g.
 * "Finance team" → Giving + People, or "Welcome desk" → Connect + Attendance.
 * The built-in "Church admin" role (system: true) always has every app.
 */
const roleSchema = new Schema(
  {
    churchId: {
      type: Schema.Types.ObjectId,
      ref: "Church",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: "" },
    // App keys from src/lib/apps.ts this role can open
    apps: { type: [{ type: String, enum: APP_KEYS }], default: [] },
    // Built-in full-access role — cannot be deleted or have apps removed
    system: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

roleSchema.index({ churchId: 1, name: 1 }, { unique: true });

export type RoleDoc = InferSchemaType<typeof roleSchema>;

export const Role: Model<RoleDoc> =
  mongoose.models.Role ?? mongoose.model("Role", roleSchema);

export const SYSTEM_ROLE_NAME = "Church admin";

/** Sensible starter roles a church can rename, reshape or delete. */
export const DEFAULT_ROLES: { name: string; description: string; apps: string[]; system?: boolean }[] = [
  {
    name: SYSTEM_ROLE_NAME,
    description: "Full access to every app, settings and user management.",
    apps: [...APP_KEYS],
    system: true,
  },
  {
    name: "Pastoral team",
    description: "People, visitors, groups, announcements and certificates.",
    apps: ["people", "connect", "groups", "announcements", "certificates", "events", "analytics"],
  },
  {
    name: "Finance",
    description: "Giving, receipts, pledges and statements.",
    apps: ["giving", "analytics"],
  },
  {
    name: "Welcome desk",
    description: "Sunday check-in, attendance and visitor cards.",
    apps: ["attendance", "connect", "people"],
  },
  {
    name: "Worship & volunteers",
    description: "Service planning, teams and event logistics.",
    apps: ["services", "events", "groups"],
  },
];
