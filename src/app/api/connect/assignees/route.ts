import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { User } from "@/models/User";
import { requireChurch, withApi } from "@/lib/api-helpers";

/** Approved users of this church — who a card can be assigned to. */
export async function GET() {
  return withApi(async () => {
    const user = await requireChurch("connect");
    await connectDb();
    const users = await User.find({ churchId: user.churchId, status: "approved" })
      .select("name")
      .sort({ name: 1 })
      .lean();
    return NextResponse.json({
      assignees: users.map((u) => ({ _id: String(u._id), name: u.name })),
    });
  });
}
