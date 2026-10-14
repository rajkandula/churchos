# ChurchOS — conventions for building an app module

Stack: Next.js 16 App Router + TypeScript + Tailwind v4, MongoDB via Mongoose 9, any S3-compatible bucket for files.

## Read these first (they are the canonical patterns — copy them, don't reinvent)
- src/lib/api-helpers.ts — `withApi`, `requireChurch` (returns `{ id, name, churchId, ... }`), `readBody`, `jsonError`
- src/lib/audit.ts — `logActivity(user, action, itemType, label, id)`, `moveToRecycleBin({ user, itemType, label, doc, related? })`; RECYCLE_COLLECTIONS already lists your collection
- src/lib/audit-labels.ts — item type labels (already contain your types; do NOT edit)
- src/lib/constants.ts — PAYMENT_MODES, DEFAULT_SERVICES, DEFAULT_FUNDS, DAYS_OF_WEEK, PERSON_STATUS_LABELS, GENDER_OPTIONS
- src/lib/seq.ts — `withSeqRetry`, `seqLabel("R", n)` → "R-0007", `currentYear()`, `currentFinancialYear()`
- src/lib/money.ts — `formatMoney(amount, currency)`; get currency from `GET /api/settings/church` → `church.currency`
- src/lib/person-fields.ts — `isValidObjectId`
- src/lib/client-api.ts — `api()`, `formatDate`, `formatDateTime`, `toDateInput`
- src/lib/mail.ts — `sendMail`, `emailTemplate`, `isMailConfigured` (email needs `HARAKUMO_API_KEY`; handle the "not configured" case gracefully)
- src/lib/public-church.ts — `findChurchByCode`, `randomCode` (for public links)
- src/models/Person.ts, src/models/Church.ts, src/models/Household.ts
- src/app/api/people/route.ts and src/app/api/people/[id]/route.ts — canonical API route shape
- src/app/dashboard/people/page.tsx, PersonDrawer.tsx, [id]/page.tsx, types.ts — canonical UI (list + drawer + profile)
- src/components/ui/* (Button, Field: TextField/SelectField/TextAreaField, Drawer, Modal, Tabs, ConfirmDialog, Toast/useToast), src/components/Avatar.tsx, src/components/PersonPicker.tsx, src/components/PrintButton.tsx

## Hard rules
1. Every model: `churchId: { type: ObjectId, ref: "Church", required: true, index: true }`; per-church unique indexes as `{ churchId: 1, field: 1 }`. Use `mongoose.models.X ?? mongoose.model("X", schema)` and export `XDoc = InferSchemaType<...>`. Model files go in src/models/, one per file.
2. Every API handler: `return withApi(async () => { const user = await requireChurch(); ... })`, and EVERY query includes `churchId: user.churchId`. Validate input, return `jsonError()` for bad input. Route params are `{ params: Promise<{ id: string }> }` (await them).
3. `logActivity` on create/update/restore; on delete, call `moveToRecycleBin` first, then delete. Use exactly the itemType strings assigned to you.
4. Snapshot denormalised names on records that must read the same forever (e.g. `personName`, `fundName` on a donation) — don't rely on populate for display.
5. Pages are `"use client"` components using `api()`; match the People page's look: back link to /dashboard, `<h1 className="text-3xl font-bold tracking-tight text-slate-900">`, `mt-1.5 text-slate-500` subtitle, rounded-2xl white cards with `border border-slate-200 shadow-sm`, indigo accent, skeleton loading rows, empty states with an icon, toasts on success/error, ConfirmDialog for deletes, `animate-fade-up` wrapper.
6. Use `Drawer` for long forms, `Modal` for short ones. Use `PersonPicker` wherever a person is chosen. Use `Avatar` for people.
7. Keep module-specific constants in your module's own types.ts rather than growing the shared files (src/lib/constants.ts, src/lib/audit.ts, the Person and Church models).
8. Printable pages (receipts, statements, certificates, run sheets): a route like `.../[id]/print/page.tsx` with print-friendly CSS (white background, `print:hidden` on chrome) and `<PrintButton />`. The Navbar already hides on print. Fetch church name/logo/address from `GET /api/settings/church` for the letterhead.
9. Finish by running from the project root:
    `./node_modules/.bin/next typegen >/dev/null 2>&1; ./node_modules/.bin/tsc --noEmit -p tsconfig.json`
    and `./node_modules/.bin/eslint <your files>` — both must be clean for your files. Fix everything you introduced.

## Access control (roles)
- `src/lib/apps.ts` is the registry of app keys; `src/models/Role.ts` holds a church's roles (`apps: AppKey[]`, `system` = the built-in full-access "Church admin"); `User.isOwner` marks the registrant (always full access) and `User.churchRole` points at a Role.
- `requireChurch("giving")` (in `src/lib/api-helpers.ts`) is the guard for every route in an app; it returns `{ ..., churchId, access }` where `access` is `{ isOwner, roleId, roleName, apps, all }` from `src/lib/access.ts`. `requireChurchAdmin()` = `requireChurch("users")`.
- Reads every church user needs regardless of role stay unkeyed: `GET /api/people` and `GET /api/people/[id]` (they back PersonPicker, so they return picker fields only unless the role can open People), `GET /api/settings/church`, uploads presign. Everything else is keyed — the household reads and `GET /api/people/options` require `people`, because they carry addresses, pastoral notes and the tag list.
- Client components must import `canOpen`/`canManageUsers`/`Access` from `src/lib/access-shared.ts` (no mongoose); `src/lib/access.ts` is server-only.
- Pages: each `src/app/dashboard/<app>/layout.tsx` wraps children in `<AppGate app="…">`, which renders a "No access" card instead of the page.
