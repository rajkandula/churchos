import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { User } from "@/models/User";
import { appOrigin, jsonError, readBody, requireSuperadmin, withApi } from "@/lib/api-helpers";
import { emailTemplate, isMailConfigured, sendMail } from "@/lib/mail";

/** Change a user's role, or approve/reject their registration. */
export async function PATCH(req: NextRequest) {
  return withApi(async () => {
    const me = await requireSuperadmin();
    const body = await readBody(req);
    const id = String(body.id ?? "");
    if (!Types.ObjectId.isValid(id)) return jsonError("User not found.", 404);

    await connectDb();
    const target = await User.findById(id).select("status").lean();
    if (!target) return jsonError("User not found.", 404);

    const update: Record<string, unknown> = {};
    if (body.role !== undefined) {
      const role = String(body.role);
      if (role !== "admin" && role !== "superadmin")
        return jsonError("Invalid role.");
      if (id === me.id && role !== "superadmin")
        return jsonError("You can't remove your own company-admin access.");
      update.role = role;
    }
    if (body.status !== undefined) {
      const status = String(body.status);
      if (!["pending", "approved", "rejected"].includes(status))
        return jsonError("Invalid status.");
      if (id === me.id) return jsonError("You can't change your own status.");
      // Approval decides a *registration*. Once a church owns the account,
      // enabling and disabling it is theirs — the console must not silently
      // undo a church's disable, or re-litigate an account already approved.
      const current = target.status ?? "approved";
      if (current !== "pending" && current !== "rejected")
        return jsonError(
          current === "disabled"
            ? "This account was disabled by its church — only the church can re-enable it."
            : "This account is already approved — its church manages it from Users & roles."
        );
      update.status = status;
    }
    if (Object.keys(update).length === 0) return jsonError("Nothing to change.");

    const user = await User.findByIdAndUpdate(id, update, { new: true }).lean();
    if (!user) return jsonError("User not found.", 404);

    // Approval email — the moment they've been waiting for
    if (update.status === "approved" && user.email && isMailConfigured()) {
      sendMail({
        to: user.email,
        subject: "Your ChurchOS account is approved",
        text: `Hi ${user.name},\n\nYour ChurchOS account for ${user.churchName ?? "your church"} has been approved. Sign in and get started.\n\n— ChurchOS`,
        html: emailTemplate({
          heading: "You're in!",
          bodyLines: [
            `Hi ${user.name},`,
            `Your ChurchOS account${user.churchName ? ` for ${user.churchName}` : ""} has been approved.`,
          ],
          ctaLabel: "Sign in to ChurchOS",
          ctaUrl: `${appOrigin(req)}/login`,
        }),
      }).catch((err) => console.warn("Approval email failed:", err));
    }

    return NextResponse.json({ ok: true });
  });
}
