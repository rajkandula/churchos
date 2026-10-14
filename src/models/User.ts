import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    username: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: { type: String, required: true },
    // Platform role: "admin" (a church user) or "superadmin" (company console)
    role: { type: String, default: "admin" },
    // New church registrations wait for company-admin approval; users a
    // church owner adds are approved immediately; "disabled" blocks sign-in.
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "disabled"],
      default: "pending",
    },
    churchName: { type: String, trim: true, default: "" },
    churchId: {
      type: Schema.Types.ObjectId,
      ref: "Church",
      default: null,
      index: true,
    },
    // The person who registered the church — always has every app and can
    // manage users and roles, regardless of churchRole.
    isOwner: { type: Boolean, default: false },
    // Which apps this user can open (see Role). Null = no apps until assigned.
    churchRole: {
      type: Schema.Types.ObjectId,
      ref: "Role",
      default: null,
      index: true,
    },
    // Set when the owner creates the account with a temporary password
    mustChangePassword: { type: Boolean, default: false },
    // Bumped whenever the password changes or the account is disabled —
    // every session token carries this number, so older tokens stop working.
    sessionVersion: { type: Number, default: 0 },
    // Failed sign-ins since the last good one, and the time-bounded lockout
    // they earn. Both are cleared by a successful sign-in.
    failedLoginCount: { type: Number, default: 0 },
    lockedUntil: { type: Date, default: null },
    lastLoginAt: { type: Date, default: null },
    resetTokenHash: { type: String, default: null },
    resetTokenExpires: { type: Date, default: null },
  },
  { timestamps: true }
);

export type UserDoc = InferSchemaType<typeof userSchema>;

export const User: Model<UserDoc> =
  mongoose.models.User ?? mongoose.model("User", userSchema);
