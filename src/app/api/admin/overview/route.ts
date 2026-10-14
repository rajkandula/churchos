import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { User } from "@/models/User";
import { Person } from "@/models/Person";
import { DriveItem } from "@/models/DriveItem";
import { ContactMessage } from "@/models/ContactMessage";
import { Church } from "@/models/Church";
import { requireSuperadmin, withApi } from "@/lib/api-helpers";
import { currentYear } from "@/lib/seq";
import mongoose from "mongoose";

/** Everything the company console shows in one call. */
export async function GET() {
  return withApi(async () => {
    await requireSuperadmin();
    await connectDb();

    const year = currentYear();
    const db = mongoose.connection.db!;
    // Other apps' collections may not exist yet — read them loosely.
    const count = (name: string, filter: Record<string, unknown> = {}) =>
      db.collection(name).countDocuments(filter).catch(() => 0);
    const yearStart = new Date(`${year}-01-01T00:00:00Z`);

    const [users, people, members, driveFiles, donations, groups, events, newMessages] =
      await Promise.all([
        User.find().sort({ createdAt: 1 }).lean(),
        Person.countDocuments(),
        Person.countDocuments({ status: "member" }),
        DriveItem.countDocuments({ type: "file" }),
        count("donations", { date: { $gte: yearStart } }),
        count("groups"),
        count("events"),
        ContactMessage.countDocuments({ status: "new" }),
      ]);

    // Per-church rollups for the console's churches table
    const [churchDocs, peopleAgg, givingAgg] = await Promise.all([
      Church.find().sort({ createdAt: 1 }).lean(),
      Person.aggregate([{ $group: { _id: "$churchId", n: { $sum: 1 } } }]),
      db
        .collection("donations")
        .aggregate([
          { $match: { date: { $gte: yearStart } } },
          { $group: { _id: "$churchId", total: { $sum: "$amount" } } },
        ])
        .toArray()
        .catch(() => [] as { _id: unknown; total: number }[]),
    ]);
    const byId = (rows: { _id: unknown }[], field: "n" | "total") =>
      new Map(
        rows.map((r) => [String(r._id), (r as Record<string, number>)[field] ?? 0])
      );
    const peopleMap = byId(peopleAgg, "n");
    const givingMap = byId(givingAgg as { _id: unknown }[], "total");

    const churches = churchDocs.map((c) => ({
      churchName: c.name,
      churchCode: c.code ?? "",
      currency: c.currency ?? "INR",
      admins: users.filter((u) => String(u.churchId ?? "") === String(c._id)).length,
      people: peopleMap.get(String(c._id)) ?? 0,
      givingTotal: givingMap.get(String(c._id)) ?? 0,
      createdAt: c.createdAt ?? null,
    }));

    return NextResponse.json({
      year,
      stats: {
        churches: churches.length,
        users: users.length,
        people,
        members,
        driveFiles,
        donations,
        groups,
        events,
        newMessages,
        pendingApprovals: users.filter((u) => u.status === "pending").length,
      },
      churches,
      users: users.map((u) => ({
        _id: String(u._id),
        name: u.name,
        username: u.username,
        email: u.email,
        role: u.role,
        status: u.status ?? "approved",
        churchName: u.churchName ?? "",
        createdAt: u.createdAt,
      })),
    });
  });
}
