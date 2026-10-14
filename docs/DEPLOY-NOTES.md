# Deploy notes — what protects the auth routes

## Per-account protections (in the routes)

- **`POST /api/auth/login`** — per-account backoff. Six or more wrong passwords
  lock the account for 30s, doubling per further failure to a ~16 minute cap
  (`src/app/api/auth/login/route.ts`). The lock is time-bounded and clears on
  the next successful sign-in or password reset, so it can't be used to lock a
  known user out permanently. The response is the same generic 401 either way.
- **`POST /api/auth/forgot`** — a 15-minute resend cooldown keyed on the
  freshness of the token already on the account, so a known address can be
  mailed at most once per 15 minutes. The response body and its padded timing
  are unchanged, so the cooldown is invisible to the caller.
- **`POST /api/auth/reset`** — the tokens are 32 random bytes, so guessing one
  is infeasible; the per-IP limit below caps the free attempts.

## Per-IP limits (`src/proxy.ts`)

None of the above bounds requests *per IP*, which is what stops credential
stuffing across many accounts. `src/proxy.ts` limits `POST` requests per IP
address, in the server's memory:

| Path | Limit |
| --- | --- |
| `/api/auth/login` | 20 per minute |
| `/api/auth/signup` | 10 per hour |
| `/api/auth/forgot` | 5 per 15 minutes |
| `/api/auth/reset` | 10 per 15 minutes |
| `/api/public/contact` | 5 per hour |
| `/api/public/connect/*`, `/api/public/events/*` | 30 per 10 minutes |

The limits are deliberately generous because a whole church often shares one
connection. The counters are per server process: exact on one server, and
per instance if you run several. The client address is read from `x-real-ip`
or the first `x-forwarded-for` entry, so run the app behind a proxy that sets
those headers (and strips any the client sent).
