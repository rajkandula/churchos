import { NextRequest, NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { ConnectCard } from "@/models/ConnectCard";
import { jsonError, readBody, withApi } from "@/lib/api-helpers";
import { findChurchByCode } from "@/lib/public-church";
import { EMAIL_RE, PHONE_RE, pickInterests } from "@/lib/connect-fields";
import { SOURCE_OPTIONS } from "@/lib/constants";
import {
  AGE_GROUPS,
  INTEREST_OPTIONS,
  type AgeGroup,
} from "@/app/dashboard/connect/types";

type Params = { params: Promise<{ church: string }> };

/** Public: who the visitor is filling the card in for. */
export async function GET(_req: NextRequest, { params }: Params) {
  return withApi(async () => {
    const { church: code } = await params;
    await connectDb();
    const church = await findChurchByCode(code);
    if (!church) return jsonError("We couldn't find that church.", 404);
    return NextResponse.json({
      church: { name: church.name, logoUrl: church.logoUrl ?? "" },
      interests: [...INTEREST_OPTIONS],
    });
  });
}

/** Public: a visitor submits a connect card. No sign-in required. */
export async function POST(req: NextRequest, { params }: Params) {
  return withApi(async () => {
    const { church: code } = await params;
    const body = await readBody(req);

    const name = String(body.name ?? "").trim().slice(0, 120);
    if (!name) return jsonError("Please tell us your name.");
    const phone = String(body.phone ?? "").trim();
    if (phone && !PHONE_RE.test(phone))
      return jsonError("Please enter a valid phone number.");
    const email = String(body.email ?? "").trim().toLowerCase().slice(0, 160);
    if (email && !EMAIL_RE.test(email))
      return jsonError("Please enter a valid email address.");
    if (!phone && !email)
      return jsonError("Add a phone number or email so we can say hello.");

    const howHeard = String(body.howHeard ?? "").trim();
    if (howHeard && !(SOURCE_OPTIONS as readonly string[]).includes(howHeard))
      return jsonError("Please pick an option for how you heard about us.");
    const ageGroup = String(body.ageGroup ?? "").trim();
    if (ageGroup && !(AGE_GROUPS as readonly string[]).includes(ageGroup))
      return jsonError("Please pick an age group.");
    const interests = pickInterests(body.interests);
    const prayerRequest = String(body.prayerRequest ?? "").trim().slice(0, 2000);
    const firstTime = body.firstTime === undefined ? true : Boolean(body.firstTime);

    await connectDb();
    const church = await findChurchByCode(code);
    if (!church) return jsonError("We couldn't find that church.", 404);

    // Double-tap / refresh guard: the same name + phone in the last 10 minutes
    const since = new Date(Date.now() - 10 * 60 * 1000);
    const dupFilter: Record<string, unknown> = {
      churchId: church._id,
      name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"),
      createdAt: { $gte: since },
    };
    if (phone) dupFilter.phone = phone;
    else dupFilter.email = email;
    const dup = await ConnectCard.exists(dupFilter);
    if (dup)
      return jsonError(
        "Looks like we already have your card — thank you! We'll be in touch.",
        409
      );

    await ConnectCard.create({
      churchId: church._id,
      name,
      phone,
      email,
      visitDate: new Date(),
      firstTime,
      howHeard,
      interests,
      prayerRequest,
      ageGroup: ageGroup as AgeGroup | "",
      status: "new",
      source: "public",
    });

    return NextResponse.json({ ok: true }, { status: 201 });
  });
}
