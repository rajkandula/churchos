import { isHarakumoConfigured, sendViaHarakumo } from "@/lib/harakumo";

/**
 * Transactional email, sent through Harakumo Mail (`./harakumo.ts`, one
 * `HARAKUMO_API_KEY`). Without the key every send fails with a clear
 * "unavailable" error and callers degrade gracefully (`isMailConfigured`).
 *
 * Server-side only: never import this from a client component.
 */

/** The display name system mail carries (MAIL_FROM_NAME overrides it). */
export const MAIL_FROM_NAME = process.env.MAIL_FROM_NAME || "ChurchOS";

/**
 * Optional sender address on one of your verified sending domains. Empty
 * sends from the mail service's default no-reply address.
 */
export const MAIL_FROM = process.env.MAIL_FROM || "";

/**
 * The company inbox: contact-form notifications go here, and company-console
 * mail asks for replies here. Empty by default, so a fresh install never
 * mails anyone you did not configure.
 */
export const CONTACT_EMAIL = process.env.CONTACT_EMAIL || "";

export function isMailConfigured(): boolean {
  return isHarakumoConfigured();
}

/** Send one email. Throws a user-presentable Error on failure. */
export async function sendMail({
  to,
  subject,
  text,
  html,
  fromName,
  replyTo,
}: {
  to: string;
  subject: string;
  text: string;
  html?: string;
  /** Override the display name (defaults to MAIL_FROM_NAME). */
  fromName?: string;
  /** Where replies should go, e.g. CONTACT_EMAIL for company-console mail. */
  replyTo?: string;
}): Promise<void> {
  if (!isMailConfigured()) {
    console.error("Mail is not configured (HARAKUMO_API_KEY) — email not sent:", {
      to,
      subject,
    });
    throw new Error(
      "Email sending is not set up on this server yet. Ask your administrator to configure mail."
    );
  }
  try {
    await sendViaHarakumo({
      to,
      subject,
      text,
      ...(html ? { html } : {}),
      fromName: fromName || MAIL_FROM_NAME,
      ...(MAIL_FROM ? { from: MAIL_FROM } : {}),
      ...(replyTo ? { replyTo } : {}),
    });
  } catch (err) {
    console.error("Email send failed:", err);
    throw new Error("Could not send the email. Please try again in a moment.");
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * ChurchOS-branded HTML email (inline styles — email-client safe).
 *
 * This is the shell for SYSTEM mail only: password resets, welcome and
 * invitation mail — messages the product itself sends, where the ChurchOS
 * header is correct. Announcements go out under the church's own branding
 * via `renderAnnouncementEmail` in src/lib/email-render.ts; do not use this
 * template for congregation-facing mail.
 */
export function emailTemplate({
  heading,
  bodyLines,
  ctaLabel,
  ctaUrl,
  footerNote,
}: {
  heading: string;
  bodyLines: string[];
  ctaLabel?: string;
  ctaUrl?: string;
  footerNote?: string;
}): string {
  const paragraphs = bodyLines
    .map(
      (line) =>
        `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#334155;">${escapeHtml(line)}</p>`
    )
    .join("");

  const cta =
    ctaLabel && ctaUrl
      ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;"><tr><td style="border-radius:12px;background:#4f46e5;">
           <a href="${ctaUrl}" style="display:inline-block;padding:13px 32px;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:12px;">${escapeHtml(ctaLabel)}</a>
         </td></tr></table>
         <p style="margin:0 0 14px;font-size:12px;line-height:1.6;color:#94a3b8;">If the button doesn't work, copy and paste this link:<br><a href="${ctaUrl}" style="color:#4f46e5;word-break:break-all;">${ctaUrl}</a></p>`
      : "";

  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background-color:#f6f7fb;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f6f7fb;padding:32px 16px;">
      <tr><td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
          <tr>
            <td style="background-color:#4f46e5;border-radius:16px 16px 0 0;padding:24px 32px;">
              <span style="font-family:Arial,Helvetica,sans-serif;font-size:20px;font-weight:bold;color:#ffffff;letter-spacing:-0.3px;">Church<span style="color:#c7d2fe;">OS</span></span>
            </td>
          </tr>
          <tr>
            <td style="background-color:#ffffff;border-radius:0 0 16px 16px;padding:32px;font-family:Arial,Helvetica,sans-serif;">
              <h1 style="margin:0 0 18px;font-size:20px;line-height:1.4;color:#0f172a;">${escapeHtml(heading)}</h1>
              ${paragraphs}
              ${cta}
              <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0 16px;">
              <p style="margin:0;font-size:12px;line-height:1.6;color:#94a3b8;">${escapeHtml(footerNote ?? "Sent by ChurchOS — church management software.")}</p>
            </td>
          </tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}
