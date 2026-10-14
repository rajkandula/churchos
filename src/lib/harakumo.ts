/**
 * Harakumo Mail — the transport for every email ChurchOS sends (password
 * resets, approvals, invitations, announcements, company-console mail).
 * Turn on Mail for your Harakumo project and add your own domain there to
 * send from it; until then mail goes out from Harakumo's shared sender.
 *
 * The API key is server-side only. Never import this from a client component.
 */

const SEND_TIMEOUT_MS = 15_000;

function apiBase(): string {
  return (process.env.HARAKUMO_BASE_URL || "https://harakumo.com").replace(/\/+$/, "");
}

export function isHarakumoConfigured(): boolean {
  return Boolean(process.env.HARAKUMO_API_KEY);
}

export interface HarakumoSendResult {
  id: number | null;
  status: string;
  messageId: string;
}

export async function sendViaHarakumo(opts: {
  to: string;
  subject: string;
  text: string;
  html?: string;
  fromName: string;
  /** An address on one of your verified sending domains; omit for the default sender. */
  from?: string;
  replyTo?: string;
}): Promise<HarakumoSendResult> {
  const apiKey = process.env.HARAKUMO_API_KEY;
  if (!apiKey) {
    throw new Error("HARAKUMO_API_KEY is not configured — cannot send email.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);

  try {
    const res = await fetch(`${apiBase()}/api/mail/send`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: opts.to,
        subject: opts.subject,
        text: opts.text,
        ...(opts.html ? { html: opts.html } : {}),
        fromName: opts.fromName,
        ...(opts.from ? { from: opts.from } : {}),
        ...(opts.replyTo ? { replyTo: opts.replyTo } : {}),
      }),
      signal: controller.signal,
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data?.error || `Mail send failed (HTTP ${res.status})`);
    }

    const message = data?.message ?? {};
    if (message.status && message.status !== "sent" && message.status !== "queued") {
      throw new Error(message.error || `Mail was not sent (status: ${message.status})`);
    }

    return {
      id: typeof message.id === "number" ? message.id : null,
      status: message.status ?? "sent",
      messageId: message.message_id ?? "",
    };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("The email service timed out. Please try again.");
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}
