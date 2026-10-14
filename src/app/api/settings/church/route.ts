import { NextRequest, NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { Church } from "@/models/Church";
import { jsonError, readBody, requireChurch, withApi } from "@/lib/api-helpers";
import {
  ensureChurchCode,
  isLinkNameTaken,
  normalizeChurchCode,
} from "@/lib/public-church";
import { logActivity } from "@/lib/audit";

// The public link name is one URL segment: 3–40 chars, lowercase letters,
// numbers and single hyphens, never starting or ending with a hyphen.
const LINK_NAME_RE = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;
const LINK_NAME_HELP =
  "Use 3–40 characters: lowercase letters, numbers and hyphens.";

function shape(c: {
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  logoUrl?: string;
  code?: string | null;
  denomination?: string;
  pastorName?: string;
  website?: string;
  currency?: string;
}) {
  return {
    name: c.name,
    address: c.address ?? "",
    phone: c.phone ?? "",
    email: c.email ?? "",
    logoUrl: c.logoUrl ?? "",
    code: c.code ?? "",
    denomination: c.denomination ?? "",
    pastorName: c.pastorName ?? "",
    website: c.website ?? "",
    currency: c.currency ?? "INR",
  };
}

/** The church's own record — name, address, contact, public link name, currency. */
export async function GET() {
  return withApi(async () => {
    const user = await requireChurch();
    await connectDb();
    const code = await ensureChurchCode(user.churchId);
    const church = await Church.findById(user.churchId).lean();
    if (!church) return jsonError("Church not found.", 404);
    return NextResponse.json({ church: { ...shape(church), code } });
  });
}

/** The logo saves on its own, the moment it uploads — a picture the owner
 *  has already chosen should not be lost by navigating away before Save. */
export async function PATCH(req: NextRequest) {
  return withApi(async () => {
    const user = await requireChurch("settings");
    const body = await readBody(req);
    if (!("logoUrl" in body))
      return jsonError("Only the logo can be saved this way.");

    const logoUrl = String(body.logoUrl ?? "").trim();
    if (logoUrl && !/^https:\/\//.test(logoUrl))
      return jsonError("Logo must be an uploaded image.");

    await connectDb();
    const church = await Church.findByIdAndUpdate(
      user.churchId,
      { logoUrl },
      { new: true }
    ).lean();
    if (!church) return jsonError("Church not found.", 404);
    await logActivity(user, "update", "church", logoUrl ? "Church logo" : "Church logo removed");

    return NextResponse.json({ church: shape(church) });
  });
}

export async function PUT(req: NextRequest) {
  return withApi(async () => {
    const user = await requireChurch("settings");
    const body = await readBody(req);

    const name = String(body.name ?? "").trim();
    if (!name) return jsonError("Please enter the church's name.");
    const address = String(body.address ?? "").trim();
    const phone = String(body.phone ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return jsonError("Please enter a valid church email address.");
    const denomination = String(body.denomination ?? "").trim();
    const pastorName = String(body.pastorName ?? "").trim();
    const website = String(body.website ?? "").trim();
    const currency = String(body.currency ?? "INR").trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency))
      return jsonError("Currency must be a 3-letter ISO code, e.g. INR.");
    // Tidied first, so "Grace Community" and "GRACE_COMMUNITY" are both
    // accepted and stored as "grace-community".
    const newCode = normalizeChurchCode(String(body.code ?? ""));
    if (newCode && (!LINK_NAME_RE.test(newCode) || newCode.includes("--")))
      return jsonError(LINK_NAME_HELP);

    await connectDb();
    const current = await Church.findById(user.churchId).lean();
    if (!current) return jsonError("Church not found.", 404);

    const logoUrl = String(body.logoUrl ?? "").trim();
    if (logoUrl && !/^https:\/\//.test(logoUrl))
      return jsonError("Logo must be an uploaded image.");
    const update: Record<string, unknown> = {
      name,
      address,
      phone,
      email,
      logoUrl,
      denomination,
      pastorName,
      website,
      currency,
    };
    if (newCode && newCode !== (current.code ?? "")) {
      // Link names must be unique across every church, previous names
      // included — old shared links resolve by them forever.
      if (await isLinkNameTaken(newCode, user.churchId))
        return jsonError("That link name is already taken — try another.");
      update.code = newCode;
      if (current.code) update.$addToSet = { codeHistory: current.code };
    }

    const church = await Church.findByIdAndUpdate(user.churchId, update, {
      new: true,
    }).lean();
    if (!church) return jsonError("Church not found.", 404);
    await logActivity(user, "update", "church", "Church settings");

    return NextResponse.json({ church: shape(church) });
  });
}
