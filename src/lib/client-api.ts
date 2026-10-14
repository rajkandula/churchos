"use client";

/** fetch wrapper that unwraps JSON and throws readable error messages.
 *  Reads (GET/HEAD) retry automatically on 5xx/network errors — the server
 *  occasionally rebuilds its DB connection mid-burst and heals in well under
 *  a second. Writes never retry, so nothing can double-submit. */
/**
 * A signed-in area answering 401 means the cookie was revoked — a password
 * change, an admin reset, or the account being disabled. Without this the
 * page stays on screen and every request under it fails, which reads as the
 * app being broken rather than as being signed out. 403 with
 * `password_change_required` is the temporary-password gate.
 *
 * Only fires inside /dashboard and /admin: the public connect and event
 * pages use this same wrapper and have no session to lose.
 */
function handleSessionEnded(status: number, code?: string): boolean {
  if (typeof window === "undefined") return false;
  const path = window.location.pathname;
  if (!path.startsWith("/dashboard") && !path.startsWith("/admin")) return false;

  if (status === 401) {
    // A hard navigation on purpose: a revoked session must drop every piece
    // of in-memory state, which a soft router.push would keep. This is a
    // plain module, not a component, so there is no router here anyway.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = "/login?expired=1";
    return true;
  }
  if (status === 403 && code === "password_change_required") {
    if (!path.startsWith("/dashboard/profile")) {
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = "/dashboard/profile?setPassword=1";
      return true;
    }
  }
  return false;
}

export async function api<T>(
  url: string,
  options?: RequestInit & { json?: unknown }
): Promise<T> {
  const { json, ...rest } = options ?? {};
  const method = (rest.method ?? "GET").toUpperCase();
  const attempts = method === "GET" || method === "HEAD" ? 3 : 1;

  let lastErr: Error = new Error("Request failed. Please try again.");
  for (let attempt = 0; attempt < attempts; attempt++) {
    if (attempt > 0)
      await new Promise((r) => setTimeout(r, 350 * attempt + Math.random() * 250));

    let res: Response;
    try {
      res = await fetch(url, {
        ...rest,
        headers: {
          ...(json !== undefined ? { "Content-Type": "application/json" } : {}),
          ...rest.headers,
        },
        body: json !== undefined ? JSON.stringify(json) : rest.body,
      });
    } catch {
      lastErr = new Error("Network error. Please check your connection.");
      continue;
    }

    let data: unknown = null;
    try {
      data = await res.json();
    } catch {
      // non-JSON response
    }

    if (res.ok) return data as T;
    const payload = data as { error?: string; code?: string } | null;
    lastErr = new Error(
      payload?.error ?? `Request failed (${res.status}). Please try again.`
    );
    if (handleSessionEnded(res.status, payload?.code)) {
      // Navigation is underway; never resolve, so no caller renders an
      // error toast over a page that is already leaving.
      await new Promise(() => {});
    }
    if (res.status < 500) throw lastErr;
  }
  throw lastErr;
}

export function formatDate(value?: string | Date | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  // Date-only values are stored as UTC midnight — format in UTC so the
  // displayed day never shifts with the viewer's timezone.
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Timestamped events (issued/created at) — date and clock time, viewer-local. */
export function formatDateTime(value?: string | Date | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/** For <input type="date"> values. */
export function toDateInput(value?: string | Date | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}
