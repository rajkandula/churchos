/**
 * Announcement email renderer.
 *
 * Why it looks like 2004 HTML: email clients are not browsers. Outlook on
 * Windows renders through Word, Gmail strips <style> blocks and <head>
 * entirely on some clients, and almost nothing supports flexbox, grid or
 * external stylesheets. So every layout here is a nested
 * <table role="presentation"> with inline styles on every element, a fixed
 * 600px max width, and colours repeated as both `bgcolor` and inline
 * `background-color`. The only <style> is a tiny @media block for phones,
 * which degrades harmlessly when it is stripped.
 *
 * The header carries the CHURCH's identity, never the product's — a church
 * emailing its own congregation should look like the church. "ChurchOS" is
 * named once, in 11px muted text at the very bottom.
 *
 * Every interpolated value is escaped: the body is user input and must never
 * be able to inject markup.
 */

export type EmailBranding = {
  churchName: string;
  logoUrl?: string;
  address?: string;
  website?: string;
  pastorName?: string;
};

export type EmailTheme = "classic" | "plain" | "bold";

export type AnnouncementEmailInput = {
  title: string;
  /** Plain text with blank lines between paragraphs. */
  body: string;
  branding: EmailBranding;
  ctaLabel?: string;
  ctaUrl?: string;
  /** Overrides the default "You're receiving this because…" line. */
  footerNote?: string;
  /** Visual preset. */
  theme?: EmailTheme;
};

export const EMAIL_THEMES: { value: EmailTheme; label: string; hint: string }[] = [
  {
    value: "classic",
    label: "Classic",
    hint: "White card on a soft grey ground with an indigo accent — the default.",
  },
  {
    value: "plain",
    label: "Plain",
    hint: "Black on white, no card — reads like a typed letter from the office.",
  },
  {
    value: "bold",
    label: "Bold",
    hint: "Deep colour band with the church name reversed out, larger type.",
  },
];

type ThemeTokens = {
  pageBg: string;
  cardBg: string;
  cardBorder: string;
  topRadius: string;
  bottomRadius: string;
  /** Thin accent bar above the card (classic). */
  accentStrip: boolean;
  /** Filled header band, church name reversed out (bold). */
  bandBg: string;
  headerFg: string;
  headerAlign: "center" | "left";
  headerPad: string;
  headerFont: string;
  headerSize: string;
  headerWeight: string;
  headerSpacing: string;
  /** Hairline under the header (classic, plain). */
  headerRule: boolean;
  bodyPad: string;
  bodyFont: string;
  titleColor: string;
  titleSize: string;
  titleFont: string;
  titleWeight: string;
  textColor: string;
  textSize: string;
  textLineHeight: string;
  accent: string;
  accentText: string;
  ruleColor: string;
  footerColor: string;
  footerStrong: string;
};

const SANS =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const SERIF = "Georgia,'Times New Roman',Times,serif";

const THEMES: Record<EmailTheme, ThemeTokens> = {
  classic: {
    pageBg: "#f1f2f6",
    cardBg: "#ffffff",
    cardBorder: "#e6e8ef",
    topRadius: "16px 16px 0 0",
    bottomRadius: "0 0 16px 16px",
    accentStrip: true,
    bandBg: "",
    headerFg: "#0f172a",
    headerAlign: "center",
    headerPad: "28px 32px 20px",
    headerFont: SERIF,
    headerSize: "26px",
    headerWeight: "bold",
    headerSpacing: "-0.2px",
    headerRule: true,
    bodyPad: "28px 32px 8px",
    bodyFont: SANS,
    titleColor: "#0f172a",
    titleSize: "24px",
    titleFont: SANS,
    titleWeight: "bold",
    textColor: "#334155",
    textSize: "16px",
    textLineHeight: "1.7",
    accent: "#4f46e5",
    accentText: "#ffffff",
    ruleColor: "#e6e8ef",
    footerColor: "#94a3b8",
    footerStrong: "#475569",
  },
  plain: {
    pageBg: "#ffffff",
    cardBg: "#ffffff",
    cardBorder: "",
    topRadius: "0",
    bottomRadius: "0",
    accentStrip: false,
    bandBg: "",
    headerFg: "#111111",
    headerAlign: "left",
    headerPad: "8px 24px 14px",
    headerFont: SERIF,
    headerSize: "22px",
    headerWeight: "bold",
    headerSpacing: "0",
    headerRule: true,
    bodyPad: "22px 24px 8px",
    bodyFont: SANS,
    titleColor: "#111111",
    titleSize: "22px",
    titleFont: SANS,
    titleWeight: "bold",
    textColor: "#222222",
    textSize: "16px",
    textLineHeight: "1.75",
    accent: "#1f2937",
    accentText: "#ffffff",
    ruleColor: "#cccccc",
    footerColor: "#666666",
    footerStrong: "#333333",
  },
  bold: {
    pageBg: "#f4f3fa",
    cardBg: "#ffffff",
    cardBorder: "#e4e2f2",
    topRadius: "18px 18px 0 0",
    bottomRadius: "0 0 18px 18px",
    accentStrip: false,
    bandBg: "#312e81",
    headerFg: "#ffffff",
    headerAlign: "center",
    headerPad: "34px 32px",
    headerFont: SANS,
    headerSize: "30px",
    headerWeight: "bold",
    headerSpacing: "-0.5px",
    headerRule: false,
    bodyPad: "32px 32px 8px",
    bodyFont: SANS,
    titleColor: "#1e1b4b",
    titleSize: "30px",
    titleFont: SANS,
    titleWeight: "bold",
    textColor: "#3f3f52",
    textSize: "17px",
    textLineHeight: "1.75",
    accent: "#4338ca",
    accentText: "#ffffff",
    ruleColor: "#e4e2f2",
    footerColor: "#8b8aa3",
    footerStrong: "#4b4a63",
  },
};

function esc(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Only http(s)/mailto/tel survive; a bare domain is promoted to https. */
function safeUrl(raw?: string): string {
  const url = String(raw ?? "").trim();
  if (!url) return "";
  if (/^(https?:\/\/|mailto:|tel:)/i.test(url)) return url;
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return ""; // javascript:, data:, …
  if (/^[\w.-]+\.[a-z]{2,}([/?#].*)?$/i.test(url)) return `https://${url}`;
  return "";
}

function stripScheme(url: string): string {
  return url.replace(/^https?:\/\//i, "").replace(/\/$/, "");
}

/** Blank lines separate paragraphs; single newlines are line breaks. */
function paragraphs(body: string): string[] {
  return String(body ?? "")
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

export function renderAnnouncementEmail(input: AnnouncementEmailInput): {
  html: string;
  text: string;
} {
  const t = THEMES[input.theme ?? "classic"] ?? THEMES.classic;

  const title = String(input.title ?? "").trim();
  const paras = paragraphs(input.body ?? "");

  const churchName = String(input.branding?.churchName ?? "").trim() || "Our church";
  const logoUrl = safeUrl(input.branding?.logoUrl);
  const address = String(input.branding?.address ?? "").trim();
  const pastorName = String(input.branding?.pastorName ?? "").trim();
  const websiteUrl = safeUrl(input.branding?.website);

  const ctaLabel = String(input.ctaLabel ?? "").trim();
  const ctaUrl = safeUrl(input.ctaUrl);
  const hasCta = Boolean(ctaLabel && ctaUrl);

  const receiving =
    String(input.footerNote ?? "").trim() ||
    `You're receiving this because you're on the roll at ${churchName}.`;

  // ---------------------------------------------------------------- header
  const headerInner = logoUrl
    ? `<img src="${esc(logoUrl)}" alt="${esc(churchName)}" style="display:block;border:0;outline:none;text-decoration:none;height:auto;max-height:56px;max-width:260px;${
        t.headerAlign === "center" ? "margin:0 auto;" : ""
      }">`
    : `<span style="font-family:${t.headerFont};font-size:${t.headerSize};font-weight:${t.headerWeight};letter-spacing:${t.headerSpacing};color:${t.headerFg};line-height:1.25;">${esc(
        churchName
      )}</span>`;

  const rows: string[] = [];

  if (t.accentStrip) {
    rows.push(
      `<tr><td bgcolor="${t.accent}" style="background-color:${t.accent};border-radius:${t.topRadius};line-height:4px;font-size:4px;height:4px;">&nbsp;</td></tr>`
    );
  }

  if (t.bandBg) {
    rows.push(
      `<tr><td align="${t.headerAlign}" bgcolor="${t.bandBg}" class="co-pad" style="background-color:${t.bandBg};border-radius:${t.topRadius};padding:${t.headerPad};text-align:${t.headerAlign};">${headerInner}</td></tr>`
    );
  } else {
    const border = t.cardBorder
      ? `border-left:1px solid ${t.cardBorder};border-right:1px solid ${t.cardBorder};${
          t.accentStrip ? "" : `border-top:1px solid ${t.cardBorder};`
        }`
      : "";
    rows.push(
      `<tr><td align="${t.headerAlign}" bgcolor="${t.cardBg}" class="co-pad" style="background-color:${t.cardBg};${border}${
        t.accentStrip ? "" : `border-radius:${t.topRadius};`
      }padding:${t.headerPad};text-align:${t.headerAlign};">${headerInner}${
        t.headerRule
          ? `<div style="border-top:1px solid ${t.ruleColor};font-size:0;line-height:0;margin-top:${
              t.headerAlign === "center" ? "20px" : "14px"
            };">&nbsp;</div>`
          : ""
      }</td></tr>`
    );
  }

  // ------------------------------------------------------------------ body
  const sideBorder = t.cardBorder
    ? `border-left:1px solid ${t.cardBorder};border-right:1px solid ${t.cardBorder};`
    : "";

  const titleHtml = title
    ? `<h1 class="co-h1" style="margin:0 0 16px;font-family:${t.titleFont};font-size:${t.titleSize};font-weight:${t.titleWeight};line-height:1.3;color:${t.titleColor};">${esc(
        title
      )}</h1>`
    : "";

  const bodyHtml = paras
    .map(
      (p) =>
        `<p style="margin:0 0 16px;font-family:${t.bodyFont};font-size:${t.textSize};line-height:${t.textLineHeight};color:${t.textColor};">${esc(
          p
        ).replace(/\n/g, "<br>")}</p>`
    )
    .join("");

  const ctaHtml = hasCta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:26px 0 10px;border-collapse:separate;">
              <tr>
                <td align="center" bgcolor="${t.accent}" style="background-color:${t.accent};border-radius:10px;">
                  <a href="${esc(ctaUrl)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:14px 30px;font-family:${t.bodyFont};font-size:15px;font-weight:bold;line-height:1.2;color:${t.accentText};text-decoration:none;border-radius:10px;">${esc(
                    ctaLabel
                  )}</a>
                </td>
              </tr>
            </table>
            <p style="margin:0 0 6px;font-family:${t.bodyFont};font-size:12px;line-height:1.6;color:${t.footerColor};">Or open this link:<br><a href="${esc(
              ctaUrl
            )}" target="_blank" rel="noopener noreferrer" style="color:${t.accent};word-break:break-all;">${esc(
              ctaUrl
            )}</a></p>`
    : "";

  rows.push(
    `<tr><td bgcolor="${t.cardBg}" class="co-pad" style="background-color:${t.cardBg};${sideBorder}padding:${t.bodyPad};">${titleHtml}${bodyHtml}${ctaHtml}</td></tr>`
  );

  // ---------------------------------------------------------------- footer
  const churchLines: string[] = [
    `<div style="font-family:${t.bodyFont};font-size:13px;font-weight:bold;line-height:1.6;color:${t.footerStrong};">${esc(
      churchName
    )}</div>`,
  ];
  if (pastorName)
    churchLines.push(
      `<div style="font-family:${t.bodyFont};font-size:12px;line-height:1.6;color:${t.footerColor};">${esc(
        pastorName
      )}</div>`
    );
  if (address)
    churchLines.push(
      `<div style="font-family:${t.bodyFont};font-size:12px;line-height:1.6;color:${t.footerColor};">${esc(
        address
      ).replace(/\n/g, "<br>")}</div>`
    );
  if (websiteUrl)
    churchLines.push(
      `<div style="font-family:${t.bodyFont};font-size:12px;line-height:1.6;"><a href="${esc(
        websiteUrl
      )}" target="_blank" rel="noopener noreferrer" style="color:${t.accent};text-decoration:none;">${esc(
        stripScheme(websiteUrl)
      )}</a></div>`
    );

  rows.push(
    `<tr><td bgcolor="${t.cardBg}" class="co-pad" style="background-color:${t.cardBg};${sideBorder}${
      t.cardBorder ? `border-bottom:1px solid ${t.cardBorder};` : ""
    }border-top:1px solid ${t.ruleColor};border-radius:${t.bottomRadius};padding:20px 32px 24px;">
            ${churchLines.join("")}
            <div style="border-top:1px solid ${t.ruleColor};font-size:0;line-height:0;margin:14px 0;">&nbsp;</div>
            <p style="margin:0 0 6px;font-family:${t.bodyFont};font-size:12px;line-height:1.6;color:${t.footerColor};">${esc(
              receiving
            )}</p>
            <p style="margin:0;font-family:${t.bodyFont};font-size:11px;line-height:1.6;color:${t.footerColor};">Sent with ChurchOS</p>
          </td></tr>`
  );

  const preheader = (paras[0] ?? "").slice(0, 140);

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light only">
<title>${esc(title || churchName)}</title>
<style>
@media only screen and (max-width:620px){
  .co-wrap{padding:16px 10px !important;}
  .co-pad{padding-left:20px !important;padding-right:20px !important;}
  .co-h1{font-size:21px !important;}
}
</style>
</head>
<body style="margin:0;padding:0;width:100%;background-color:${t.pageBg};-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
<div style="display:none;max-height:0;max-width:0;opacity:0;overflow:hidden;font-size:1px;line-height:1px;color:${t.pageBg};">${esc(
    preheader
  )}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${t.pageBg}" style="width:100%;border-collapse:collapse;background-color:${t.pageBg};">
  <tr>
    <td align="center" class="co-wrap" style="padding:32px 16px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;border-collapse:collapse;">
        ${rows.join("\n        ")}
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;

  // ------------------------------------------------------------ plain text
  const textLines: string[] = [];
  if (title) {
    textLines.push(title, "");
  }
  if (paras.length) textLines.push(paras.join("\n\n"));
  if (hasCta) textLines.push("", `${ctaLabel}: ${ctaUrl}`);
  textLines.push("", "---", churchName);
  if (pastorName) textLines.push(pastorName);
  if (address) textLines.push(address.replace(/\n+/g, ", "));
  if (websiteUrl) textLines.push(websiteUrl);
  textLines.push("", receiving, "Sent with ChurchOS");

  const text = textLines.join("\n").replace(/\n{3,}/g, "\n\n").trim();

  return { html, text };
}
