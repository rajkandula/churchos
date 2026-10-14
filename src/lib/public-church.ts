import { randomBytes } from "node:crypto";
import { Church } from "@/models/Church";
import { withSeqRetry } from "@/lib/seq";

/** A public link name is one URL segment — at most this many characters. */
const MAX_LINK_NAME = 40;

/** Unguessable lowercase slug for public links (events, connect cards). */
export function randomCode(length = 10): string {
  return randomBytes(12)
    .toString("base64url")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, length)
    .toLowerCase();
}

/** A church's name as a readable URL segment —
 *  "Grace Community Church" → "grace-community-church", "St. Mark's" → "st-mark-s". */
export function slugifyChurchName(name: string): string {
  const slug = (name ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_LINK_NAME)
    .replace(/-+$/g, "");
  // A name with no Latin letters at all (or an empty one) still needs a link.
  return slug || "church";
}

/** Everything normalising does except tidying hyphens — used for lookups, so a
 *  legacy code that happened to contain doubled hyphens still resolves. */
function linkNameBase(value: string): string {
  return (value ?? "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

/** Tidy what an owner typed into a link name: "Grace Community" and
 *  "GRACE_COMMUNITY" both become "grace-community". */
export function normalizeChurchCode(value: string): string {
  return linkNameBase(value)
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Anchored, case-insensitive match on a literal link name — every code ever
 *  issued (including the old uppercase "RC-949" style) must keep resolving. */
function anchoredCi(value: string): RegExp {
  return new RegExp(`^${value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");
}

/** Is this link name already spoken for? Checks current and previous names of
 *  every other church — old links resolve by both, so both must stay unique. */
export async function isLinkNameTaken(
  name: string,
  exceptChurchId?: string
): Promise<boolean> {
  const re = anchoredCi(name);
  const filter: Record<string, unknown> = { $or: [{ code: re }, { codeHistory: re }] };
  if (exceptChurchId) filter._id = { $ne: exceptChurchId };
  return Boolean(await Church.exists(filter));
}

/** base, then base-2, base-3 … until nothing else owns it. */
async function freeLinkName(base: string, churchId: string): Promise<string> {
  for (let n = 1; n <= 50; n++) {
    const suffix = n === 1 ? "" : `-${n}`;
    const stem = base.slice(0, MAX_LINK_NAME - suffix.length).replace(/-+$/g, "");
    const candidate = `${stem}${suffix}`;
    if (!(await isLinkNameTaken(candidate, churchId))) return candidate;
  }
  const stem = base.slice(0, MAX_LINK_NAME - 5).replace(/-+$/g, "");
  return `${stem}-${randomCode(4)}`;
}

/** The church's public link name (e.g. "grace-community-church") — derived from
 *  its name the first time a public link is needed, editable in settings. */
export async function ensureChurchCode(churchId: string): Promise<string> {
  const church = await Church.findById(churchId);
  if (!church) throw new Error("Church not found.");
  if (church.code) return church.code;

  const base = slugifyChurchName(church.name ?? "");
  const saved = await withSeqRetry(async () => {
    church.code = await freeLinkName(base, churchId);
    await church.save();
    return church.code;
  });
  if (!saved) throw new Error("Could not allocate a public link name.");
  return saved;
}

/** Resolve a public link name to its church, ignoring case, spaces and
 *  underscores. Also matches previous names, so every link ever shared —
 *  including the old uppercase codes like "RC-949" — keeps working. */
export async function findChurchByCode(code: string) {
  const candidates = [
    ...new Set([linkNameBase(code), normalizeChurchCode(code)].filter(Boolean)),
  ];
  if (candidates.length === 0) return null;
  const or = candidates.flatMap((c) => {
    const re = anchoredCi(c);
    return [{ code: re }, { codeHistory: re }];
  });
  return Church.findOne({ $or: or }).lean();
}
