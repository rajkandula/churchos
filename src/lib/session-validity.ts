import type { SessionUser } from "@/lib/auth";

/**
 * A session cookie is a signed 7-day JWT, so it keeps asserting who someone
 * was until it expires. `User.sessionVersion` is the revocation counter: it
 * is bumped whenever the password changes, an admin resets it, or the
 * account is disabled. The API guards compare it on every request
 * (assertUsableAccount in src/lib/api-helpers.ts); server components must
 * make the same comparison, or a revoked session keeps rendering pages
 * while every request inside them fails.
 */
export function isSessionStale(
  session: Pick<SessionUser, "sv">,
  account: { sessionVersion?: number | null } | null
): boolean {
  if (!account) return true;
  return (session.sv ?? 0) !== (account.sessionVersion ?? 0);
}

/** Fields every server-side session check needs to select. */
export const SESSION_CHECK_FIELDS = "status sessionVersion";
