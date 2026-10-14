/**
 * Churches don't have codes — they have a readable public link name. This turns
 * every invented code ("RC-949", "GCC-101") into a slug of the church's name
 * ("riverside-chapel", "grace-community-church"). Safe to re-run.
 *   node scripts/migrate-link-names.mjs
 *
 * For every church whose `code` isn't already a link name:
 *   1. slugify its name, resolving collisions with -2, -3 …;
 *   2. push the OLD code into `codeHistory` (never lose it — every link ever
 *      shared resolves by the history too);
 *   3. save the new code.
 *
 * slugifyChurchName / normalizeChurchCode below are copies of the ones in
 * src/lib/public-church.ts (a .mjs script can't import TypeScript) — keep them
 * in step, including the 40-character limit and the link-name pattern.
 */
import mongoose from "mongoose";
import { existsSync, readFileSync } from "node:fs";

const MAX_LINK_NAME = 40;
const LINK_NAME_RE = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;

/** "Grace Community Church" → "grace-community-church" */
function slugifyChurchName(name) {
  const slug = (name ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_LINK_NAME)
    .replace(/-+$/g, "");
  return slug || "church";
}

/** The shape the app used to generate: initials + three digits, e.g. "rc-949",
 *  "gcc-101". Lowercase, so it passes LINK_NAME_RE — but it is exactly the
 *  invented code this migration exists to replace, so upgrade it too. */
const LEGACY_GENERATED_RE = /^[a-z]{1,4}-\d{3}$/;

/** Already a readable link name? Then this church has nothing to migrate. */
function isLinkName(code) {
  return (
    typeof code === "string" &&
    LINK_NAME_RE.test(code) &&
    !code.includes("--") &&
    !LEGACY_GENERATED_RE.test(code)
  );
}

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
const churches = await db
  .collection("churches")
  .find()
  .project({ name: 1, code: 1, codeHistory: 1 })
  .toArray();

/** Anchored + case-insensitive: "grace" must not collide with a legacy "GRACE". */
function anchoredCi(value) {
  return new RegExp(`^${value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");
}

/** Free across every other church's current AND previous link names. */
async function isTaken(candidate, exceptId) {
  const re = anchoredCi(candidate);
  const clash = await db
    .collection("churches")
    .findOne({ _id: { $ne: exceptId }, $or: [{ code: re }, { codeHistory: re }] });
  return Boolean(clash);
}

async function freeLinkName(base, exceptId) {
  for (let n = 1; n <= 50; n++) {
    const suffix = n === 1 ? "" : `-${n}`;
    const stem = base.slice(0, MAX_LINK_NAME - suffix.length).replace(/-+$/g, "");
    const candidate = `${stem}${suffix}`;
    if (!(await isTaken(candidate, exceptId))) return candidate;
  }
  return null;
}

let renamed = 0;
let skipped = 0;
for (const c of churches) {
  const old = typeof c.code === "string" ? c.code : "";
  if (isLinkName(old)) {
    skipped++;
    continue;
  }
  const linkName = await freeLinkName(slugifyChurchName(c.name), c._id);
  if (!linkName) {
    console.warn(`⚠ ${c.name}: could not find a free link name — left as "${old || "(none)"}"`);
    continue;
  }
  const update = { $set: { code: linkName } };
  // The old code stays valid forever — /connect/RC-949 must never 404.
  if (old && old !== linkName) update.$addToSet = { codeHistory: old };
  await db.collection("churches").updateOne({ _id: c._id }, update);
  console.log(`${c.name}: ${old || "(none)"} → ${linkName}`);
  renamed++;
}

await db
  .collection("churches")
  .updateMany({ codeHistory: { $exists: false } }, { $set: { codeHistory: [] } });
console.log(
  `done — ${renamed} church(es) renamed, ${skipped} already had a link name, ${churches.length} total`
);
await mongoose.disconnect();
