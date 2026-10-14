/**
 * One-time migration for the roles feature. Safe to re-run.
 *   node scripts/migrate-roles.mjs
 *
 * For every church:
 *   1. give it an owner (full access) — the earliest usable account,
 *      preferring one that is approved over one that is rejected/disabled;
 *   2. seed the starter roles if it has none;
 *   3. put every remaining approved user who has no role on "Church admin",
 *      so nobody is left signed in with zero apps.
 *
 * The app-key and starter-role lists are copies of src/lib/apps.ts and
 * DEFAULT_ROLES in src/models/Role.ts — keep them in step.
 */
import mongoose from "mongoose";
import { existsSync, readFileSync } from "node:fs";

const APP_KEYS = [
  "people",
  "connect",
  "giving",
  "attendance",
  "groups",
  "events",
  "services",
  "announcements",
  "certificates",
  "staff",
  "drive",
  "analytics",
  "activity",
  "recycle",
  "settings",
  "users",
];

const SYSTEM_ROLE_NAME = "Church admin";

const DEFAULT_ROLES = [
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

/** Legacy accounts have no status at all — they behave as approved. */
const isApproved = (u) => !u.status || u.status === "approved";

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
await mongoose.connect(env.MONGODB_URI);
const db = mongoose.connection.db;
const churches = await db.collection("churches").find().project({ name: 1 }).toArray();

let promoted = 0;
let seeded = 0;
let assigned = 0;

for (const c of churches) {
  const members = await db
    .collection("users")
    .find({ churchId: c._id })
    .sort({ createdAt: 1 })
    .toArray();
  if (members.length === 0) continue;

  // ── 1. Owner ────────────────────────────────────────────────
  let owner = members.find((u) => u.isOwner === true);
  if (!owner) {
    // The earliest account anyone can actually sign in to. Handing the church
    // to a rejected or disabled user would strand everybody behind them.
    owner = members.find(isApproved);
    if (!owner) {
      owner = members[0];
      console.warn(
        `⚠ ${c.name}: no approved user — owner → ${owner.name} (${owner.username}, status "${owner.status ?? "none"}"). Approve or re-point this account.`
      );
    }
    await db.collection("users").updateOne({ _id: owner._id }, { $set: { isOwner: true } });
    console.log(`${c.name}: owner → ${owner.name} (${owner.username})`);
    promoted++;
  }

  // ── 2. Starter roles ────────────────────────────────────────
  const roleCount = await db.collection("roles").countDocuments({ churchId: c._id });
  if (roleCount === 0) {
    const now = new Date();
    await db.collection("roles").insertMany(
      DEFAULT_ROLES.map((r) => ({
        churchId: c._id,
        name: r.name,
        description: r.description,
        apps: r.apps,
        system: r.system === true,
        createdBy: owner._id,
        createdAt: now,
        updatedAt: now,
      })),
      { ordered: false }
    );
    console.log(`${c.name}: seeded ${DEFAULT_ROLES.length} starter roles`);
    seeded++;
  }

  // ── 3. Nobody left with zero apps ───────────────────────────
  const systemRole = await db
    .collection("roles")
    .findOne({ churchId: c._id, system: true });
  if (!systemRole) {
    console.warn(`⚠ ${c.name}: no system "${SYSTEM_ROLE_NAME}" role — skipped role assignment`);
    continue;
  }
  const stranded = members.filter(
    (u) => String(u._id) !== String(owner._id) && isApproved(u) && !u.churchRole
  );
  if (stranded.length) {
    await db
      .collection("users")
      .updateMany(
        { _id: { $in: stranded.map((u) => u._id) } },
        { $set: { churchRole: systemRole._id } }
      );
    console.log(
      `${c.name}: ${stranded.length} user(s) → "${systemRole.name}" (${stranded.map((u) => u.username).join(", ")})`
    );
    assigned += stranded.length;
  }
}

await db.collection("users").updateMany({ isOwner: { $exists: false } }, { $set: { isOwner: false } });
await db.collection("users").updateMany({ churchRole: { $exists: false } }, { $set: { churchRole: null } });
await db
  .collection("users")
  .updateMany({ sessionVersion: { $exists: false } }, { $set: { sessionVersion: 0 } });
console.log(
  `done — ${promoted} owner(s) set, ${seeded} church(es) seeded, ${assigned} user(s) given a role across ${churches.length} church(es)`
);
await mongoose.disconnect();
