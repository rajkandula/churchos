import { NextResponse } from "next/server";
import { connectDb, DbNotConfiguredError, isDeadConnectionError } from "@/lib/db";
import { getSession, type SessionUser } from "@/lib/auth";
import { User } from "@/models/User";
import { canOpen, resolveAccess, type Access } from "@/lib/access";
import { appName, type AppKey } from "@/lib/apps";

// A request body can be read only once; withApi's dead-connection retry
// re-runs the handler, so the parsed body is cached per-request.
const bodyCache = new WeakMap<Request, unknown>();

/** Parse a JSON request body, tolerating repeat reads across retries. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function readBody(req: Request): Promise<any> {
  if (bodyCache.has(req)) return bodyCache.get(req);
  const body = await req.json().catch(() => ({}));
  bodyCache.set(req, body);
  return body;
}

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/** Map thrown errors to a clean JSON response. */
export function handleApiError(err: unknown) {
  if (err instanceof DbNotConfiguredError) {
    return jsonError(err.message, 503);
  }
  console.error(err);
  const message =
    err instanceof Error ? err.message : "Something went wrong. Please try again.";
  return NextResponse.json({ error: message }, { status: 500 });
}


/** Reasons a signed-in cookie is no longer good enough to act on. */
type AccountState = {
  status?: string | null;
  sessionVersion?: number | null;
  mustChangePassword?: boolean | null;
};

/** Throws the right 401/403 when an account can no longer use this session.
 *  `stale` covers a password change, an admin reset, or a disable — the token
 *  carries the version it was minted with, so older tokens stop working. */
function assertUsableAccount(
  session: SessionUser,
  user: AccountState | null,
  { requirePasswordSet }: { requirePasswordSet: boolean }
): void {
  if (!user) {
    throw NextResponse.json({ error: "Account no longer exists." }, { status: 401 });
  }
  if ((session.sv ?? 0) !== (user.sessionVersion ?? 0)) {
    throw NextResponse.json(
      { error: "Your password was changed. Please sign in again." },
      { status: 401 }
    );
  }
  if (user.status === "disabled") {
    throw NextResponse.json(
      { error: "This account has been disabled. Contact your church admin." },
      { status: 403 }
    );
  }
  // Legacy accounts without a status are treated as approved
  if (user.status && user.status !== "approved") {
    throw NextResponse.json(
      { error: "Your account is awaiting approval by the administrator." },
      { status: 403 }
    );
  }
  // A temporary password gets you to the profile page and nowhere else.
  if (requirePasswordSet && user.mustChangePassword) {
    throw NextResponse.json(
      {
        error: "Set your own password before using the apps.",
        code: "password_change_required",
      },
      { status: 403 }
    );
  }
}

/** Returns the signed-in, approved user or throws 401/403. */
export async function requireSession(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) {
    throw NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  await connectDb();
  const user = await User.findById(session.id)
    .select("status sessionVersion mustChangePassword")
    .lean();
  assertUsableAccount(session, user, { requirePasswordSet: false });
  return session;
}

export type ChurchSession = SessionUser & { churchId: string; access: Access };

/** Signed-in, approved, AND linked to a church — the guard every
 *  tenant-scoped route uses. All data queries must filter by churchId.
 *  Pass an app key to also require that the user's role can open that app
 *  (owners and the system "Church admin" role can open everything). */
export async function requireChurch(app?: AppKey): Promise<ChurchSession> {
  const session = await getSession();
  if (!session) {
    throw NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  await connectDb();
  const user = await User.findById(session.id)
    .select("status churchId isOwner churchRole sessionVersion mustChangePassword")
    .lean();
  assertUsableAccount(session, user, { requirePasswordSet: true });
  if (!user!.churchId) {
    throw NextResponse.json(
      { error: "Your account is not linked to a church yet. Contact support." },
      { status: 403 }
    );
  }
  const access = await resolveAccess(user!);
  if (app && !canOpen(access, app)) {
    throw NextResponse.json(
      { error: `You don't have access to the ${appName(app)} app. Ask your church admin for the right role.` },
      { status: 403 }
    );
  }
  return { ...session, churchId: String(user!.churchId), access };
}

/** Owners and roles that include "Users & roles" — manages users and roles. */
export async function requireChurchAdmin(): Promise<ChurchSession> {
  return requireChurch("users");
}

/** Company console: signed in AND superadmin per the database (not the JWT,
 *  so a promotion takes effect without re-login). */
export async function requireSuperadmin(): Promise<SessionUser> {
  const session = await requireSession();
  await connectDb();
  const user = await User.findById(session.id).lean();
  if (!user || user.role !== "superadmin") {
    throw NextResponse.json({ error: "Company admins only." }, { status: 403 });
  }
  return session;
}

/** The public origin for links in emails: APP_URL when set (recommended in
 *  production, so links never depend on the Host header), else the request's. */
export function appOrigin(req: { nextUrl: { origin: string } }): string {
  const configured = (process.env.APP_URL ?? "").trim().replace(/\/+$/, "");
  return configured || req.nextUrl.origin;
}

/** Wrap a route handler so thrown NextResponses and errors are returned cleanly. */
export async function withApi(
  fn: () => Promise<NextResponse>
): Promise<NextResponse> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof NextResponse) return err;
    // A connection that dropped mid-request (network blip, primary
    // step-down): reconnect and retry before failing the request.
    let lastErr = err;
    for (
      let attempt = 0;
      attempt < 2 && isDeadConnectionError(lastErr);
      attempt++
    ) {
      try {
        // Jitter so simultaneous retries don't all land at once
        await new Promise((r) => setTimeout(r, 80 + Math.random() * 300));
        await connectDb();
        return await fn();
      } catch (errRetry) {
        if (errRetry instanceof NextResponse) return errRetry;
        lastErr = errRetry;
      }
    }
    return handleApiError(lastErr);
  }
}
