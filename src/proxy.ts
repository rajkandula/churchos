import { NextResponse, type NextRequest } from "next/server";

/**
 * Per-IP limits on the unauthenticated auth and public endpoints.
 *
 * The routes carry their own per-account protections too (login backoff,
 * a reset-email cooldown — see docs/DEPLOY-NOTES.md); this is the layer that
 * stops one address hammering many accounts. Held in this process's memory,
 * so it is exact for one server and per-instance if you run several.
 *
 * Generous on purpose: a whole church often shares one connection (the
 * office, the welcome-desk tablet on the church Wi-Fi).
 */

type Rule = { prefix: string; exact: boolean; limit: number; windowMs: number };

const RULES: Rule[] = [
  { prefix: "/api/auth/login", exact: true, limit: 20, windowMs: 60_000 },
  { prefix: "/api/auth/signup", exact: true, limit: 10, windowMs: 3_600_000 },
  { prefix: "/api/auth/forgot", exact: true, limit: 5, windowMs: 900_000 },
  { prefix: "/api/auth/reset", exact: true, limit: 10, windowMs: 900_000 },
  // Public, unauthenticated — the classic spam targets.
  { prefix: "/api/public/contact", exact: true, limit: 5, windowMs: 3_600_000 },
  { prefix: "/api/public/connect/", exact: false, limit: 30, windowMs: 600_000 },
  { prefix: "/api/public/events/", exact: false, limit: 30, windowMs: 600_000 },
];

const windows = new Map<string, { n: number; resetAt: number }>();
let lastSweep = 0;

/** The caller's address as the hosting proxy forwards it; best effort. */
function clientIp(request: NextRequest): string {
  const real = request.headers.get("x-real-ip");
  if (real) return real.trim();
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded ? forwarded.split(",")[0].trim() : "unknown";
}

function ruleFor(pathname: string): Rule | undefined {
  return RULES.find((r) =>
    r.exact ? pathname === r.prefix : pathname.startsWith(r.prefix)
  );
}

export function proxy(request: NextRequest) {
  if (request.method !== "POST") return NextResponse.next();
  const rule = ruleFor(request.nextUrl.pathname);
  if (!rule) return NextResponse.next();

  const now = Date.now();
  if (now - lastSweep > 60_000) {
    lastSweep = now;
    for (const [key, w] of windows) if (now > w.resetAt) windows.delete(key);
  }

  const key = `${rule.prefix}|${clientIp(request)}`;
  let w = windows.get(key);
  if (!w || now > w.resetAt) {
    w = { n: 0, resetAt: now + rule.windowMs };
    windows.set(key, w);
  }
  w.n++;
  if (w.n <= rule.limit) return NextResponse.next();

  return NextResponse.json(
    { error: "Too many attempts — please wait a bit and try again." },
    {
      status: 429,
      headers: {
        "Retry-After": String(Math.max(1, Math.ceil((w.resetAt - now) / 1000))),
      },
    }
  );
}

export const config = {
  matcher: ["/api/auth/:path*", "/api/public/:path*"],
};
