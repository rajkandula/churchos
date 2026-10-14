"use client";

import { Check, ShieldAlert, ShieldCheck, UserCog } from "lucide-react";
import { useState } from "react";
import { api } from "@/lib/client-api";
import { ADMIN_APP_KEYS, APPS, APP_KEYS, type AppKey } from "@/lib/apps";
import { APP_ICONS } from "@/lib/app-icons";
import { Drawer } from "@/components/ui/Drawer";
import { Button } from "@/components/ui/Button";
import { TextField, TextAreaField } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import type { RoleDto } from "./types";

export type RoleDrawerState =
  | { mode: "new" }
  | { mode: "edit"; role: RoleDto }
  | { mode: "duplicate"; role: RoleDto };

type AppEntry = (typeof APPS)[number];

/**
 * The apps, grouped the way a church thinks about them. Every key in the app
 * registry belongs to exactly one group — see the assertion below, which stops
 * a newly added app from quietly disappearing out of the role editor.
 */
const APP_GROUPS = [
  {
    id: "people",
    label: "People & care",
    hint: "The directory, follow-up and small groups.",
    apps: ["people", "connect", "groups"],
  },
  {
    id: "money",
    label: "Money",
    hint: "Giving, receipts and statements.",
    apps: ["giving"],
  },
  {
    id: "sunday",
    label: "Sunday",
    hint: "Everything around a gathering.",
    apps: ["attendance", "services", "events"],
  },
  {
    id: "communication",
    label: "Communication",
    hint: "What goes out to the church.",
    apps: ["announcements", "certificates"],
  },
  {
    id: "records",
    label: "Records & insight",
    hint: "Files, numbers and the audit trail.",
    apps: ["staff", "drive", "analytics", "activity", "recycle"],
  },
  {
    id: "administration",
    label: "Administration",
    hint: "Runs the church account itself — grant this deliberately.",
    apps: ["settings", "users"],
    admin: true,
  },
] as const satisfies readonly {
  id: string;
  label: string;
  hint: string;
  apps: readonly AppKey[];
  admin?: true;
}[];

/** Compile-time: an app key no group lists makes this assignment fail to build. */
type GroupedAppKey = (typeof APP_GROUPS)[number]["apps"][number];
type UngroupedAppKey = Exclude<AppKey, GroupedAppKey>;
const EVERY_APP_GROUPED: [UngroupedAppKey] extends [never]
  ? true
  : ["Add these app keys to APP_GROUPS:", UngroupedAppKey] = true;

const GROUPED_KEYS: AppKey[] = APP_GROUPS.flatMap((g) => [...g.apps]);
const NON_ADMIN_KEYS: AppKey[] = APP_KEYS.filter((k) => !ADMIN_APP_KEYS.includes(k));

// Runtime backstop for what the type can't see — a key listed in two groups.
if (
  process.env.NODE_ENV !== "production" &&
  (!EVERY_APP_GROUPED ||
    GROUPED_KEYS.length !== APP_KEYS.length ||
    new Set(GROUPED_KEYS).size !== APP_KEYS.length)
) {
  throw new Error(
    "RoleDrawer: APP_GROUPS is out of sync with the app registry — every app key must appear in exactly one group."
  );
}

const ENTRY_BY_KEY = new Map<AppKey, AppEntry>(APPS.map((a) => [a.key, a]));

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-bold tracking-widest text-slate-400 uppercase">{children}</h3>
  );
}

function AppCard({
  app,
  checked,
  disabled,
  onToggle,
}: {
  app: AppEntry;
  checked: boolean;
  disabled: boolean;
  onToggle: (key: AppKey) => void;
}) {
  const Icon = APP_ICONS[app.key];
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={app.name}
      disabled={disabled}
      onClick={() => onToggle(app.key)}
      className={`flex w-full cursor-pointer items-start gap-3 rounded-xl border p-3 text-left transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-70 ${
        checked
          ? "border-indigo-300 bg-indigo-50/60"
          : "border-slate-200 bg-white hover:border-indigo-200"
      }`}
    >
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${app.accent} text-white shadow-sm`}
      >
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-slate-900">{app.name}</span>
        <span className="line-clamp-2 block text-xs leading-relaxed text-slate-500">
          {app.description}
        </span>
      </span>
      <span
        aria-hidden
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors duration-150 ${
          checked ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-300 bg-white"
        }`}
      >
        {checked && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
      </span>
    </button>
  );
}

/** Mounts fresh for every role it opens (keyed), so the form initialises
 *  from props instead of syncing them in an effect. */
export function RoleDrawer({
  state,
  onClose,
  onSaved,
}: {
  state: RoleDrawerState | null;
  onClose: () => void;
  onSaved: (role: RoleDto) => void | Promise<void>;
}) {
  if (!state) return null;
  const key = state.mode === "new" ? "new" : `${state.mode}-${state.role._id}`;
  return <RoleDrawerInner key={key} state={state} onClose={onClose} onSaved={onSaved} />;
}

function RoleDrawerInner({
  state,
  onClose,
  onSaved,
}: {
  state: RoleDrawerState;
  onClose: () => void;
  onSaved: (role: RoleDto) => void | Promise<void>;
}) {
  const toast = useToast();
  const existing = state.mode === "edit" ? state.role : null;
  const source = state.mode === "new" ? null : state.role;
  const isSystem = existing?.system === true;
  const isYours = existing?.isYours === true;

  const [name, setName] = useState(
    state.mode === "duplicate" ? `Copy of ${state.role.name}` : (source?.name ?? "")
  );
  const [description, setDescription] = useState(source?.description ?? "");
  const [apps, setApps] = useState<AppKey[]>(() =>
    isSystem ? [...APP_KEYS] : [...(source?.apps ?? [])]
  );
  const [saving, setSaving] = useState(false);

  const toggle = (key: AppKey) => {
    if (isSystem) return;
    setApps((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  const selectGroup = (keys: readonly AppKey[]) =>
    setApps((prev) => [...prev, ...keys.filter((k) => !prev.includes(k))]);
  const clearGroup = (keys: readonly AppKey[]) =>
    setApps((prev) => prev.filter((k) => !keys.includes(k)));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Please give the role a name.");
      return;
    }
    setSaving(true);
    try {
      let saved: RoleDto;
      if (existing) {
        const res = await api<{ role: RoleDto }>(`/api/roles/${existing._id}`, {
          method: "PATCH",
          // The system role's apps are fixed — only send what can change
          json: isSystem ? { name, description } : { name, description, apps },
        });
        saved = res.role;
        toast.success(`${name.trim()} updated.`);
      } else {
        const res = await api<{ role: RoleDto }>("/api/roles", {
          method: "POST",
          json: { name, description, apps },
        });
        saved = res.role;
        toast.success(`${name.trim()} role created.`);
      }
      await onSaved(saved);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the role.");
    } finally {
      setSaving(false);
    }
  }

  const title = existing
    ? `Edit ${existing.name}`
    : state.mode === "duplicate"
      ? "Duplicate role"
      : "New role";
  const subtitle = isSystem
    ? "The built-in full-access role. You can rename it, but it always opens every app."
    : state.mode === "duplicate"
      ? `Starts with the same apps as ${state.role.name}.`
      : "Name it after the team, then tick the apps they should see.";

  return (
    <Drawer
      open
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="role-form" loading={saving}>
            {existing ? "Save changes" : "Create role"}
          </Button>
        </div>
      }
    >
      <form id="role-form" onSubmit={onSubmit} className="space-y-7">
        <section className="space-y-4">
          <div className="border-b border-slate-100 pb-2">
            <SectionTitle>Role</SectionTitle>
          </div>
          <TextField
            label="Name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Finance team, Welcome desk"
            maxLength={60}
          />
          <TextAreaField
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What this team does — shown on the role card."
          />
        </section>

        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
            <SectionTitle>Access</SectionTitle>
            <div className="flex items-center gap-3 text-xs">
              <span className="font-semibold text-slate-600" aria-live="polite">
                {apps.length} of {APP_KEYS.length} apps
              </span>
              {!isSystem && (
                <>
                  <button
                    type="button"
                    onClick={() => selectGroup(NON_ADMIN_KEYS)}
                    title="Ticks every app except Administration."
                    className="cursor-pointer font-semibold text-indigo-600 transition-colors duration-200 hover:text-indigo-700"
                  >
                    Select all apps
                  </button>
                  <button
                    type="button"
                    onClick={() => setApps([])}
                    className="cursor-pointer font-semibold text-slate-500 transition-colors duration-200 hover:text-slate-700"
                  >
                    Clear
                  </button>
                </>
              )}
            </div>
          </div>

          {isSystem && (
            <div className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm text-slate-600">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden />
              The Church admin role always has every app, so nothing here can be unticked.
            </div>
          )}

          {isYours && !isSystem && (
            <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-sm text-amber-800">
              <UserCog className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
              This is your own role — removing Users &amp; roles here would lock you out.
            </div>
          )}

          {apps.includes("users") && (
            <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-sm text-amber-800">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
              People with this role can add users and change roles, including their own.
            </div>
          )}

          {APP_GROUPS.map((group) => {
            const keys: readonly AppKey[] = group.apps;
            const chosen = keys.filter((k) => apps.includes(k)).length;
            const allChosen = chosen === keys.length;
            return (
              <div key={group.id} className="space-y-2">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <div className="min-w-0">
                    <p
                      className={`text-[13px] font-semibold ${
                        "admin" in group ? "text-rose-700" : "text-slate-700"
                      }`}
                    >
                      {group.label}{" "}
                      <span className="font-medium text-slate-400">
                        · {chosen} of {keys.length}
                      </span>
                    </p>
                    <p className="text-xs text-slate-500">{group.hint}</p>
                  </div>
                  {!isSystem && (
                    <button
                      type="button"
                      onClick={() => (allChosen ? clearGroup(keys) : selectGroup(keys))}
                      className="shrink-0 cursor-pointer text-xs font-semibold text-indigo-600 transition-colors duration-200 hover:text-indigo-700"
                    >
                      {allChosen ? "Clear group" : "Select group"}
                    </button>
                  )}
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {keys.map((key) => {
                    const app = ENTRY_BY_KEY.get(key);
                    if (!app) return null;
                    return (
                      <AppCard
                        key={key}
                        app={app}
                        checked={apps.includes(key)}
                        disabled={isSystem}
                        onToggle={toggle}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </section>
      </form>
    </Drawer>
  );
}
