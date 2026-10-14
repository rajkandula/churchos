"use client";

import { Check, Copy, RefreshCw } from "lucide-react";
import { useId, useState } from "react";
import { api } from "@/lib/client-api";
import { generateTempPassword } from "@/lib/temp-password";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { TextField, SelectField } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { AppAccessPreview } from "./AppAccessPreview";
import { RoleDrawer, type RoleDrawerState } from "./RoleDrawer";
import {
  copyText,
  MIN_PASSWORD_LENGTH,
  shareText,
  signInUrl,
  suggestUsername,
  type RoleDto,
  type UserDto,
} from "./types";

/** Passed to Modal when a click outside must not dismiss it. */
const noop = () => {};

const inputClass =
  "h-10 w-full rounded-xl border border-slate-200 bg-white px-3.5 font-mono text-sm text-slate-900 placeholder:text-slate-400 transition-shadow duration-200 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10";

/** A password field with Regenerate + Copy — shared by Add user and Reset password. */
export function TempPasswordField({
  value,
  onChange,
  hint,
}: {
  value: string;
  onChange: (value: string) => void;
  hint?: string;
}) {
  const toast = useToast();
  const id = useId();
  const [copied, setCopied] = useState(false);

  async function copy() {
    const ok = await copyText(value);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } else {
      toast.error("Couldn't copy — select the password and copy it by hand.");
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-semibold text-slate-700">
        Temporary password<span className="ml-0.5 text-rose-500">*</span>
      </label>
      <div className="flex gap-2">
        <input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          minLength={MIN_PASSWORD_LENGTH}
          required
          className={inputClass}
        />
        <button
          type="button"
          onClick={() => onChange(generateTempPassword())}
          aria-label="Generate a new password"
          title="Regenerate"
          className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition-colors duration-200 hover:border-indigo-200 hover:text-indigo-600"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={copy}
          aria-label="Copy password"
          title="Copy"
          className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition-colors duration-200 hover:border-indigo-200 hover:text-indigo-600"
        >
          {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
        </button>
      </div>
      <p className="text-xs text-slate-500">
        {hint ??
          `At least ${MIN_PASSWORD_LENGTH} characters. Hand it over in person — it's never emailed, and they'll set their own on first sign-in.`}
      </p>
    </div>
  );
}

/** "Share these sign-in details" — shown once after a user is created or reset. */
export function ShareCredentials({
  username,
  password,
  note,
}: {
  username: string;
  password: string;
  note: string;
}) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);

  async function copyAll() {
    const ok = await copyText(shareText({ username, password }));
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } else {
      toast.error("Couldn't copy — select the details and copy them by hand.");
    }
  }

  const rows: { label: string; value: string; mono?: boolean }[] = [
    { label: "Username", value: username },
    { label: "Temporary password", value: password, mono: true },
    { label: "Sign-in link", value: signInUrl() },
  ];

  return (
    <div className="space-y-4">
      <dl className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-slate-50/60">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-4 px-4 py-3">
            <dt className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
              {row.label}
            </dt>
            <dd
              className={`truncate text-sm font-semibold text-slate-900 ${row.mono ? "font-mono tracking-wide" : ""}`}
            >
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
      <Button variant="secondary" type="button" onClick={copyAll} className="w-full">
        {copied ? (
          <Check className="h-4 w-4 text-emerald-600" aria-hidden />
        ) : (
          <Copy className="h-4 w-4" aria-hidden />
        )}
        {copied ? "Copied" : "Copy all"}
      </Button>
      <p className="text-xs leading-relaxed text-slate-500">{note}</p>
    </div>
  );
}

export function AddUserModal({
  open,
  onClose,
  roles,
  onCreated,
  onRolesChanged,
}: {
  open: boolean;
  onClose: () => void;
  roles: RoleDto[];
  onCreated: () => void | Promise<void>;
  /** Reload the role list after the drawer creates or edits one. */
  onRolesChanged: () => void | Promise<void>;
}) {
  if (!open) return null;
  return (
    <AddUserModalInner
      onClose={onClose}
      roles={roles}
      onCreated={onCreated}
      onRolesChanged={onRolesChanged}
    />
  );
}

function AddUserModalInner({
  onClose,
  roles,
  onCreated,
  onRolesChanged,
}: {
  onClose: () => void;
  roles: RoleDto[];
  onCreated: () => void | Promise<void>;
  onRolesChanged: () => void | Promise<void>;
}) {
  const toast = useToast();
  // The system role is full access — only default to it when nothing else exists
  const defaultRole = roles.find((r) => !r.system) ?? roles[0];
  // Lazy initialiser: a fresh password is generated once, not on every render
  const [form, setForm] = useState(() => ({
    name: "",
    username: "",
    email: "",
    roleId: defaultRole?._id ?? "",
    password: generateTempPassword(),
  }));
  const [usernameTouched, setUsernameTouched] = useState(false);
  const [roleDrawer, setRoleDrawer] = useState<RoleDrawerState | null>(null);
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<{
    name: string;
    username: string;
    password: string;
  } | null>(null);

  const selectedRole = roles.find((r) => r._id === form.roleId) ?? null;

  /** Back from the drawer: refresh the list, then select what was just saved. */
  async function onRoleSaved(role: RoleDto) {
    await onRolesChanged();
    setForm((f) => ({ ...f, roleId: role._id }));
  }

  function onNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    const name = e.target.value;
    setForm((f) => ({
      ...f,
      name,
      username: usernameTouched ? f.username : suggestUsername(name),
    }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.password.length < MIN_PASSWORD_LENGTH) {
      toast.error(`The temporary password needs at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    setSaving(true);
    try {
      const res = await api<{ user: UserDto; temporaryPassword: string }>("/api/users", {
        method: "POST",
        json: form,
      });
      setCreated({
        name: res.user.name,
        username: res.user.username,
        password: res.temporaryPassword,
      });
      toast.success(`${res.user.name} can now sign in.`);
      await onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add the user.");
    } finally {
      setSaving(false);
    }
  }

  if (created) {
    return (
      // Shown once: a stray backdrop click or Escape must not throw the
      // password away, so the Modal gets a no-op close and only Done exits.
      <Modal
        open
        onClose={noop}
        title="Share these sign-in details"
        subtitle={`${created.name} is set up. This password is shown only once.`}
      >
        <ShareCredentials
          username={created.username}
          password={created.password}
          note="They'll be asked to set their own password the first time they sign in. If it gets lost, use Reset password on their row."
        />
        <div className="mt-6 flex items-center justify-between gap-3">
          <p className="text-xs text-slate-500">
            Copy the details first — choosing Done closes this for good.
          </p>
          <Button type="button" onClick={onClose}>
            Done
          </Button>
        </div>
      </Modal>
    );
  }

  return (
    <>
      <Modal
        open
        // While the role drawer sits on top, Escape and the backdrop belong to
        // it — closing the form underneath would throw away what was typed.
        onClose={roleDrawer ? noop : onClose}
        title="Add user"
        subtitle="They sign in with a temporary password and choose their own straight away."
      >
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <TextField
            label="Full name"
            required
            autoFocus
            value={form.name}
            onChange={onNameChange}
            placeholder="e.g. Priya Samuel"
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Username"
              required
              value={form.username}
              onChange={(e) => {
                setUsernameTouched(true);
                setForm((f) => ({ ...f, username: e.target.value.toLowerCase() }));
              }}
              placeholder="priya.samuel"
              autoComplete="off"
              hint="Lowercase letters, numbers, dots, underscores."
            />
            <TextField
              label="Email"
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="priya@yourchurch.org"
              autoComplete="off"
            />
          </div>

          <div className="space-y-2">
            <SelectField
              label="Role"
              required
              options={roles.map((r) => ({
                value: r._id,
                label: r.system ? `${r.name} (every app)` : r.name,
              }))}
              placeholder={roles.length ? undefined : "No roles yet"}
              value={form.roleId}
              onChange={(e) => setForm((f) => ({ ...f, roleId: e.target.value }))}
              hint={
                selectedRole?.description ||
                "Decides which apps they can open. Change it any time."
              }
            />
            {/* The point of the whole screen: what this role actually opens */}
            <AppAccessPreview apps={selectedRole?.apps ?? []} />
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
              {selectedRole && (
                <button
                  type="button"
                  onClick={() => setRoleDrawer({ mode: "edit", role: selectedRole })}
                  className="cursor-pointer font-semibold text-indigo-600 transition-colors duration-200 hover:text-indigo-700"
                >
                  {selectedRole.system ? "Rename this role" : "Edit this role's apps"}
                </button>
              )}
              <button
                type="button"
                onClick={() => setRoleDrawer({ mode: "new" })}
                className="cursor-pointer font-semibold text-slate-500 transition-colors duration-200 hover:text-slate-700"
              >
                Create a new role
              </button>
            </div>
          </div>

          <TempPasswordField
            value={form.password}
            onChange={(password) => setForm((f) => ({ ...f, password }))}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" loading={saving} disabled={!form.roleId}>
              Add user
            </Button>
          </div>
        </form>
      </Modal>

      {/* Sits above the form; saving returns here with that role selected. */}
      <RoleDrawer
        state={roleDrawer}
        onClose={() => setRoleDrawer(null)}
        onSaved={onRoleSaved}
      />
    </>
  );
}
