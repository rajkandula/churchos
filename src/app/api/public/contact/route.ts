import { NextRequest, NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { ContactMessage } from "@/models/ContactMessage";
import { User } from "@/models/User";
import { jsonError, readBody, withApi } from "@/lib/api-helpers";
import { CONTACT_EMAIL, isMailConfigured, sendMail, emailTemplate } from "@/lib/mail";

/** Public: a church reaching out to the ChurchOS company. */
export async function POST(req: NextRequest) {
  return withApi(async () => {
    const body = await readBody(req);
    const name = String(body.name ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const phone = String(body.phone ?? "").trim();
    const churchName = String(body.churchName ?? "").trim();
    const message = String(body.message ?? "").trim().slice(0, 2000);

    if (!name) return jsonError("Please tell us your name.");
    if (!email && !phone)
      return jsonError("Add an email or phone so we can reach you.");
    if (!message) return jsonError("Write a short message.");

    await connectDb();
    await ContactMessage.create({ name, email, phone, churchName, message });

    // Heads-up to the company inbox (CONTACT_EMAIL, else the first company
    // admin) — best-effort
    if (isMailConfigured()) {
      const to =
        CONTACT_EMAIL ||
        (await User.findOne({ role: "superadmin" }).select("email").lean())?.email ||
        "";
      if (to) {
        sendMail({
          to,
          subject: `ChurchOS enquiry from ${name}${churchName ? ` (${churchName})` : ""}`,
          text: `${name}${churchName ? `, ${churchName}` : ""}\n${email || phone}\n\n${message}`,
          html: emailTemplate({
            heading: "New enquiry",
            bodyLines: [
              `${name}${churchName ? ` — ${churchName}` : ""}`,
              email || phone,
              message,
            ],
            footerNote: "Open the Company console to reply and mark it handled.",
          }),
        }).catch((err) => console.warn("Contact notification failed:", err));
      }
    }

    return NextResponse.json({ ok: true }, { status: 201 });
  });
}
