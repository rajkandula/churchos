"use client";

import { Building2, Crown, KeyRound, Plus, Trash2, UserRoundX, Users } from "lucide-react";
import { useState } from "react";
import { api, formatDateTime } from "@/lib/client-api";
import { APP_KEYS, type AppKey } from "@/lib/apps";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { Avatar } from "@/components/Avatar";
import { AddUserModal } from "./AddUserModal";
import { AppAccessPreview } from "./AppAccessPreview";
import { ResetPasswordModal } from "./ResetPasswordModal";
import { RoleDrawer, type RoleDrawerState } from "./RoleDrawer";
import { STATUS_LABELS, STATUS_PILLS, type RoleDto, type UserDto } from "./types";

const roleSelectClass =
  "h-8 max-w-48 cursor-pointer rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 outline-none transition-colors duration-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/30 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500";

const linkClass =
  "cursor-pointer text-[11px] font-semibold text-indigo-600 transition-colors duration-200 hover:text-indigo-700";

const COMPANY_ADMIN_NOTE =
  "Company admins are managed from the Company console — their access can't be changed here.";

/** What one row can open: owners and company admins have everything. */
function accessOf(u: UserDto, role: RoleDto | null): AppKey[] {
  if (u.isOwner || u.isSuperadmin) return [...APP_KEYS];
  return role?.apps ?? [];
}

type ViewingAccess = { title: string; note: string; apps: AppKey[]; role: RoleDto | null };

export function UsersTab({
  users,
  roles,
  onChanged,
}: {
  users: UserDto[] | null;
  roles: RoleDto[];
  onChanged: () => void | Promise<void>;
}) {
  const toast = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [resetting, setResetting] = useState<UserDto | null>(null);
  const [removing, setRemoving] = useState<UserDto | null>(null);
  const [removeBusy, setRemoveBusy] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [viewing, setViewing] = useState<ViewingAccess | null>(null);
  const [roleDrawer, setRoleDrawer] = useState<RoleDrawerState | null>(null);

  const roleById = new Map(roles.map((r) => [r._id, r]));

  async function changeRole(u: UserDto, roleId: string) {
    if (!roleId) return;
    const roleName = roles.find((r) => r._id === roleId)?.name ?? "that role";
    setBusyId(u._id);
    try {
      await api(`/api/users/${u._id}`, { method: "PATCH", json: { roleId } });
      toast.success(`${u.name} is now ${roleName}.`);
      // Wait for the reload before releasing the control, or it flicks back to
      // the old value while the fresh list is still in flight.
      await onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not change the role.");
    } finally {
      setBusyId(null);
    }
  }

  async function toggleStatus(u: UserDto) {
    const status = u.status === "disabled" ? "approved" : "disabled";
    setBusyId(u._id);
    try {
      await api(`/api/users/${u._id}`, { method: "PATCH", json: { status } });
      toast.success(
        status === "disabled"
          ? `${u.name}'s account is disabled — they can no longer sign in.`
          : `${u.name} can sign in again.`
      );
      await onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update the account.");
    } finally {
      setBusyId(null);
    }
  }

  async function onRemove() {
    if (!removing) return;
    setRemoveBusy(true);
    try {
      await api(`/api/users/${removing._id}`, { method: "DELETE" });
      toast.success(`Removed ${removing.name}'s sign-in — it's in the Recycle Bin.`);
      setRemoving(null);
      await onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not remove the account.");
    } finally {
      setRemoveBusy(false);
    }
  }

  return (
    <>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          Everyone here signs in with their own username. Roles decide which apps they see.
        </p>
        <span title={roles.length === 0 ? "Create a role first — a user needs one." : undefined}>
          <Button onClick={() => setAddOpen(true)} disabled={roles.length === 0}>
            <Plus className="h-4 w-4" aria-hidden />
            Add user
          </Button>
        </span>
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60 text-xs font-semibold tracking-wide text-slate-500 uppercase">
                <th className="px-5 py-3.5">Person</th>
                <th className="px-4 py-3.5">Email</th>
                <th className="px-4 py-3.5">Role &amp; apps</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5">Last sign-in</th>
                <th className="px-4 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users === null &&
                [0, 1, 2, 3].map((i) => (
                  <tr key={i} className="border-b border-slate-50">
                    <td colSpan={6} className="px-5 py-4">
                      <div className="h-4 w-full animate-pulse rounded bg-slate-100" />
                    </td>
                  </tr>
                ))}

              {users?.length === 0 && (
                <tr>
                  <td colSpan={6}>
                    <div className="flex flex-col items-center px-6 py-16 text-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50">
                        <Users className="h-6 w-6 text-indigo-500" aria-hidden />
                      </div>
                      <p className="mt-3 font-semibold text-slate-900">No users yet</p>
                      <p className="mt-1 max-w-sm text-sm text-slate-500">
                        Add the people who help run the church — each gets their own sign-in
                        and a role that decides which apps they can open.
                      </p>
                    </div>
                  </td>
                </tr>
              )}

              {users?.map((u) => {
                const protectedRow = u.isOwner || u.isYou || u.isSuperadmin;
                const roleTitle = u.isSuperadmin
                  ? COMPANY_ADMIN_NOTE
                  : u.isOwner
                    ? "The owner always has every app."
                    : u.isYou
                      ? "You can't change your own role — ask another admin."
                      : undefined;
                const role = u.role ? (roleById.get(u.role._id) ?? null) : null;
                const apps = accessOf(u, role);
                const accessTitle = u.isSuperadmin
                  ? `${u.name} · company admin`
                  : u.isOwner
                    ? `${u.name} · owner`
                    : `${role?.name ?? u.role?.name ?? "No role"} · ${u.name}`;
                return (
                  <tr
                    key={u._id}
                    className="border-b border-slate-50 transition-colors duration-150 hover:bg-slate-50/60"
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <Avatar name={u.name} />
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <p className="font-semibold text-slate-900">{u.name}</p>
                            {u.isOwner && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 ring-1 ring-amber-600/20">
                                <Crown className="h-3 w-3" aria-hidden />
                                Owner
                              </span>
                            )}
                            {u.isSuperadmin && (
                              <span
                                title={COMPANY_ADMIN_NOTE}
                                className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-500/20"
                              >
                                <Building2 className="h-3 w-3" aria-hidden />
                                Company admin
                              </span>
                            )}
                            {u.isYou && (
                              <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700 ring-1 ring-indigo-600/20">
                                You
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400">@{u.username}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-slate-600">{u.email}</td>
                    <td className="px-4 py-3.5">
                      {u.isSuperadmin ? (
                        <p
                          title={COMPANY_ADMIN_NOTE}
                          className="text-xs font-semibold text-slate-600"
                        >
                          Company admin · every app
                        </p>
                      ) : (
                        // The title sits on the wrapper: a disabled <select>
                        // never fires the hover that shows a tooltip.
                        <span title={roleTitle} className="inline-flex">
                          <select
                            value={u.role?._id ?? ""}
                            onChange={(e) => changeRole(u, e.target.value)}
                            disabled={protectedRow || busyId === u._id}
                            aria-label={`Role of ${u.name}`}
                            className={roleSelectClass}
                          >
                            {u.isOwner ? (
                              <option value="">Owner · every app</option>
                            ) : (
                              <option value="" disabled>
                                Choose a role…
                              </option>
                            )}
                            {!u.isOwner &&
                              roles.map((r) => (
                                <option key={r._id} value={r._id}>
                                  {r.name}
                                </option>
                              ))}
                          </select>
                        </span>
                      )}
                      {roleTitle && (
                        <p className="mt-1 text-[11px] text-slate-400">{roleTitle}</p>
                      )}
                      {!u.isOwner && !u.isSuperadmin && !u.role && (
                        <p className="mt-1 text-[11px] text-amber-600">
                          No apps until a role is set
                        </p>
                      )}
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                        <AppAccessPreview apps={apps} compact limit={2} />
                        <button
                          type="button"
                          onClick={() =>
                            setViewing({
                              title: accessTitle,
                              note:
                                u.isOwner || u.isSuperadmin
                                  ? "Full access — every app, always."
                                  : role?.description || "",
                              apps,
                              role: u.isOwner || u.isSuperadmin ? null : role,
                            })
                          }
                          className={linkClass}
                        >
                          View access
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${STATUS_PILLS[u.status]}`}
                        >
                          {STATUS_LABELS[u.status]}
                        </span>
                        {!protectedRow && (
                          <button
                            type="button"
                            onClick={() => toggleStatus(u)}
                            disabled={busyId === u._id}
                            className={`cursor-pointer text-xs font-semibold transition-colors duration-200 disabled:opacity-60 ${
                              u.status === "disabled"
                                ? "text-indigo-600 hover:text-indigo-700"
                                : "text-slate-400 hover:text-rose-600"
                            }`}
                          >
                            {u.status === "disabled" ? "Enable" : "Disable"}
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-slate-600">
                      {u.lastLoginAt ? (
                        formatDateTime(u.lastLoginAt)
                      ) : (
                        <span className="text-slate-400">Never</span>
                      )}
                      {u.mustChangePassword && (
                        <p className="text-[11px] text-slate-400">Temporary password</p>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex justify-end gap-1">
                        {!protectedRow && (
                          <button
                            type="button"
                            aria-label={`Reset password for ${u.name}`}
                            title="Reset password"
                            onClick={() => setResetting(u)}
                            className="cursor-pointer rounded-lg p-2 text-slate-400 transition-colors duration-200 hover:bg-slate-100 hover:text-slate-700"
                          >
                            <KeyRound className="h-4 w-4" />
                          </button>
                        )}
                        {!protectedRow && u.status === "disabled" && (
                          <button
                            type="button"
                            aria-label={`Remove ${u.name}`}
                            title="Remove"
                            onClick={() => setRemoving(u)}
                            className="cursor-pointer rounded-lg p-2 text-slate-400 transition-colors duration-200 hover:bg-rose-50 hover:text-rose-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {users && users.length > 0 && (
          <div className="border-t border-slate-100 bg-slate-50/40 px-5 py-3 text-xs text-slate-500">
            Showing {users.length} {users.length === 1 ? "user" : "users"}. Disabled accounts
            can be removed; the owner&apos;s account can&apos;t be changed here.
          </div>
        )}
      </div>

      <AddUserModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        roles={roles}
        onCreated={onChanged}
        onRolesChanged={onChanged}
      />

      <ResetPasswordModal user={resetting} onClose={() => setResetting(null)} onDone={onChanged} />

      <Modal
        open={Boolean(viewing)}
        onClose={() => setViewing(null)}
        title={viewing?.title ?? "Access"}
        subtitle={viewing?.note || undefined}
      >
        <AppAccessPreview apps={viewing?.apps ?? []} />
        <div className="mt-5 flex justify-end gap-3">
          {viewing?.role && (
            <Button
              variant="secondary"
              type="button"
              onClick={() => {
                const role = viewing.role;
                setViewing(null);
                if (role) setRoleDrawer({ mode: "edit", role });
              }}
            >
              Edit this role
            </Button>
          )}
          <Button type="button" onClick={() => setViewing(null)}>
            Close
          </Button>
        </div>
      </Modal>

      <RoleDrawer
        state={roleDrawer}
        onClose={() => setRoleDrawer(null)}
        onSaved={onChanged}
      />

      <ConfirmDialog
        open={Boolean(removing)}
        onClose={() => setRemoving(null)}
        onConfirm={onRemove}
        loading={removeBusy}
        confirmLabel="Remove"
        title="Remove this sign-in?"
        message={`${removing?.name} (@${removing?.username}) will move to the Recycle Bin and won't be able to sign in. Records they created stay exactly as they are.`}
      />

      {users && users.length > 0 && users.every((u) => u.isYou || u.isOwner) && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-400">
          <UserRoundX className="h-3.5 w-3.5" aria-hidden />
          Only you so far — add someone to share the work.
        </p>
      )}
    </>
  );
}
