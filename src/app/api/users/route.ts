import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { User } from "@/models/User";
import { Role } from "@/models/Role";
import { Church } from "@/models/Church";
import { appOrigin, jsonError, readBody, requireChurchAdmin, withApi } from "@/lib/api-helpers";
import { isValidObjectId } from "@/lib/person-fields";
import { logActivity } from "@/lib/audit";
import { emailTemplate, isMailConfigured, sendMail } from "@/lib/mail";
import { generateTempPassword } from "@/lib/temp-password";
import {
  EMAIL_MESSAGE,
  EMAIL_RE,
  EMAIL_TAKEN,
  MIN_PASSWORD_LENGTH,
  shapeUser,
  USERNAME_MESSAGE,
  USERNAME_RE,
  USERNAME_TAKEN,
} from "@/lib/users-admin";

/** Everyone who can sign in to this church — owner first, then by name. */
export async function GET() {
  return withApi(async () => {
    const user = await requireChurchAdmin();
    await connectDb();

    const [users, roles] = await Promise.all([
      User.find({ churchId: user.churchId })
        .select(
          "name username email role status isOwner churchRole lastLoginAt mustChangePassword createdAt"
        )
        .lean(),
      Role.find({ churchId: user.churchId }).select("name").lean(),
    ]);
    const roleNames = new Map(roles.map((r) => [String(r._id), r.name]));

    users.sort((a, b) => {
      if ((a.isOwner === true) !== (b.isOwner === true)) return a.isOwner ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    return NextResponse.json({
      users: users.map((u) => shapeUser(u, roleNames, user.id)),
    });
  });
}

/** Create a sign-in for someone on the team. The temporary password is
 *  returned once to the admin — it is never emailed. */
export async function POST(req: NextRequest) {
  return withApi(async () => {
    const user = await requireChurchAdmin();
    const body = await readBody(req);

    const name = String(body.name ?? "").trim();
    const username = String(body.username ?? "").trim().toLowerCase();
    const email = String(body.email ?? "").trim().toLowerCase();
    const roleId = String(body.roleId ?? "").trim();
    const givenPassword = body.password === undefined || body.password === null
      ? ""
      : String(body.password);

    if (!name) return jsonError("Please enter the person's full name.");
    if (!USERNAME_RE.test(username)) return jsonError(USERNAME_MESSAGE);
    if (!EMAIL_RE.test(email)) return jsonError(EMAIL_MESSAGE);
    if (!roleId || !isValidObjectId(roleId)) return jsonError("Please choose a role.");
    if (givenPassword && givenPassword.length < MIN_PASSWORD_LENGTH)
      return jsonError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);

    await connectDb();

    const role = await Role.findOne({ _id: roleId, churchId: user.churchId })
      .select("name")
      .lean();
    if (!role) return jsonError("Role not found.");

    const existing = await User.findOne({ $or: [{ username }, { email }] })
      .select("username")
      .lean();
    if (existing) {
      return jsonError(existing.username === username ? USERNAME_TAKEN : EMAIL_TAKEN, 409);
    }

    const church = await Church.findById(user.churchId).select("name").lean();
    const churchName = church?.name ?? user.churchName ?? "";

    const temporaryPassword = givenPassword || generateTempPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, 10);

    const created = await User.create({
      name,
      username,
      email,
      passwordHash,
      role: "admin",
      status: "approved",
      churchName,
      churchId: new Types.ObjectId(user.churchId),
      isOwner: false,
      churchRole: new Types.ObjectId(roleId),
      mustChangePassword: true,
    });

    await logActivity(user, "create", "user", `${created.name} (${created.username})`, created._id);

    if (isMailConfigured()) {
      const signInUrl = `${appOrigin(req)}/login`;
      const first = name.split(" ")[0];
      // Username and link only — the temporary password is handed over in person
      sendMail({
        to: email,
        subject: `You've been added to ${churchName || "your church"} on ChurchOS`,
        text: `Hi ${first},\n\n${user.name} added you to ${churchName || "your church"} on ChurchOS as “${role.name}”.\nUsername: ${username}\nSign in: ${signInUrl}\n\nAsk ${user.name} for your temporary password — you'll choose your own the first time you sign in.\n\n— ChurchOS`,
        html: emailTemplate({
          heading: `Welcome to ${churchName || "ChurchOS"}, ${first}!`,
          bodyLines: [
            `${user.name} added you to ${churchName || "your church"} on ChurchOS as “${role.name}”.`,
            `Your username is “${username}”.`,
            `Ask ${user.name} for your temporary password — you'll choose your own the first time you sign in.`,
          ],
          ctaLabel: "Sign in to ChurchOS",
          ctaUrl: signInUrl,
        }),
      }).catch((err) => console.warn("New user email failed:", err));
    }

    return NextResponse.json(
      {
        user: shapeUser(created.toObject(), new Map([[roleId, role.name]]), user.id),
        temporaryPassword,
      },
      { status: 201 }
    );
  });
}
