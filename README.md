# ChurchOS

Church management software — a dashboard of connected apps that share one people record. Built on the same foundation as SkolaOS (the school suite).

Open source under the [MIT licence](LICENSE), and listed on [Nucleus](https://nucleus.harakumo.com/-/explore).

## Stack

- **Next.js 16** (App Router, TypeScript) + **Tailwind CSS v4**, run as a plain Node server (`next build` + `next start`)
- **MongoDB** (Mongoose) — every record, scoped to its church by `churchId`
- **Any S3-compatible bucket** — photos, documents and drive files (browser uploads directly via presigned URLs; keys are prefixed per church)
- **Harakumo Mail** for transactional mail and announcements (`src/lib/harakumo.ts`, one `HARAKUMO_API_KEY`)
- Auth: username/email + password, bcrypt-hashed, JWT session in an httpOnly cookie; forgot/reset by emailed token; new signups wait for approval in the Company console. The very first account to sign up becomes the approved company admin.

## Run it

```bash
npm install
cp .env.example .env.local   # then fill in the values
npm run dev
```

Configuration (see `.env.example`):

| Variable | What it is |
|---|---|
| `MONGODB_URI` | MongoDB connection string, database name included. **Required.** |
| `JWT_SECRET` | Random hex secret for signing session cookies (`openssl rand -hex 32`). **Required.** |
| `APP_URL` | Public address of the app, used for links in emails. Recommended in production; falls back to the request host. |
| `STORAGE_BUCKET` / `STORAGE_ACCESS_KEY_ID` / `STORAGE_SECRET_ACCESS_KEY` / `STORAGE_ENDPOINT` | Any S3-compatible bucket. Without them, uploads (photos, documents, logos, drive) answer "storage not configured" and everything else works. |
| `STORAGE_PUBLIC_URL` | Public base URL the uploaded files are served from |
| `STORAGE_REGION` | Optional, for providers that need a region (default `auto`) |
| `HARAKUMO_API_KEY` | Harakumo Mail. Without it, password-reset, approval and invitation emails and announcements report "email not set up"; everything else works. |
| `MAIL_FROM` / `MAIL_FROM_NAME` | Optional sender address on a domain you verified in Harakumo Mail, and its display name (default "ChurchOS") |
| `CONTACT_EMAIL` | Company inbox for contact-form notifications and replies to company-console mail. Empty = notify the first company admin. |
| `ANNOUNCEMENT_SCHEDULER` | Set to `off` to stop the server's own five-minute scheduler (see Announcements) |
| `CRON_SECRET` | Authorises `POST /api/cron/dispatch-announcements` for an external scheduler. Unset = that route is 404. |
| `INBOUND_MAIL_SECRET` | Authorises `POST /api/mail/inbound`, which feeds the company console's Mailbox. Unset = that route is 404. |

The storage bucket needs a CORS rule allowing `PUT` from the app's origin, otherwise browser uploads are blocked.

Production build:

```bash
npm run build
npm start
```

### Demo data

Everything the seed creates is fictional sample data.

```bash
node scripts/seed-demo.mjs                    # creates "Demo Community Church" — sign in as demo / demo1234
node scripts/seed-demo.mjs --user <username>  # fill an existing account's own church with the same sample data
node scripts/seed-demo.mjs --user <username> --reset   # wipe that church's app data and reseed
```

To approve a signup and make it a company admin from the terminal:

```bash
node scripts/promote-admin.mjs <username-or-email>
```

The scripts read `MONGODB_URI` from the environment, or from `.env.local`.

The seed fills every app: 46 people in 10 households, a year of donations, 16 weeks of attendance, groups, events with registrations, service plans, connect cards, certificates and staff.

## Run ChurchOS on Harakumo

ChurchOS is a Node server (Next.js with API routes, MongoDB and a background scheduler), so on Harakumo it runs as a **server app (Pro plan and up)**, not a static site. Its email already goes through Harakumo Mail.

1. **Create a project** at [harakumo.com/dashboard](https://harakumo.com/dashboard) → Projects → New project.
2. **Create an API key** (Settings → API keys) and add it to the project's environment as `HARAKUMO_API_KEY`. Turn on Mail for the project, or the email features answer "email not set up".
3. **Add the rest of the environment** (Project → Environment), from `.env.example`:
   - `MONGODB_URI` — a MongoDB database (include the database name in the path). **MongoDB is required for now**; ChurchOS stores all its data there.
   - `JWT_SECRET` — a long random string (`openssl rand -hex 32`).
   - `APP_URL` — the address people will use, so links in emails point at it.
   - Media storage: the S3-compatible `STORAGE_*` values (bucket, keys, endpoint, public URL). Uploads must go to object storage: a server app's disk is not kept between deploys.
   - Optional: `MAIL_FROM`, `CONTACT_EMAIL`, `CRON_SECRET`, `INBOUND_MAIL_SECRET`.
4. **Deploy** from a folder with the CLI, or ask your AI assistant with the Harakumo connector:

   ```bash
   npm i -g @harakumo/cli
   harakumo login --key <your API key>
   harakumo deploy <project id> .
   ```

   Every deploy is saved as a commit in the project's private Nucleus repo.

Notes:

- **Your MongoDB must accept the server's connections**: allow its address range, and use a database user limited to this database with a long password.
- **Scheduled announcements** go out from the server's own five-minute scheduler while it is running. If your server can be stopped when idle, also call `POST /api/cron/dispatch-announcements` (header `x-cron-secret: <CRON_SECRET>`) every five minutes from any scheduler.
- **Rate limits:** `src/proxy.ts` limits sign-in, sign-up, password reset and the public forms per IP, in the server's memory. See `docs/DEPLOY-NOTES.md`.
- The first account to sign up becomes the company admin, so sign up yourself right after the first deploy.

## Apps

All apps share one MongoDB database and one **Person** record.

| App | What it does |
|---|---|
| **People** | The directory — members, regular attenders, visitors, children; households; milestones (baptism, dedication, marriage); photos, documents, tags |
| **Connect** | First-time visitor cards (public link + QR) and a follow-up pipeline that ends with "add to People" |
| **Giving** | Funds, donations with receipts, pledges, giving dashboard, per-person annual giving statements |
| **Attendance** | Services/gatherings, headcounts and per-person attendance, kids check-in with security codes |
| **Groups** | Small groups, ministries and teams — leaders, rosters, meeting details |
| **Events** | Events with capacity and public registration links |
| **Services** | Order of service planning and volunteer scheduling; teams and roles; printable run sheet |
| **Announcements** | Emails to everyone, members only, a tag or a group — with a template library, drafts, a live preview of the real email, and scheduled sending |
| **Certificates** | Baptism, dedication, marriage, membership, confirmation — serial-numbered and printable |
| **Staff** | Pastors, staff and ministry leaders |
| **Drive** | Shared documents in folders |
| **Analytics** | Cross-app dashboard |
| **Activity / Recycle Bin** | Audit trail of every change; restore anything deleted |

## Arranging your dashboard

Every person arranges their own launcher, from the Customize button on the dashboard or "Arrange dashboard" in the profile menu. They choose which of the apps they can already open should appear, drag or nudge them into order, and pick a density: Comfortable (name and description cards) or Compact (icon tiles, the layout phones have always used). Preferences are per user and private — they never change what anyone else sees, and never grant or remove access. Someone who never opens the panel sees exactly the default. Stored in `dashboardprefs`, keyed by church and user.

## Announcements

Beyond picking an audience, the composer offers:

- **Templates.** Fourteen built-in starters across Service, Events, Care, Giving and Community, each with fill-ins like `{date}` and `{venue}`. Churches can save their own from whatever is in the composer. Built-ins live in `src/lib/announcement-templates.ts`; saved ones in `announcementtemplates`.
- **Drafts.** Save an unfinished announcement and come back to it. Only a title is required.
- **Emails that look like the church.** `src/lib/email-render.ts` renders table-based, inline-styled HTML that survives Gmail, Outlook and Apple Mail, carrying the church's own logo, name, address and website. Three themes (classic, plain, bold), an optional call-to-action button, and a plain-text alternative. Every interpolated value is escaped, and a button link must be http(s). The product is named once, small, in the footer. The composer shows a live preview of the actual email in a sandboxed frame.
- **Scheduling.** Pick a date and time instead of sending now. Every five minutes the server sends whatever has come due (`src/lib/announcement-scheduler.ts`, started from `src/instrumentation.ts`; `ANNOUNCEMENT_SCHEDULER=off` turns it off). An external scheduler can do the same by calling `POST /api/cron/dispatch-announcements` with the `x-cron-secret` header, authorised by `CRON_SECRET`. Each row is claimed with a conditional update before sending, so two ticks — or two servers — can never send the same announcement twice, and a send that fails is recorded as failed rather than sent.

**Without `HARAKUMO_API_KEY` nothing is ever delivered.** Composing, previewing, templates, drafts, scheduling and cancelling all work; a scheduled row simply waits until mail is configured.

## Users, roles and app access

The person who registers a church is its **owner** and always has every app. From **Users & roles** (profile menu, or the card at the bottom of the dashboard) the owner can:

- create roles with any name and tick exactly which apps that role can open (select all, clear, or pick one by one);
- add users to the church with a temporary password and assign them a role;
- change a user's role, disable or re-enable them, reset their password.

Five starter roles are created the first time the page opens: Church admin (built-in, every app), Pastoral team, Finance, Welcome desk, Worship & volunteers. Rename, reshape or delete any except Church admin.

Enforcement happens in two places, independently: every API route calls `requireChurch("<app>")` and returns 403 for apps outside the role, and every app folder's `layout.tsx` wraps the page in `AppGate`, which renders a "No access" card. Directory reads (People and Households `GET`s) and the church profile `GET` are open to every role so pickers and letterheads work everywhere. App keys live in `src/lib/apps.ts`.

Existing churches: `node scripts/migrate-roles.mjs` makes the earliest user of each church its owner.

## Company console

`/admin` is for whoever runs the ChurchOS installation (company admins, `role: "superadmin"`): approve or reject new church signups, see every church at a glance, read contact-form enquiries, and a Mailbox for company mail. The Mailbox shows what you send from it, and mail you forward to `POST /api/mail/inbound` (header `x-inbound-secret: <INBOUND_MAIL_SECRET>`; the body is the raw RFC 822 message, or JSON `{ from, fromName, to, subject, text, html }`). Point any mail provider's forward-to-webhook feature at it, or leave it off.

The public pages (`/privacy`, `/terms`, `/contact`) describe the people running the installation; edit them to match yours before going live.

## Multi-tenancy

Shared collections with a required, indexed `churchId` on every tenant document. Every tenant API route calls `requireChurch()` from `src/lib/api-helpers.ts` and adds `churchId: user.churchId` to every query. Public pages (connect card, event registration) resolve the church by its public code instead of a session.

## Project layout

```
src/
  app/
    (auth)/                 — login, signup, forgot/reset password
    dashboard/              — app launcher + one folder per app
    admin/                  — company console (platform owner)
    api/                    — REST route handlers, one folder per app
    api/cron/               — scheduled-announcement dispatch for an external scheduler
    api/mail/inbound/       — inbound-mail webhook for the company Mailbox
    connect/[church]/       — public visitor card
    register/[church]/[slug] — public event registration
  lib/                      — db, auth, api-helpers, audit, mail, harakumo, storage, money, constants
  models/                   — one Mongoose model per file
  components/               — UI kit (Button, Field, Drawer, Modal, Toast…), Avatar, PersonPicker
  proxy.ts                  — per-IP rate limits on the auth and public routes
  instrumentation.ts        — starts the announcement scheduler
```

## Conventions for adding an app

1. Model in `src/models/`, with `churchId` required + indexed and per-church unique indexes.
2. API under `src/app/api/<app>/`, every handler wrapped in `withApi()` and guarded by `requireChurch()`.
3. Log changes with `logActivity()`; on delete, call `moveToRecycleBin()` first and register the collection in `RECYCLE_COLLECTIONS` (`src/lib/audit.ts`) and the labels in `src/lib/audit-labels.ts`.
4. Pages under `src/app/dashboard/<app>/`, client components using `api()` from `src/lib/client-api.ts` and the UI kit.
5. Money is formatted with `formatMoney(amount, church.currency)` from `src/lib/money.ts`.
6. Cross-app summaries for a person live at `/api/<app>/person-summary/[id]` and are rendered on the person profile.
