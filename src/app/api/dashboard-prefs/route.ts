import { NextRequest, NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { DashboardPref } from "@/models/DashboardPref";
import { jsonError, readBody, requireChurch, withApi } from "@/lib/api-helpers";
import { APP_KEYS, isAppKey } from "@/lib/apps";
import {
  DEFAULT_PREFS,
  isDensity,
  normalizePrefs,
  type Density,
} from "@/app/dashboard/dashboard-prefs";

/**
 * How one person arranged their own dashboard. Guarded by requireChurch()
 * with NO app key: every signed-in church member arranges their own
 * launcher, whatever their role. Nothing here is church data, so there is
 * no activity log and no recycle bin — a reset just deletes the document.
 */

/** Keep known app keys only, de-duplicated, never longer than the registry. */
function parseKeys(value: unknown[]): string[] {
  const out: string[] = [];
  for (const item of value) {
    if (!isAppKey(item) || out.includes(item)) continue;
    out.push(item);
    if (out.length >= APP_KEYS.length) break;
  }
  return out;
}

export async function GET() {
  return withApi(async () => {
    const user = await requireChurch();
    await connectDb();
    // A read never creates a document — most people never open the panel.
    const doc = await DashboardPref.findOne({
      churchId: user.churchId,
      user: user.id,
    })
      .select("order hidden density")
      .lean();
    return NextResponse.json({ prefs: normalizePrefs(doc) });
  });
}

export async function PUT(req: NextRequest) {
  return withApi(async () => {
    const user = await requireChurch();
    const body = await readBody(req);

    const update: { order?: string[]; hidden?: string[]; density?: Density } = {};
    if (body.order !== undefined) {
      if (!Array.isArray(body.order))
        return jsonError("Send the app order as a list of app keys.");
      update.order = parseKeys(body.order);
    }
    if (body.hidden !== undefined) {
      if (!Array.isArray(body.hidden))
        return jsonError("Send the hidden apps as a list of app keys.");
      update.hidden = parseKeys(body.hidden);
    }
    if (body.density !== undefined) {
      if (!isDensity(body.density))
        return jsonError("Choose either the comfortable or the compact layout.");
      update.density = body.density;
    }

    await connectDb();
    const doc = await DashboardPref.findOneAndUpdate(
      { churchId: user.churchId, user: user.id },
      Object.keys(update).length
        ? { $set: update }
        : { $setOnInsert: { density: DEFAULT_PREFS.density } },
      { returnDocument: "after", upsert: true, setDefaultsOnInsert: true }
    )
      .select("order hidden density")
      .lean();
    return NextResponse.json({ prefs: normalizePrefs(doc) });
  });
}

/** "Reset to default" — drop the document and fall back to registry order. */
export async function DELETE() {
  return withApi(async () => {
    const user = await requireChurch();
    await connectDb();
    await DashboardPref.deleteOne({ churchId: user.churchId, user: user.id });
    return NextResponse.json({ prefs: { ...DEFAULT_PREFS } });
  });
}
