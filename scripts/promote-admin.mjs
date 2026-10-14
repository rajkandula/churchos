/**
 * Approve an account and make it a company admin (superadmin).
 *   node scripts/promote-admin.mjs <username-or-email>
 */
import mongoose from "mongoose";
import { existsSync, readFileSync } from "node:fs";

// MONGODB_URI comes from the environment, or else from .env.local
const env = {
  ...(existsSync(".env.local")
    ? Object.fromEntries(
        readFileSync(".env.local", "utf8")
          .split("\n")
          .filter((l) => l.includes("=") && !l.startsWith("#"))
          .map((l) => {
            const i = l.indexOf("=");
            return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^(["'])(.*)\1$/, "$2")];
          })
      )
    : {}),
  ...process.env,
};
if (!env.MONGODB_URI) {
  console.error("MONGODB_URI is not set (export it, or add it to .env.local)");
  process.exit(1);
}
const who = String(process.argv[2] ?? "").trim().toLowerCase();
if (!who) {
  console.error("usage: node scripts/promote-admin.mjs <username-or-email>");
  process.exit(1);
}
await mongoose.connect(env.MONGODB_URI);
const users = mongoose.connection.db.collection("users");
const before = await users.findOne({ $or: [{ username: who }, { email: who }] });
if (!before) {
  console.error(`no account matches "${who}"`);
  await mongoose.disconnect();
  process.exit(1);
}
await users.updateOne(
  { _id: before._id },
  { $set: { role: "superadmin", status: "approved", updatedAt: new Date() } }
);
const after = await users.findOne({ _id: before._id });
console.log(`${after.name} (${after.username}, ${after.email}) — church "${after.churchName}"`);
console.log(`role: ${before.role} → ${after.role}   status: ${before.status} → ${after.status}`);
await mongoose.disconnect();
